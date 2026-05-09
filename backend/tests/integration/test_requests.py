"""
Integration tests — ProcurementRequest endpoints.

Covers CRUD access control, supplier visibility rules,
and the close/award lifecycle actions.
"""
import pytest
from decimal import Decimal
from datetime import date, timedelta

pytestmark = pytest.mark.django_db

LIST_URL = '/api/procurement/requests/'


def detail_url(pk):
    return f'/api/procurement/requests/{pk}/'


def close_url(pk):
    return f'/api/procurement/requests/{pk}/close/'


def award_url(pk):
    return f'/api/procurement/requests/{pk}/award/'


# ══════════════════════════════════════════════════════════════════════════════
# List / retrieve
# ══════════════════════════════════════════════════════════════════════════════

class TestListRequests:
    def test_buyer_sees_all_requests(self, buyer_client, make_request):
        make_request(title='Open')
        make_request(title='Closed', status='closed')
        res = buyer_client.get(LIST_URL)
        assert res.status_code == 200
        assert res.json()['count'] >= 2

    def test_approved_supplier_sees_only_open(self, supplier_client, make_request):
        make_request(title='Open One')
        make_request(title='Closed One', status='closed')
        res = supplier_client.get(LIST_URL)
        assert res.status_code == 200
        results = res.json()['results']
        statuses = {r['status'] for r in results}
        assert statuses == {'open'} or statuses == set()   # closed requests not visible

    def test_unapproved_supplier_sees_nothing(self, unapproved_client, make_request):
        make_request()
        res = unapproved_client.get(LIST_URL)
        assert res.status_code == 200
        assert res.json()['count'] == 0

    def test_unauthenticated_is_rejected(self, api_client):
        res = api_client.get(LIST_URL)
        assert res.status_code == 401


class TestRetrieveRequest:
    def test_buyer_can_retrieve_any_request(self, buyer_client, open_request):
        res = buyer_client.get(detail_url(open_request.pk))
        assert res.status_code == 200
        assert res.json()['id'] == open_request.pk

    def test_supplier_can_retrieve_open_request(self, supplier_client, open_request):
        res = supplier_client.get(detail_url(open_request.pk))
        assert res.status_code == 200

    def test_supplier_cannot_retrieve_closed_request(self, supplier_client, make_request):
        req = make_request(status='closed')
        res = supplier_client.get(detail_url(req.pk))
        assert res.status_code == 404

    def test_nonexistent_returns_404(self, buyer_client):
        res = buyer_client.get(detail_url(99999))
        assert res.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# Create
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateRequest:
    PAYLOAD = {
        'title': 'Office chairs',
        'description': 'Need 100 ergonomic chairs',
        'budget': '15000.00',
        'category': 'Furniture',
        'deadline': str(date.today() + timedelta(days=30)),
    }

    def test_buyer_can_create(self, buyer_client, buyer):
        res = buyer_client.post(LIST_URL, self.PAYLOAD, content_type='application/json')
        assert res.status_code == 201
        data = res.json()
        assert data['title'] == 'Office chairs'
        assert data['status'] == 'open'
        assert data['created_by_email'] == buyer.email

    def test_admin_can_create(self, admin_client):
        res = admin_client.post(LIST_URL, self.PAYLOAD, content_type='application/json')
        assert res.status_code == 201

    def test_supplier_cannot_create(self, supplier_client):
        res = supplier_client.post(LIST_URL, self.PAYLOAD, content_type='application/json')
        assert res.status_code == 403

    def test_zero_budget_rejected(self, buyer_client):
        payload = {**self.PAYLOAD, 'budget': '0.00'}
        res = buyer_client.post(LIST_URL, payload, content_type='application/json')
        assert res.status_code == 400

    def test_negative_budget_rejected(self, buyer_client):
        payload = {**self.PAYLOAD, 'budget': '-100.00'}
        res = buyer_client.post(LIST_URL, payload, content_type='application/json')
        assert res.status_code == 400

    def test_missing_title_rejected(self, buyer_client):
        payload = {k: v for k, v in self.PAYLOAD.items() if k != 'title'}
        res = buyer_client.post(LIST_URL, payload, content_type='application/json')
        assert res.status_code == 400

    def test_created_request_appears_in_list(self, buyer_client):
        buyer_client.post(LIST_URL, self.PAYLOAD, content_type='application/json')
        res = buyer_client.get(LIST_URL)
        titles = [r['title'] for r in res.json()['results']]
        assert 'Office chairs' in titles


# ══════════════════════════════════════════════════════════════════════════════
# Close request
# ══════════════════════════════════════════════════════════════════════════════

class TestCloseRequest:
    def test_buyer_can_close_open_request(self, buyer_client, open_request):
        res = buyer_client.post(close_url(open_request.pk))
        assert res.status_code == 200
        assert res.json()['status'] == 'closed'

    def test_admin_can_close_request(self, admin_client, open_request):
        res = admin_client.post(close_url(open_request.pk))
        assert res.status_code == 200

    def test_supplier_cannot_close(self, supplier_client, open_request):
        res = supplier_client.post(close_url(open_request.pk))
        assert res.status_code == 403

    def test_closing_already_closed_returns_conflict(self, buyer_client, make_request):
        req = make_request(status='closed')
        res = buyer_client.post(close_url(req.pk))
        assert res.status_code == 409

    def test_closing_awarded_returns_conflict(self, buyer_client, make_request):
        req = make_request(status='awarded')
        res = buyer_client.post(close_url(req.pk))
        assert res.status_code == 409


# ══════════════════════════════════════════════════════════════════════════════
# Award request
# ══════════════════════════════════════════════════════════════════════════════

class TestAwardRequest:
    def test_buyer_can_award_open_request(self, buyer_client, open_request, proposal):
        res = buyer_client.post(
            award_url(open_request.pk),
            {'proposal_id': proposal.pk},
            content_type='application/json',
        )
        assert res.status_code == 200
        assert res.json()['status'] == 'awarded'

    def test_awarded_proposal_status_accepted(self, buyer_client, open_request, proposal):
        buyer_client.post(
            award_url(open_request.pk),
            {'proposal_id': proposal.pk},
            content_type='application/json',
        )
        proposal.refresh_from_db()
        assert proposal.status == 'accepted'

    def test_other_proposals_rejected_on_award(self, buyer_client, open_request,
                                               make_proposal, make_user):
        sup2 = make_user('other@award.com', role='supplier', is_approved=True)
        p1 = make_proposal()
        p2 = make_proposal(sup=sup2)
        buyer_client.post(
            award_url(open_request.pk),
            {'proposal_id': p1.pk},
            content_type='application/json',
        )
        p2.refresh_from_db()
        assert p2.status == 'rejected'

    def test_supplier_cannot_award(self, supplier_client, open_request, proposal):
        res = supplier_client.post(
            award_url(open_request.pk),
            {'proposal_id': proposal.pk},
            content_type='application/json',
        )
        assert res.status_code == 403

    def test_award_nonexistent_proposal_returns_404(self, buyer_client, open_request):
        res = buyer_client.post(
            award_url(open_request.pk),
            {'proposal_id': 99999},
            content_type='application/json',
        )
        assert res.status_code == 404

    def test_award_already_awarded_returns_conflict(self, buyer_client, make_request, proposal):
        req = make_request(status='awarded')
        res = buyer_client.post(
            award_url(req.pk),
            {'proposal_id': proposal.pk},
            content_type='application/json',
        )
        assert res.status_code == 409
