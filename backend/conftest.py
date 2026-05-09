"""
Root conftest — tenant infrastructure for the entire test suite.

django-tenants requires a real PostgreSQL connection; every test runs
inside a tenant schema.  We create one long-lived schema per session
(fast) and wrap each test in a savepoint (TenantTestCase behaviour).

For tests that need two tenants (isolation tests) a second tenant is
created inside the specific test class — see tests/multitenant/.
"""
import pytest
from django.db import connection
from django_tenants.utils import schema_context


# ── Session-scoped: create the primary test tenant once ──────────────────────

@pytest.fixture(scope='session')
def tenant(django_db_setup, django_db_blocker):
    """
    Create (and yield) a single test tenant for the whole session.
    Dropped on teardown.
    """
    with django_db_blocker.unblock():
        from apps.tenants.models import Company, Domain

        t = Company(schema_name='test', name='Test Corp')
        t.save(verbosity=0)          # auto_create_schema=True creates the PG schema

        Domain.objects.create(domain='test.localhost', tenant=t, is_primary=True)

        connection.set_tenant(t)     # all subsequent DB ops go to 'test' schema
        yield t

        # ── Teardown ────────────────────────────────────────────────────────
        connection.set_schema_to_public()
        t.delete(force_drop=True)    # drops the PG schema and the public row


# ── Convenience: switch connection to tenant before each test ─────────────────

@pytest.fixture(autouse=True)
def use_tenant_schema(tenant):
    """Ensure every test runs inside the primary tenant's schema."""
    connection.set_tenant(tenant)
    yield
    connection.set_tenant(tenant)    # restore after test (no-op if unchanged)
