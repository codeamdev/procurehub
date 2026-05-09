"""
Integration tests — authentication endpoints.

Uses TenantClient so that django-tenants middleware resolves the schema
correctly on every request.
"""
import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/auth/register/
# ══════════════════════════════════════════════════════════════════════════════

class TestRegister:
    URL = '/api/auth/register/'

    def test_buyer_registration_succeeds(self, api_client):
        payload = {'email': 'newbuyer@test.com', 'password': 'secure1234', 'role': 'buyer'}
        res = api_client.post(self.URL, payload, content_type='application/json')
        assert res.status_code == 201
        data = res.json()
        assert 'access' in data
        assert 'refresh' in data
        assert data['user']['role'] == 'buyer'
        assert data['user']['is_approved'] is True

    def test_supplier_registration_starts_unapproved(self, api_client):
        payload = {'email': 'newsup@test.com', 'password': 'secure1234', 'role': 'supplier'}
        res = api_client.post(self.URL, payload, content_type='application/json')
        assert res.status_code == 201
        assert res.json()['user']['is_approved'] is False

    def test_duplicate_email_rejected(self, api_client, buyer):
        payload = {'email': buyer.email, 'password': 'secure1234', 'role': 'buyer'}
        res = api_client.post(self.URL, payload, content_type='application/json')
        assert res.status_code == 400

    def test_short_password_rejected(self, api_client):
        payload = {'email': 'short@test.com', 'password': '123', 'role': 'buyer'}
        res = api_client.post(self.URL, payload, content_type='application/json')
        assert res.status_code == 400

    def test_invalid_role_rejected(self, api_client):
        payload = {'email': 'x@test.com', 'password': 'secure1234', 'role': 'superadmin'}
        res = api_client.post(self.URL, payload, content_type='application/json')
        assert res.status_code == 400

    def test_missing_email_rejected(self, api_client):
        payload = {'password': 'secure1234', 'role': 'buyer'}
        res = api_client.post(self.URL, payload, content_type='application/json')
        assert res.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/auth/login/
# ══════════════════════════════════════════════════════════════════════════════

class TestLogin:
    URL = '/api/auth/login/'

    def test_valid_credentials_return_tokens(self, api_client, buyer):
        res = api_client.post(self.URL, {'email': buyer.email, 'password': 'testpass123'},
                              content_type='application/json')
        assert res.status_code == 200
        data = res.json()
        assert 'access' in data
        assert 'refresh' in data
        assert data['user']['email'] == buyer.email

    def test_wrong_password_rejected(self, api_client, buyer):
        res = api_client.post(self.URL, {'email': buyer.email, 'password': 'wrongpass'},
                              content_type='application/json')
        assert res.status_code == 400

    def test_nonexistent_email_rejected(self, api_client):
        res = api_client.post(self.URL, {'email': 'ghost@test.com', 'password': 'pass'},
                              content_type='application/json')
        assert res.status_code == 400

    def test_missing_fields_rejected(self, api_client):
        res = api_client.post(self.URL, {}, content_type='application/json')
        assert res.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/auth/logout/
# ══════════════════════════════════════════════════════════════════════════════

class TestLogout:
    URL = '/api/auth/logout/'

    def test_logout_blacklists_token(self, buyer_client, buyer):
        from apps.accounts.services import issue_tokens
        tokens = issue_tokens(buyer)
        res = buyer_client.post(self.URL, {'refresh': tokens['refresh']},
                                content_type='application/json')
        assert res.status_code == 200

    def test_logout_requires_authentication(self, api_client):
        res = api_client.post(self.URL, {'refresh': 'some-token'},
                              content_type='application/json')
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/auth/me/
# ══════════════════════════════════════════════════════════════════════════════

class TestMe:
    URL = '/api/auth/me/'

    def test_returns_current_user(self, buyer_client, buyer):
        res = buyer_client.get(self.URL)
        assert res.status_code == 200
        data = res.json()
        assert data['email'] == buyer.email
        assert data['role'] == 'buyer'

    def test_requires_authentication(self, api_client):
        res = api_client.get(self.URL)
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# Supplier approval — /api/auth/suppliers/
# ══════════════════════════════════════════════════════════════════════════════

class TestSupplierApproval:
    LIST_URL = '/api/auth/suppliers/'

    def _approve_url(self, pk):
        return f'/api/auth/suppliers/{pk}/approve/'

    def _reject_url(self, pk):
        return f'/api/auth/suppliers/{pk}/reject/'

    def test_admin_can_list_pending_suppliers(self, admin_client, unapproved_supplier):
        res = admin_client.get(self.LIST_URL)
        assert res.status_code == 200
        ids = [s['id'] for s in res.json()]
        assert unapproved_supplier.pk in ids

    def test_buyer_cannot_list_suppliers(self, buyer_client):
        res = buyer_client.get(self.LIST_URL)
        assert res.status_code == 403

    def test_admin_can_approve_supplier(self, admin_client, unapproved_supplier):
        res = admin_client.post(self._approve_url(unapproved_supplier.pk))
        assert res.status_code == 200
        unapproved_supplier.refresh_from_db()
        assert unapproved_supplier.is_approved is True

    def test_admin_can_reject_supplier(self, admin_client, unapproved_supplier):
        res = admin_client.post(self._reject_url(unapproved_supplier.pk))
        assert res.status_code == 200
        unapproved_supplier.refresh_from_db()
        assert unapproved_supplier.is_approved is False

    def test_approve_nonexistent_returns_404(self, admin_client):
        res = admin_client.post(self._approve_url(99999))
        assert res.status_code == 404

    def test_double_approve_returns_conflict(self, admin_client, supplier):
        res = admin_client.post(self._approve_url(supplier.pk))
        assert res.status_code == 409

    def test_unauthenticated_cannot_approve(self, api_client, unapproved_supplier):
        res = api_client.post(self._approve_url(unapproved_supplier.pk))
        assert res.status_code == 401
