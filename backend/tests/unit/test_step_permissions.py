"""
Tests for step-level permission functions in apps/workflows/permissions.py.

Covers:
  - can_view_request()
  - can_edit_step()
  - can_execute_action()
  - get_accessible_step_ids()

Permission model: signals.py creates 3 Django Permissions per Step on post_save:
  codename  step_view_{uuid_hex}
  codename  step_edit_{uuid_hex}
  codename  step_execute_{uuid_hex}
  app_label workflows
"""
import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType

from apps.workflows.models import (
    WorkflowDefinition,
    Step,
    Request,
    RequestHistory,
)
from apps.workflows.permissions import (
    can_view_request,
    can_edit_step,
    can_execute_action,
    get_accessible_step_ids,
)

pytestmark = pytest.mark.django_db


# ── Helper ────────────────────────────────────────────────────────────────────

def _grant(user, step, perm_type):
    """
    Assign a step permission directly to the user and clear the permission
    cache so Django re-evaluates has_perm() on the next call.

    Django's ModelBackend stores computed permission sets in two instance
    attributes that are lazily populated on first use.  Deleting them (if
    present) forces the backend to re-query the DB on the next has_perm()
    call, which picks up the permission we just added.
    """
    ct = ContentType.objects.get_for_model(Step)
    codename = f"{perm_type}_{str(step.id).replace('-', '')}"
    perm = Permission.objects.get(codename=codename, content_type=ct)
    user.user_permissions.add(perm)
    # Bust the two lazy caches (only exist after first has_perm() call).
    for attr in ('_perm_cache', '_user_perm_cache'):
        try:
            delattr(user, attr)
        except AttributeError:
            pass


# ── Local fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
def workflow_with_step(make_user):
    """Return (WorkflowDefinition, Step) with signals having created perms."""
    creator = make_user('wf-creator@test.com', role='admin')
    wf = WorkflowDefinition.objects.create(
        name='Perm WF',
        status='active',
        created_by=creator,
    )
    step = Step.objects.create(
        workflow=wf,
        name='Paso 1',
        order=0,
        is_initial=True,
    )
    return wf, step


@pytest.fixture
def active_req(workflow_with_step, make_user):
    """Return (Request, Step, owner) where the request is ACTIVE."""
    wf, step = workflow_with_step
    owner = make_user('owner@test.com', role='admin')
    req = Request.objects.create(
        workflow_definition=wf,
        current_step=step,
        created_by=owner,
        code='TEST-0001',
        title='Test Request',
        status=Request.Status.ACTIVE,
    )
    return req, step, owner


@pytest.fixture
def completed_req(workflow_with_step, make_user):
    """Return (Request, Step, owner) where the request is COMPLETED (current_step=None)."""
    wf, step = workflow_with_step
    owner = make_user('owner-done@test.com', role='admin')
    req = Request.objects.create(
        workflow_definition=wf,
        current_step=None,
        created_by=owner,
        code='TEST-0002',
        title='Completed Request',
        status=Request.Status.COMPLETED,
    )
    return req, step, owner


@pytest.fixture
def cancelled_req(workflow_with_step, make_user):
    """Return (Request, Step, owner) where the request is CANCELLED."""
    wf, step = workflow_with_step
    owner = make_user('owner-cancel@test.com', role='admin')
    req = Request.objects.create(
        workflow_definition=wf,
        current_step=None,
        created_by=owner,
        code='TEST-0003',
        title='Cancelled Request',
        status=Request.Status.CANCELLED,
    )
    return req, step, owner


# ── TestCanViewRequest ────────────────────────────────────────────────────────

