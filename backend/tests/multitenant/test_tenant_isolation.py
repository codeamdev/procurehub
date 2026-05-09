"""
Multi-tenant isolation tests.

Verifies that data created in one tenant's schema is never visible or
accessible from another tenant.  Two tenants are set up for this module:
- tenant_a  (created by the root conftest — schema 'test')
- tenant_b  (created locally per-class — schema 'test_b')

The key invariants tested:
  1. Users don't bleed across schemas.
  2. ProcurementRequests don't bleed across schemas.
  3. Proposals don't bleed across schemas.
  4. JWT tokens from one tenant are rejected in another.
  5. API responses on tenant_b cannot see tenant_a's objects by PK.
"""
import pytest
from decimal import Decimal
from datetime import date, timedelta

from django.db import connection
from django_tenants.utils import schema_context
from django_tenants.test.client import TenantClient

pytestmark = pytest.mark.django_db(transaction=True)  # needed for cross-schema work


# ══════════════════════════════════════════════════════════════════════════════
# Second-tenant fixture (module-scoped within this file)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope='module')
def tenant_b(django_db_setup, django_db_blocker):
    """Create a second isolated tenant schema for isolation tests."""
    with django_db_blocker.unblock():
        from apps.tenants.models import Company, Domain

        t = Company(schema_name='test_b', name='Corp B')
        t.save(verbosity=0)
        Domain.objects.create(domain='test-b.localhost', tenant=t, is_primary=True)

        yield t

        connection.set_schema_to_public()
        t.delete(force_drop=True)


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _make_user_in(schema, email, role='buyer', password='testpass123'):
    """Create a user inside a specific schema."""
    from apps.accounts.models import User
    with schema_context(schema):
        u = User.objects.create_user(email=email, password=password, role=role)
        u.is_approved = True
        u.save()
        return u


def _make_request_in(schema, user, title='Isolated Request'):
    from apps.procurement.models import ProcurementRequest
    with schema_context(schema):
        return ProcurementRequest.objects.create(
            title=title,
            description='x',
            budget=Decimal('5000'),
            category='IT',
            deadline=date.today() + timedelta(days=30),
            status='open',
            created_by=user,
        )


