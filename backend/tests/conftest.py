"""
Shared fixtures available to all test modules.

All fixtures that touch the DB are function-scoped so each test starts
with a clean slate (the root conftest wraps everything in a transaction
via TenantTestCase semantics; here we just do it explicitly with db).
"""
import pytest
from decimal import Decimal
from datetime import date, timedelta
from rest_framework_simplejwt.tokens import RefreshToken
from django_tenants.test.client import TenantClient


# ── Users ─────────────────────────────────────────────────────────────────────

@pytest.fixture
def make_user(db):
    """Factory for creating users with any role inside the active tenant."""
    from apps.accounts.models import User

    def _make(email, password='testpass123', role='buyer', is_approved=None):
        if is_approved is None:
            is_approved = role != 'supplier'
        user = User.objects.create_user(email=email, password=password, role=role)
        user.is_approved = is_approved
        user.save()
        return user

    return _make


@pytest.fixture
def buyer(make_user):
    return make_user('buyer@example.com', role='buyer')


@pytest.fixture
def admin(make_user):
    return make_user('admin@example.com', role='admin')


@pytest.fixture
def supplier(make_user):
    return make_user('supplier@example.com', role='supplier', is_approved=True)


@pytest.fixture
def unapproved_supplier(make_user):
    return make_user('pending@example.com', role='supplier', is_approved=False)


# ── JWT auth headers ──────────────────────────────────────────────────────────

def auth_headers(user):
    """Return Authorization headers dict for the given user."""
    token = RefreshToken.for_user(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {token.access_token}'}


@pytest.fixture
def buyer_headers(buyer):
    return auth_headers(buyer)


@pytest.fixture
def admin_headers(admin):
    return auth_headers(admin)


@pytest.fixture
def supplier_headers(supplier):
    return auth_headers(supplier)


@pytest.fixture
def unapproved_headers(unapproved_supplier):
    return auth_headers(unapproved_supplier)


# ── Procurement objects ───────────────────────────────────────────────────────

@pytest.fixture
def make_request(db, buyer):
    """Factory: create a ProcurementRequest owned by buyer."""
    from apps.procurement.models import ProcurementRequest

    def _make(
        title='Test Request',
        budget=Decimal('10000.00'),
        category='IT',
        deadline=None,
        status='open',
        created_by=None,
    ):
        return ProcurementRequest.objects.create(
            title=title,
            description='Test description',
            budget=budget,
            category=category,
            deadline=deadline or (date.today() + timedelta(days=30)),
            status=status,
            created_by=created_by or buyer,
        )

    return _make


@pytest.fixture
def open_request(make_request):
    return make_request()


@pytest.fixture
def make_proposal(db, supplier, open_request):
    """Factory: create a Proposal for an existing request."""
    from apps.procurement.models import Proposal

    def _make(
        request=None,
        sup=None,
        price=Decimal('8000.00'),
        delivery_time=14,
        message='Our proposal',
    ):
        return Proposal.objects.create(
            request=request or open_request,
            supplier=sup or supplier,
            price=price,
            delivery_time=delivery_time,
            message=message,
        )

    return _make


@pytest.fixture
def proposal(make_proposal):
    return make_proposal()


# ── HTTP clients ──────────────────────────────────────────────────────────────

@pytest.fixture
def api_client(tenant):
    """Unauthenticated TenantClient."""
    return TenantClient(tenant)


@pytest.fixture
def buyer_client(tenant, buyer):
    client = TenantClient(tenant)
    client.defaults.update(auth_headers(buyer))
    return client


@pytest.fixture
def admin_client(tenant, admin):
    client = TenantClient(tenant)
    client.defaults.update(auth_headers(admin))
    return client


@pytest.fixture
def supplier_client(tenant, supplier):
    client = TenantClient(tenant)
    client.defaults.update(auth_headers(supplier))
    return client


@pytest.fixture
def unapproved_client(tenant, unapproved_supplier):
    client = TenantClient(tenant)
    client.defaults.update(auth_headers(unapproved_supplier))
    return client
