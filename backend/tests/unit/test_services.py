"""
Unit tests — accounts and procurement service layer.

Services are called directly (no HTTP).  The test verifies business rules,
exception types, and state transitions without touching OpenAI.
"""
import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock

from apps.common.exceptions import ConflictError, NotFoundError, AppError

pytestmark = pytest.mark.django_db


# ══════════════════════════════════════════════════════════════════════════════
# accounts.services
# ══════════════════════════════════════════════════════════════════════════════

class TestIssueTokens:
    def test_returns_access_and_refresh(self, buyer):
        from apps.accounts.services import issue_tokens
        tokens = issue_tokens(buyer)
        assert 'access' in tokens
        assert 'refresh' in tokens

    def test_tokens_are_strings(self, buyer):
        from apps.accounts.services import issue_tokens
        tokens = issue_tokens(buyer)
        assert isinstance(tokens['access'], str)
        assert isinstance(tokens['refresh'], str)


class TestBlacklistToken:
    def test_blacklists_valid_token(self, buyer):
        from apps.accounts.services import issue_tokens, blacklist_token
        tokens = issue_tokens(buyer)
        blacklist_token(tokens['refresh'])   # should not raise

    def test_raises_on_empty_token(self):
        from apps.accounts.services import blacklist_token
        with pytest.raises(AppError):
            blacklist_token('')

    def test_raises_on_garbage_token(self):
        from apps.accounts.services import blacklist_token
        with pytest.raises(AppError):
            blacklist_token('not.a.real.jwt')


class TestAuthenticateUser:
    def test_valid_credentials(self, buyer, rf):
        from apps.accounts.services import authenticate_user
        request = rf.post('/')
        user, tokens = authenticate_user(request, 'buyer@example.com', 'testpass123')
        assert user.pk == buyer.pk
        assert 'access' in tokens

    def test_wrong_password(self, buyer, rf):
        from apps.accounts.services import authenticate_user
        request = rf.post('/')
        with pytest.raises(AppError):
            authenticate_user(request, 'buyer@example.com', 'wrongpassword')

    def test_missing_credentials(self, rf):
        from apps.accounts.services import authenticate_user
        request = rf.post('/')
        with pytest.raises(AppError):
            authenticate_user(request, '', '')

    def test_nonexistent_user(self, rf):
        from apps.accounts.services import authenticate_user
        request = rf.post('/')
        with pytest.raises(AppError):
            authenticate_user(request, 'nobody@example.com', 'pass')


class TestApproveSupplier:
    def test_approves_pending_supplier(self, admin, unapproved_supplier):
        from apps.accounts.services import approve_supplier
        result = approve_supplier(admin, unapproved_supplier.pk)
        result.refresh_from_db()
        assert result.is_approved is True

    def test_raises_if_already_approved(self, admin, supplier):
        from apps.accounts.services import approve_supplier
        with pytest.raises(ConflictError):
            approve_supplier(admin, supplier.pk)

    def test_raises_if_supplier_not_found(self, admin):
        from apps.accounts.services import approve_supplier
        with pytest.raises(NotFoundError):
            approve_supplier(admin, 99999)


class TestRejectSupplier:
    def test_rejects_pending_supplier(self, admin, unapproved_supplier):
        from apps.accounts.services import reject_supplier
        result = reject_supplier(admin, unapproved_supplier.pk)
        result.refresh_from_db()
        assert result.is_approved is False
        assert result.is_active is False   # reject deactivates the account

    def test_raises_if_not_found(self, admin):
        from apps.accounts.services import reject_supplier
        with pytest.raises(NotFoundError):
            reject_supplier(admin, 99999)


# ══════════════════════════════════════════════════════════════════════════════
# procurement.services
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateProcurementRequest:
    def test_creates_with_correct_fields(self, buyer):
        from apps.procurement.services import create_procurement_request
        from datetime import date, timedelta
        data = {
            'title': 'New Laptops',
            'description': 'We need 50 laptops',
            'budget': Decimal('25000.00'),
            'category': 'IT',
            'deadline': date.today() + timedelta(days=30),
        }
        req = create_procurement_request(buyer, data)
        assert req.pk is not None
        assert req.title == 'New Laptops'
        assert req.created_by == buyer
        assert req.status == 'open'

    def test_returned_object_is_persisted(self, buyer):
        from apps.procurement.services import create_procurement_request
        from apps.procurement.models import ProcurementRequest
        from datetime import date, timedelta
        data = {
            'title': 'Persisted',
            'description': 'x',
            'budget': Decimal('1000'),
            'category': 'Office',
            'deadline': date.today() + timedelta(days=10),
        }
        req = create_procurement_request(buyer, data)
        assert ProcurementRequest.objects.filter(pk=req.pk).exists()


class TestCloseProcurementRequest:
    def test_closes_open_request(self, buyer, open_request):
        from apps.procurement.services import close_procurement_request
        closed = close_procurement_request(buyer, open_request)
        assert closed.status == 'closed'

    def test_raises_if_already_closed(self, buyer, make_request):
        from apps.procurement.services import close_procurement_request
        req = make_request(status='closed')
        with pytest.raises(ConflictError):
            close_procurement_request(buyer, req)

    def test_raises_if_already_awarded(self, buyer, make_request):
        from apps.procurement.services import close_procurement_request
        req = make_request(status='awarded')
        with pytest.raises(ConflictError):
            close_procurement_request(buyer, req)


