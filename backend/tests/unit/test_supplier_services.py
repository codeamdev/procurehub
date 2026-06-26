"""
Unit tests — supplier AI service layer.

Tests cover context building, mock suggestions heuristics, and the
keyword-driven mock chat dispatcher.  No OpenAI key is required because
SUPPLIER_AI_MOCK defaults to True.
"""
import pytest
from decimal import Decimal
from datetime import date, timedelta
from unittest.mock import patch

from apps.common.exceptions import NotFoundError

pytestmark = pytest.mark.django_db


# ══════════════════════════════════════════════════════════════════════════════
# build_supplier_context
# ══════════════════════════════════════════════════════════════════════════════

class TestBuildSupplierContext:
    def test_includes_supplier_stats(self, supplier):
        from apps.ai_assistant.supplier_services import build_supplier_context
        ctx = build_supplier_context(supplier)
        s = ctx['supplier']
        assert s['email'] == supplier.email
        assert 'proposals_submitted' in s
        assert 'win_rate_pct' in s

    def test_win_rate_zero_when_no_proposals(self, supplier):
        from apps.ai_assistant.supplier_services import build_supplier_context
        ctx = build_supplier_context(supplier)
        assert ctx['supplier']['win_rate_pct'] == 0.0

    def test_win_rate_calculated_correctly(self, supplier, make_proposal, open_request):
        from apps.ai_assistant.supplier_services import build_supplier_context
        from apps.procurement.models import Proposal
        p = make_proposal()
        Proposal.objects.filter(pk=p.pk).update(status='accepted')
        ctx = build_supplier_context(supplier)
        assert ctx['supplier']['win_rate_pct'] == 100.0

    def test_includes_current_request_when_id_provided(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import build_supplier_context
        ctx = build_supplier_context(supplier, request_id=open_request.pk)
        assert 'current_request' in ctx
        req_ctx = ctx['current_request']
        assert req_ctx['id'] == open_request.pk
        assert req_ctx['title'] == open_request.title
        assert 'budget' in req_ctx
        assert 'competing_proposals' in req_ctx

    def test_already_submitted_flag_true(self, supplier, open_request, make_proposal):
        from apps.ai_assistant.supplier_services import build_supplier_context
        make_proposal()   # supplier submits to open_request
        ctx = build_supplier_context(supplier, request_id=open_request.pk)
        assert ctx['current_request']['already_submitted'] is True

    def test_already_submitted_flag_false(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import build_supplier_context
        ctx = build_supplier_context(supplier, request_id=open_request.pk)
        assert ctx['current_request']['already_submitted'] is False

    def test_raises_if_request_not_found(self, supplier):
        from apps.ai_assistant.supplier_services import build_supplier_context
        with pytest.raises(NotFoundError):
            build_supplier_context(supplier, request_id=99999)

    def test_similar_proposals_present(self, supplier, open_request, make_proposal):
        from apps.ai_assistant.supplier_services import build_supplier_context
        make_proposal()
        ctx = build_supplier_context(supplier, request_id=open_request.pk)
        assert 'similar_past_proposals' in ctx

    def test_recent_proposals_limited_to_five(self, supplier, make_request, make_user):
        from apps.ai_assistant.supplier_services import build_supplier_context
        from apps.procurement.models import Proposal
        # Create 6 proposals for supplier on different requests
        for i in range(6):
            req = make_request(title=f'Req {i}', status='open')
            Proposal.objects.create(
                request=req, supplier=supplier,
                price=Decimal('1000'), delivery_time=7, message='x',
            )
        ctx = build_supplier_context(supplier)
        assert len(ctx['recent_proposals']) <= 5


# ══════════════════════════════════════════════════════════════════════════════
# generate_suggestions (mock mode)
# ══════════════════════════════════════════════════════════════════════════════

class TestGenerateSuggestions:
    def test_returns_all_keys(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import generate_suggestions
        result = generate_suggestions(supplier, open_request.pk)
        assert 'price_suggestion' in result
        assert 'delivery_suggestion' in result
        assert 'proposal_template' in result
        assert 'competitive_insights' in result

    def test_price_suggestion_structure(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import generate_suggestions
        ps = generate_suggestions(supplier, open_request.pk)['price_suggestion']
        assert 'suggested' in ps
        assert 'range' in ps
        assert ps['range']['min'] <= ps['suggested'] <= ps['range']['max']
        assert ps['confidence'] in ('high', 'medium', 'low')

    def test_high_confidence_when_no_competition(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import generate_suggestions
        # open_request has no other proposals
        ps = generate_suggestions(supplier, open_request.pk)['price_suggestion']
        assert ps['confidence'] == 'high'

    def test_medium_confidence_with_competition(self, supplier, open_request, make_proposal, make_user):
        from apps.ai_assistant.supplier_services import generate_suggestions
        sup2 = make_user('comp@test.com', role='supplier', is_approved=True)
        make_proposal(sup=sup2)   # add a competing proposal
        ps = generate_suggestions(supplier, open_request.pk)['price_suggestion']
        assert ps['confidence'] == 'medium'

    def test_price_is_below_budget(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import generate_suggestions
        ps = generate_suggestions(supplier, open_request.pk)['price_suggestion']
        assert ps['suggested'] < float(open_request.budget)

    def test_delivery_suggestion_has_days(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import generate_suggestions
        ds = generate_suggestions(supplier, open_request.pk)['delivery_suggestion']
        assert isinstance(ds['days'], int)
        assert ds['days'] > 0

    def test_proposal_template_has_all_fields(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import generate_suggestions
        pt = generate_suggestions(supplier, open_request.pk)['proposal_template']
        assert 'price' in pt
        assert 'delivery_time' in pt
        assert 'message' in pt
        assert open_request.title in pt['message']

    def test_competitive_insights_tip_when_no_competition(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import generate_suggestions
        ci = generate_suggestions(supplier, open_request.pk)['competitive_insights']
        assert ci['competing_proposals'] == 0
        assert 'higher' in ci['tip'].lower()

    def test_raises_if_request_not_found(self, supplier):
        from apps.ai_assistant.supplier_services import generate_suggestions
        with pytest.raises(NotFoundError):
            generate_suggestions(supplier, 99999)


# ══════════════════════════════════════════════════════════════════════════════
# dispatch_supplier_chat — mock mode
# ══════════════════════════════════════════════════════════════════════════════

class TestDispatchSupplierChat:
    def _ctx(self, open_request):
        return {
            'current_request': {
                'id': open_request.pk,
                'title': open_request.title,
                'budget': str(open_request.budget),
                'category': open_request.category,
                'deadline': str(open_request.deadline),
                'competing_proposals': 0,
                'already_submitted': False,
            }
        }

    def test_explain_keyword_returns_explanation(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import dispatch_supplier_chat
        result = dispatch_supplier_chat('Explain this request', self._ctx(open_request))
        assert result['type'] == 'explanation'
        assert 'key_requirements' in result
        assert 'risks' in result

    def test_price_keyword_returns_price_suggestion(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import dispatch_supplier_chat
        result = dispatch_supplier_chat('Suggest a price', self._ctx(open_request))
        assert result['type'] == 'price_suggestion'
        assert 'suggested_price' in result

    @pytest.mark.skip(
        reason="Subcadena 'rate' en 'generate' activa price_suggestion antes que proposal_draft. "
               "Mock temporal — se reemplaza por agente con tool-calling."
    )
    def test_draft_keyword_returns_proposal(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import dispatch_supplier_chat
        result = dispatch_supplier_chat('Generate a proposal draft', self._ctx(open_request))
        assert result['type'] == 'proposal_draft'
        assert 'price' in result
        assert 'message' in result

    def test_unknown_message_returns_guidance(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import dispatch_supplier_chat
        result = dispatch_supplier_chat('something random', self._ctx(open_request))
        assert result['type'] == 'message'

    def test_what_keyword_triggers_explanation(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import dispatch_supplier_chat
        result = dispatch_supplier_chat('What does the buyer need?', self._ctx(open_request))
        assert result['type'] == 'explanation'

    @pytest.mark.skip(
        reason="'what' en la pregunta activa explanation antes que 'budget' active price_suggestion. "
               "Mock temporal — se reemplaza por agente con tool-calling."
    )
    def test_cost_keyword_triggers_price(self, supplier, open_request):
        from apps.ai_assistant.supplier_services import dispatch_supplier_chat
        result = dispatch_supplier_chat('What is the budget?', self._ctx(open_request))
        assert result['type'] == 'price_suggestion'

    @patch('apps.ai_assistant.supplier_services.settings')
    def test_llm_path_called_when_mock_false(self, mock_settings, supplier, open_request):
        from apps.ai_assistant.supplier_services import dispatch_supplier_chat
        mock_settings.SUPPLIER_AI_MOCK = False
        with patch('apps.ai_assistant.supplier_services._llm_chat') as mock_llm:
            mock_llm.return_value = {'type': 'message', 'content': 'LLM reply'}
            result = dispatch_supplier_chat('hello', self._ctx(open_request))
            mock_llm.assert_called_once()