class TestCanViewRequest:

    def test_creator_can_view_active_without_step_perms(self, active_req):
        """The creator always has access — no step permission needed."""
        req, step, owner = active_req
        assert can_view_request(owner, req) is True

    def test_user_with_step_view_can_view_active(self, active_req, make_user):
        """A user with step_view on the current step can view the active request."""
        req, step, _ = active_req
        viewer = make_user('viewer@test.com', role='admin')
        _grant(viewer, step, 'step_view')
        assert can_view_request(viewer, req) is True

    def test_user_without_step_view_cannot_view_active(self, active_req, make_user):
        """A random user with NO step permissions cannot view someone else's request."""
        req, step, _ = active_req
        stranger = make_user('stranger@test.com', role='admin')
        assert can_view_request(stranger, req) is False

    def test_creator_can_view_completed_request(self, completed_req):
        """The creator can view a completed request even though current_step is None."""
        req, step, owner = completed_req
        assert can_view_request(owner, req) is True

    def test_non_creator_without_history_cannot_view_completed(
        self, completed_req, make_user
    ):
        """A user with no history entry on a completed request is denied."""
        req, step, _ = completed_req
        outsider = make_user('outsider@test.com', role='admin')
        assert can_view_request(outsider, req) is False

    def test_user_in_history_can_view_completed_regression_bug003(
        self, completed_req, make_user
    ):
        """
        BUG-003 regression: a user who executed an action on a completed
        request must be able to view it even though current_step is None.
        """
        req, step, _ = completed_req
        actor = make_user('actor@test.com', role='admin')
        RequestHistory.objects.create(
            request=req,
            from_step=step,
            to_step=None,
            executed_by=actor,
        )
        assert can_view_request(actor, req) is True


# ── TestCanEditStep ───────────────────────────────────────────────────────────

class TestCanEditStep:

    def test_user_with_step_edit_can_edit_active(self, active_req, make_user):
        """A user with step_edit permission can edit on an active request."""
        req, step, _ = active_req
        editor = make_user('editor@test.com', role='admin')
        _grant(editor, step, 'step_edit')
        assert can_edit_step(editor, req) is True

    def test_user_without_step_edit_cannot_edit(self, active_req, make_user):
        """A user without step_edit permission is denied."""
        req, step, _ = active_req
        nobody = make_user('nobody-edit@test.com', role='admin')
        assert can_edit_step(nobody, req) is False

    def test_nobody_can_edit_step_on_completed_request(self, completed_req, make_user):
        """
        Even a user with step_edit cannot edit if the request is completed
        (is_active returns False — current_step is None).
        """
        req, step, _ = completed_req
        editor = make_user('late-editor@test.com', role='admin')
        # Grant the perm anyway; the function should still return False.
        _grant(editor, step, 'step_edit')
        assert can_edit_step(editor, req) is False


# ── TestCanExecuteAction ──────────────────────────────────────────────────────

class TestCanExecuteAction:

    def test_user_with_step_execute_can_execute_active(self, active_req, make_user):
        """A user with step_execute can execute an action on an active request."""
        req, step, _ = active_req
        actor = make_user('executor@test.com', role='admin')
        _grant(actor, step, 'step_execute')
        assert can_execute_action(actor, req) is True

    def test_user_without_step_execute_cannot_execute(self, active_req, make_user):
        """A user without step_execute is denied."""
        req, step, _ = active_req
        stranger = make_user('no-exec@test.com', role='admin')
        assert can_execute_action(stranger, req) is False

    def test_nobody_can_execute_on_cancelled_request(self, cancelled_req, make_user):
        """
        Even if a user holds step_execute, they cannot execute on a cancelled
        request (is_active is False).
        """
        req, step, _ = cancelled_req
        actor = make_user('late-actor@test.com', role='admin')
        # Grant perm on the step that was used before cancellation.
        _grant(actor, step, 'step_execute')
        assert can_execute_action(actor, req) is False


# ── TestGetAccessibleStepIds ──────────────────────────────────────────────────

class TestGetAccessibleStepIds:

    def test_returns_step_uuid_when_user_has_step_view(
        self, workflow_with_step, make_user
    ):
        """get_accessible_step_ids() returns the UUID of steps with step_view."""
        wf, step = workflow_with_step
        viewer = make_user('step-viewer@test.com', role='admin')
        _grant(viewer, step, 'step_view')
        result = get_accessible_step_ids(viewer)
        assert step.id in result

    def test_does_not_include_steps_with_only_step_edit(
        self, workflow_with_step, make_user
    ):
        """
        step_view is required for listing. step_edit alone must NOT include
        the step in the returned list.
        """
        wf, step = workflow_with_step
        editor = make_user('only-edit@test.com', role='admin')
        _grant(editor, step, 'step_edit')
        result = get_accessible_step_ids(editor)
        assert step.id not in result

    def test_returns_empty_list_for_user_without_any_perms(
        self, workflow_with_step, make_user
    ):
        """A user with no permissions gets an empty list."""
        wf, step = workflow_with_step
        anon = make_user('no-perms@test.com', role='admin')
        result = get_accessible_step_ids(anon)
        assert result == []