def _jwt_headers(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {token.access_token}'}


# ══════════════════════════════════════════════════════════════════════════════
# User isolation
# ══════════════════════════════════════════════════════════════════════════════

class TestUserIsolation:
    def test_user_in_tenant_a_not_visible_in_tenant_b(self, tenant, tenant_b):
        """A user created in tenant_a must not appear in tenant_b's User table."""
        user_a = _make_user_in(tenant.schema_name, 'user-a-only@test.com')

        with schema_context(tenant_b.schema_name):
            from apps.accounts.models import User
            assert not User.objects.filter(email='user-a-only@test.com').exists()

    def test_same_email_can_exist_in_both_tenants(self, tenant, tenant_b):
        """Schemas are independent; same email is valid in each."""
        email = 'shared-email@test.com'
        _make_user_in(tenant.schema_name, email)
        # Should not raise — completely separate table
        _make_user_in(tenant_b.schema_name, email)

    def test_user_count_is_independent(self, tenant, tenant_b):
        from apps.accounts.models import User
        _make_user_in(tenant.schema_name, 'count-a@test.com')
        _make_user_in(tenant.schema_name, 'count-a2@test.com')

        with schema_context(tenant_b.schema_name):
            count_b = User.objects.count()

        with schema_context(tenant.schema_name):
            count_a = User.objects.count()

        assert count_a != count_b or count_b == 0   # b has fewer (or none of a's users)


# ══════════════════════════════════════════════════════════════════════════════
# ProcurementRequest isolation
# ══════════════════════════════════════════════════════════════════════════════

class TestRequestIsolation:
    def test_requests_do_not_cross_schemas(self, tenant, tenant_b):
        from apps.procurement.models import ProcurementRequest

        user_a = _make_user_in(tenant.schema_name, 'req-a@test.com')
        req_a = _make_request_in(tenant.schema_name, user_a, 'Tenant A Request')

        with schema_context(tenant_b.schema_name):
            assert not ProcurementRequest.objects.filter(title='Tenant A Request').exists()

    def test_pk_from_tenant_a_not_accessible_in_tenant_b(self, tenant, tenant_b):
        """Querying tenant_b with a PK that exists in tenant_a must return nothing."""
        from apps.procurement.models import ProcurementRequest

        user_a = _make_user_in(tenant.schema_name, 'pk-a@test.com')
        req_a = _make_request_in(tenant.schema_name, user_a)

        with schema_context(tenant_b.schema_name):
            assert not ProcurementRequest.objects.filter(pk=req_a.pk).exists()


# ══════════════════════════════════════════════════════════════════════════════
# Proposal isolation
# ══════════════════════════════════════════════════════════════════════════════

class TestProposalIsolation:
    def test_proposals_do_not_cross_schemas(self, tenant, tenant_b):
        from apps.procurement.models import ProcurementRequest, Proposal

        user_a = _make_user_in(tenant.schema_name, 'prop-buyer@test.com', role='buyer')
        sup_a  = _make_user_in(tenant.schema_name, 'prop-sup@test.com', role='supplier')
        req_a  = _make_request_in(tenant.schema_name, user_a)

        with schema_context(tenant.schema_name):
            Proposal.objects.create(
                request=req_a, supplier=sup_a,
                price=Decimal('4000'), delivery_time=14, message='from A',
            )

        with schema_context(tenant_b.schema_name):
            assert Proposal.objects.count() == 0


# ══════════════════════════════════════════════════════════════════════════════
# API-level cross-tenant access
# ══════════════════════════════════════════════════════════════════════════════

class TestAPIIsolation:
    def test_tenant_b_api_cannot_see_tenant_a_requests(self, tenant, tenant_b):
        """
        A request created in tenant_a must return 404 when fetched via the
        tenant_b API client (different schema context, different data).
        """
        user_a = _make_user_in(tenant.schema_name, 'api-a@test.com', role='buyer')
        req_a  = _make_request_in(tenant.schema_name, user_a, 'Secret Request A')

        # Create a buyer in tenant_b and use their client
        user_b = _make_user_in(tenant_b.schema_name, 'api-b@test.com', role='buyer')
        client_b = TenantClient(tenant_b)
        client_b.defaults.update(_jwt_headers(user_b))

        # Tenant B tries to fetch tenant A's request by PK
        res = client_b.get(f'/api/procurement/requests/{req_a.pk}/')
        assert res.status_code == 404

    def test_tenant_b_list_does_not_include_tenant_a_data(self, tenant, tenant_b):
        user_a = _make_user_in(tenant.schema_name, 'list-a@test.com', role='buyer')
        _make_request_in(tenant.schema_name, user_a, 'A Only Request')

        user_b = _make_user_in(tenant_b.schema_name, 'list-b@test.com', role='buyer')
        client_b = TenantClient(tenant_b)
        client_b.defaults.update(_jwt_headers(user_b))

        res = client_b.get('/api/procurement/requests/')
        assert res.status_code == 200
        titles = [r['title'] for r in res.json()['results']]
        assert 'A Only Request' not in titles

    def test_tenant_a_token_rejected_on_tenant_b_endpoint(self, tenant, tenant_b):
        """
        A JWT issued inside tenant_a's context should fail authentication in
        tenant_b because the user PK doesn't exist in tenant_b's User table.
        The endpoint must return 401.
        """
        user_a = _make_user_in(tenant.schema_name, 'tok-a@test.com', role='buyer')

        client_b = TenantClient(tenant_b)
        client_b.defaults.update(_jwt_headers(user_a))   # token points to tenant_a user

        res = client_b.get('/api/auth/me/')
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# Schema context manager correctness
# ══════════════════════════════════════════════════════════════════════════════

class TestSchemaContext:
    def test_schema_context_switches_and_restores(self, tenant, tenant_b):
        """schema_context must restore the previous schema on exit."""
        original = connection.schema_name

        with schema_context(tenant_b.schema_name):
            assert connection.schema_name == tenant_b.schema_name

        assert connection.schema_name == original

    def test_nested_schema_contexts(self, tenant, tenant_b):
        with schema_context(tenant.schema_name):
            with schema_context(tenant_b.schema_name):
                assert connection.schema_name == tenant_b.schema_name
            assert connection.schema_name == tenant.schema_name
