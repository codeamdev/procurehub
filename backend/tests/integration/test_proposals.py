"""
Integration tests — Proposal endpoints.

Tests supplier submission rules, buyer/admin visibility,
and the immutability of submitted proposals.
"""
import pytest
from decimal import Decimal

pytestmark = pytest.mark.django_db


def proposals_url(request_pk):
    return f'/api/procurement/requests/{request_pk}/proposals/'


def proposal_detail_url(request_pk, proposal_pk):
    return f'/api/procurement/requests/{request_pk}/proposals/{proposal_pk}/'


VALID_PAYLOAD = {
    'price': '7500.00',
    'delivery_time': 14,
    'message': 'We can deliver on time.',
}


# ══════════════════════════════════════════════════════════════════════════════
# Submit proposal
# ══════════════════════════════════════════════════════════════════════════════

class TestSubmitProposal:
    def test_approved_supplier_can_submit(self, supplier_client, open_request):
        res = supplier_client.post(
            proposals_url(open_request.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        assert res.status_code == 201
        data = res.json()
        assert data['status'] == 'pending'
        assert Decimal(data['price']) == Decimal('7500.00')

    def test_buyer_cannot_submit_proposal(self, buyer_client, open_request):
        res = buyer_client.post(
            proposals_url(open_request.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        assert res.status_code == 403

    def test_unapproved_supplier_cannot_submit(self, unapproved_client, open_request):
        res = unapproved_client.post(
            proposals_url(open_request.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        assert res.status_code == 403

    def test_unauthenticated_cannot_submit(self, api_client, open_request):
        res = api_client.post(
            proposals_url(open_request.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        assert res.status_code == 401

    def test_duplicate_submission_rejected(self, supplier_client, open_request):
        supplier_client.post(
            proposals_url(open_request.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        res = supplier_client.post(
            proposals_url(open_request.pk),
            {**VALID_PAYLOAD, 'price': '6000.00'},
            content_type='application/json',
        )
        assert res.status_code == 409

    def test_submit_to_closed_request_rejected(self, supplier_client, make_request):
        closed = make_request(status='closed')
        res = supplier_client.post(
            proposals_url(closed.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        assert res.status_code == 409

    def test_submit_to_awarded_request_rejected(self, supplier_client, make_request):
        awarded = make_request(status='awarded')
        res = supplier_client.post(
            proposals_url(awarded.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        assert res.status_code == 409

    def test_missing_price_rejected(self, supplier_client, open_request):
        payload = {'delivery_time': 14, 'message': 'No price here'}
        res = supplier_client.post(
            proposals_url(open_request.pk),
            payload,
            content_type='application/json',
        )
        assert res.status_code == 400

    def test_supplier_email_in_response(self, supplier_client, open_request, supplier):
        res = supplier_client.post(
            proposals_url(open_request.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        assert res.json()['supplier_email'] == supplier.email


# ══════════════════════════════════════════════════════════════════════════════
# List proposals
# ══════════════════════════════════════════════════════════════════════════════

class TestListProposals:
    def test_buyer_sees_all_proposals_for_request(self, buyer_client, open_request,
                                                   make_proposal, make_user):
        sup2 = make_user('sup2@list.com', role='supplier', is_approved=True)
        make_proposal()
        make_proposal(sup=sup2)
        res = buyer_client.get(proposals_url(open_request.pk))
        assert res.status_code == 200
        assert res.json()['count'] == 2

    def test_supplier_sees_only_own_proposals(self, supplier_client, open_request,
                                              make_proposal, make_user, supplier):
        sup2 = make_user('sup2@own.com', role='supplier', is_approved=True)
        make_proposal()          # supplier's own
        make_proposal(sup=sup2)  # another supplier's
        res = supplier_client.get(proposals_url(open_request.pk))
        assert res.status_code == 200
        results = res.json()['results']
        emails = {p['supplier_email'] for p in results}
        assert emails == {supplier.email}

    def test_admin_sees_all_proposals(self, admin_client, open_request,
                                      make_proposal, make_user):
        sup2 = make_user('sup2@admin.com', role='supplier', is_approved=True)
        make_proposal()
        make_proposal(sup=sup2)
        res = admin_client.get(proposals_url(open_request.pk))
        assert res.status_code == 200
        assert res.json()['count'] == 2

    def test_unauthenticated_cannot_list(self, api_client, open_request):
        res = api_client.get(proposals_url(open_request.pk))
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# Retrieve proposal
# ══════════════════════════════════════════════════════════════════════════════

class TestRetrieveProposal:
    def test_buyer_can_retrieve_any_proposal(self, buyer_client, open_request, proposal):
        res = buyer_client.get(proposal_detail_url(open_request.pk, proposal.pk))
        assert res.status_code == 200
        assert res.json()['id'] == proposal.pk

    def test_supplier_can_retrieve_own_proposal(self, supplier_client, open_request, proposal):
        res = supplier_client.get(proposal_detail_url(open_request.pk, proposal.pk))
        assert res.status_code == 200

    def test_supplier_cannot_retrieve_others_proposal(self, open_request, make_user,
                                                       make_proposal, tenant):
        from django_tenants.test.client import TenantClient
        from tests.conftest import auth_headers
        sup2 = make_user('s2@retrieve.com', role='supplier', is_approved=True)
        p = make_proposal(sup=sup2)   # sup2's proposal
        # Log in as original supplier (not sup2)
        original_sup = make_user('s1@retrieve.com', role='supplier', is_approved=True)
        client = TenantClient(tenant)
        client.defaults.update(auth_headers(original_sup))
        res = client.get(proposal_detail_url(open_request.pk, p.pk))
        assert res.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# Immutability — proposals cannot be updated or deleted
# ══════════════════════════════════════════════════════════════════════════════

class TestProposalImmutability:
    def test_patch_proposal_not_allowed(self, supplier_client, open_request, proposal):
        res = supplier_client.patch(
            proposal_detail_url(open_request.pk, proposal.pk),
            {'price': '1.00'},
            content_type='application/json',
        )
        assert res.status_code == 405

    def test_delete_proposal_not_allowed(self, buyer_client, open_request, proposal):
        res = buyer_client.delete(proposal_detail_url(open_request.pk, proposal.pk))
        assert res.status_code == 405

    def test_put_proposal_not_allowed(self, supplier_client, open_request, proposal):
        res = supplier_client.put(
            proposal_detail_url(open_request.pk, proposal.pk),
            VALID_PAYLOAD,
            content_type='application/json',
        )
        assert res.status_code == 405
