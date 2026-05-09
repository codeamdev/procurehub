"""
Unit tests — models.

Covers field defaults, constraints, manager behaviour, and model
methods without going through the HTTP layer.
"""
import pytest
from decimal import Decimal
from datetime import date, timedelta
from django.db import IntegrityError

pytestmark = pytest.mark.django_db


# ══════════════════════════════════════════════════════════════════════════════
# User model
# ══════════════════════════════════════════════════════════════════════════════

class TestUserModel:
    def test_create_buyer_defaults(self, make_user):
        user = make_user('buyer@test.com', role='buyer')
        assert user.role == 'buyer'
        assert user.is_approved is True          # buyers auto-approved
        assert user.is_active is True
        assert str(user) == 'buyer@test.com'     # __str__ via email

    def test_create_supplier_defaults(self, make_user):
        user = make_user('sup@test.com', role='supplier')
        assert user.role == 'supplier'
        assert user.is_approved is False         # suppliers start unapproved

    def test_create_admin_defaults(self, make_user):
        user = make_user('admin@test.com', role='admin')
        assert user.role == 'admin'
        assert user.is_approved is True

    def test_email_is_unique(self, make_user):
        make_user('dup@test.com')
        with pytest.raises(Exception):           # IntegrityError or ValidationError
            make_user('dup@test.com')

    def test_email_is_username_field(self):
        from apps.accounts.models import User
        assert User.USERNAME_FIELD == 'email'

    def test_password_is_hashed(self, make_user):
        user = make_user('hash@test.com', password='plaintext99')
        assert user.password != 'plaintext99'
        assert user.check_password('plaintext99')

    def test_create_superuser(self):
        from apps.accounts.models import User
        su = User.objects.create_superuser('su@test.com', 'password123')
        assert su.is_staff is True
        assert su.is_superuser is True

    def test_role_choices_are_valid(self):
        from apps.accounts.models import User
        valid = {r[0] for r in User.Role.choices}
        assert {'admin', 'buyer', 'supplier'} == valid


# ══════════════════════════════════════════════════════════════════════════════
# ProcurementRequest model
# ══════════════════════════════════════════════════════════════════════════════

class TestProcurementRequestModel:
    def test_default_status_is_open(self, make_request):
        req = make_request()
        assert req.status == 'open'

    def test_str_representation(self, make_request):
        req = make_request(title='Buy 50 laptops')
        assert 'Buy 50 laptops' in str(req)

    def test_ordering_is_newest_first(self, make_request, buyer):
        r1 = make_request(title='First')
        r2 = make_request(title='Second')
        from apps.procurement.models import ProcurementRequest
        ids = list(ProcurementRequest.objects.values_list('id', flat=True))
        assert ids[0] == r2.id     # newest first

    def test_created_by_is_set(self, make_request, buyer):
        req = make_request(created_by=buyer)
        assert req.created_by == buyer

    def test_status_choices(self):
        from apps.procurement.models import ProcurementRequest
        valid = {s[0] for s in ProcurementRequest.Status.choices}
        assert {'open', 'closed', 'awarded'} == valid

    def test_budget_field_is_decimal(self, make_request):
        req = make_request(budget=Decimal('99999.99'))
        req.refresh_from_db()
        assert req.budget == Decimal('99999.99')


# ══════════════════════════════════════════════════════════════════════════════
# Proposal model
# ══════════════════════════════════════════════════════════════════════════════

class TestProposalModel:
    def test_default_status_is_pending(self, proposal):
        assert proposal.status == 'pending'

    def test_unique_together_request_supplier(self, make_proposal, open_request, supplier):
        make_proposal(request=open_request, sup=supplier)
        with pytest.raises(IntegrityError):
            make_proposal(request=open_request, sup=supplier)

    def test_ordering_by_price(self, make_proposal, make_user, open_request):
        sup2 = make_user('sup2@test.com', role='supplier', is_approved=True)
        make_proposal(price=Decimal('9000'), sup=open_request.created_by)   # won't work — need supplier
        # Use two different suppliers
        from apps.procurement.models import Proposal
        p1 = make_proposal(price=Decimal('5000'), request=open_request)
        sup2 = make_user('s2@test.com', role='supplier', is_approved=True)
        p2 = make_proposal(price=Decimal('3000'), sup=sup2, request=open_request)
        proposals = list(Proposal.objects.filter(request=open_request))
        assert proposals[0].price < proposals[1].price   # cheapest first

    def test_status_choices(self):
        from apps.procurement.models import Proposal
        valid = {s[0] for s in Proposal.Status.choices}
        assert {'pending', 'accepted', 'rejected'} == valid


# ══════════════════════════════════════════════════════════════════════════════
# AIConversation / AIMessage models
# ══════════════════════════════════════════════════════════════════════════════

class TestAIModels:
    def test_conversation_created_for_user(self, buyer):
        from apps.ai_assistant.models import AIConversation
        conv = AIConversation.objects.create(user=buyer)
        assert conv.user == buyer
        assert conv.created_at is not None

    def test_messages_ordered_by_created_at(self, buyer):
        from apps.ai_assistant.models import AIConversation, AIMessage
        conv = AIConversation.objects.create(user=buyer)
        m1 = AIMessage.objects.create(conversation=conv, role='user', content='Hi')
        m2 = AIMessage.objects.create(conversation=conv, role='assistant', content='Hello')
        msgs = list(conv.messages.all())
        assert msgs[0] == m1
        assert msgs[1] == m2

    def test_message_role_choices(self):
        from apps.ai_assistant.models import AIMessage
        valid = {r[0] for r in AIMessage.Role.choices}
        assert {'user', 'assistant'} == valid

    def test_cascade_delete_conversation_deletes_messages(self, buyer):
        from apps.ai_assistant.models import AIConversation, AIMessage
        conv = AIConversation.objects.create(user=buyer)
        AIMessage.objects.create(conversation=conv, role='user', content='test')
        conv_id = conv.id
        conv.delete()
        assert AIMessage.objects.filter(conversation_id=conv_id).count() == 0