class TestAwardProcurementRequest:
    def test_awards_correct_proposal(self, buyer, open_request, proposal):
        from apps.procurement.services import award_procurement_request
        from apps.procurement.models import Proposal
        req = award_procurement_request(buyer, open_request, proposal.pk)
        proposal.refresh_from_db()
        assert req.status == 'awarded'
        assert proposal.status == 'accepted'

    def test_rejects_other_proposals(self, buyer, open_request, make_proposal, make_user):
        from apps.procurement.services import award_procurement_request
        sup2 = make_user('other@test.com', role='supplier', is_approved=True)
        p1 = make_proposal()
        p2 = make_proposal(sup=sup2)
        award_procurement_request(buyer, open_request, p1.pk)
        p2.refresh_from_db()
        assert p2.status == 'rejected'

    def test_raises_if_request_not_open(self, buyer, make_request, make_proposal):
        from apps.procurement.services import award_procurement_request
        req = make_request(status='closed')
        p = make_proposal(request=req)
        with pytest.raises(ConflictError):
            award_procurement_request(buyer, req, p.pk)

    def test_raises_if_proposal_not_found(self, buyer, open_request):
        from apps.procurement.services import award_procurement_request
        with pytest.raises(NotFoundError):
            award_procurement_request(buyer, open_request, 99999)


class TestSubmitProposal:
    def test_creates_proposal(self, supplier, open_request):
        from apps.procurement.services import submit_proposal
        p = submit_proposal(supplier, open_request, {
            'price': Decimal('7500'),
            'delivery_time': 21,
            'message': 'Our offer',
        })
        assert p.pk is not None
        assert p.supplier == supplier
        assert p.request == open_request
        assert p.status == 'pending'

    def test_raises_on_duplicate_submission(self, supplier, open_request):
        from apps.procurement.services import submit_proposal
        submit_proposal(supplier, open_request, {
            'price': Decimal('7500'), 'delivery_time': 14, 'message': 'First',
        })
        with pytest.raises(ConflictError):
            submit_proposal(supplier, open_request, {
                'price': Decimal('6000'), 'delivery_time': 10, 'message': 'Second',
            })

    def test_raises_if_request_not_open(self, supplier, make_request):
        from apps.procurement.services import submit_proposal
        req = make_request(status='closed')
        with pytest.raises(ConflictError):
            submit_proposal(supplier, req, {
                'price': Decimal('5000'), 'delivery_time': 7, 'message': 'Late',
            })


# ══════════════════════════════════════════════════════════════════════════════
# ai_assistant.services (buyer-side, OpenAI mocked)
# ══════════════════════════════════════════════════════════════════════════════

class TestBuildContext:
    def test_returns_requests_and_suppliers(self, open_request, supplier):
        from apps.ai_assistant.services import build_context
        ctx = build_context('test')
        assert 'requests' in ctx
        assert 'suppliers' in ctx

    def test_includes_current_request_when_id_provided(self, open_request):
        from apps.ai_assistant.services import build_context
        ctx = build_context('test', request_id=open_request.pk)
        assert 'current_request' in ctx
        assert ctx['current_request']['id'] == open_request.pk

    def test_raises_if_request_not_found(self):
        from apps.ai_assistant.services import build_context
        with pytest.raises(NotFoundError):
            build_context('test', request_id=99999)


class TestHandleAIResponse:
    def test_message_type_passthrough(self, buyer):
        from apps.ai_assistant.services import handle_ai_response
        ai_resp = {'type': 'message', 'content': 'Hello'}
        result = handle_ai_response(ai_resp, buyer, 'test')
        assert result == ai_resp

    def test_create_request_returns_preview(self, buyer):
        from apps.ai_assistant.services import handle_ai_response
        ai_resp = {
            'type': 'create_request',
            'data': {
                'title': 'Keyboards',
                'description': 'Need 20 keyboards',
                'budget': 2000,
                'category': 'IT',
                'deadline': '2025-12-31',
            },
        }
        result = handle_ai_response(ai_resp, buyer, 'test')
        assert result['type'] == 'create_request'
        assert result.get('requires_confirmation') is True

    def test_recommend_suppliers_returns_list(self, buyer, supplier):
        from apps.ai_assistant.services import handle_ai_response
        ai_resp = {'type': 'recommend_suppliers', 'category': 'IT', 'reason': 'Best fit'}
        result = handle_ai_response(ai_resp, buyer, 'test')
        assert result['type'] == 'recommend_suppliers'
        assert 'suppliers' in result


class TestCallOpenAI:
    @patch('apps.ai_assistant.services.openai')
    def test_returns_parsed_json_on_success(self, mock_openai):
        from apps.ai_assistant.services import call_openai
        mock_choice = MagicMock()
        mock_choice.message.content = '{"type": "message", "content": "Hi"}'
        mock_openai.chat.completions.create.return_value = MagicMock(choices=[mock_choice])
        result = call_openai([{'role': 'user', 'content': 'Hello'}])
        assert result == {'type': 'message', 'content': 'Hi'}

    @patch('apps.ai_assistant.services.openai')
    def test_returns_fallback_on_api_error(self, mock_openai):
        from apps.ai_assistant.services import call_openai
        mock_openai.chat.completions.create.side_effect = Exception('API down')
        result = call_openai([{'role': 'user', 'content': 'Hello'}])
        assert result.get('type') == 'message'   # graceful fallback
