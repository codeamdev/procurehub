"""
Integration tests — BUG-2.2: cross-workflow validation in serializers.

Verifies that BranchConditionRouteWriteSerializer and BranchWriteSerializer
reject Step/Condition objects that belong to a different workflow within
the same tenant.
"""
import pytest

pytestmark = pytest.mark.django_db


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_draft_workflow(admin_client, name, code_prefix):
    """POST to the workflow definitions endpoint and return the created object id."""
    res = admin_client.post(
        '/api/workflows/definitions/',
        {'name': name, 'description': '', 'code_prefix': code_prefix},
        content_type='application/json',
    )
    assert res.status_code == 201, res.json()
    return res.json()['id']


def _create_step(admin_client, workflow_pk, name, order=0, is_initial=False, is_final=False):
    res = admin_client.post(
        f'/api/workflows/definitions/{workflow_pk}/steps/',
        {'name': name, 'order': order, 'is_initial': is_initial, 'is_final': is_final},
        content_type='application/json',
    )
    assert res.status_code == 201, res.json()
    return res.json()['id']


def _create_branch(admin_client, workflow_pk, step_pk, label='Go', order=0):
    res = admin_client.post(
        f'/api/workflows/definitions/{workflow_pk}/steps/{step_pk}/branches/',
        {'label': label, 'style': 'primary', 'order': order},
        content_type='application/json',
    )
    assert res.status_code == 201, res.json()
    return res.json()['id']


def _create_condition(admin_client, workflow_pk, name='cond_a'):
    res = admin_client.post(
        f'/api/workflows/definitions/{workflow_pk}/conditions/',
        {
            'name': name,
            'label': 'Test condition',
            'description': '',
            'code': 'result = True',
        },
        content_type='application/json',
    )
    assert res.status_code == 201, res.json()
    return res.json()['id']


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def two_workflows(admin_client):
    """
    Returns a dict with two independent draft workflows, each with one step.
    Shape:
        {
            'wf_a': {'id': <uuid>, 'step_id': <uuid>},
            'wf_b': {'id': <uuid>, 'step_id': <uuid>},
        }
    """
    wf_a_id = _create_draft_workflow(admin_client, 'Workflow A', 'WFA')
    step_a_id = _create_step(admin_client, wf_a_id, 'Step A1', order=0, is_initial=True)

    wf_b_id = _create_draft_workflow(admin_client, 'Workflow B', 'WFB')
    step_b_id = _create_step(admin_client, wf_b_id, 'Step B1', order=0, is_initial=True)

    return {
        'wf_a': {'id': wf_a_id, 'step_id': step_a_id},
        'wf_b': {'id': wf_b_id, 'step_id': step_b_id},
    }


# ══════════════════════════════════════════════════════════════════════════════
# BUG-2.2a: BranchWriteSerializer — cross-workflow target_step
# ══════════════════════════════════════════════════════════════════════════════

class TestBranchWriteSerializerCrossWorkflow:
    """
    POST /api/workflows/definitions/{workflow_pk}/steps/{step_pk}/branches/
    with a target_step_id belonging to a different workflow must return 400.
    """

    def test_cross_workflow_target_step_rejected(self, admin_client, two_workflows):
        """BUG-2.2: target_step from workflow B must not be linkable inside workflow A."""
        wf_a = two_workflows['wf_a']
        wf_b = two_workflows['wf_b']

        res = admin_client.post(
            f'/api/workflows/definitions/{wf_a["id"]}/steps/{wf_a["step_id"]}/branches/',
            {
                'label': 'Cross Branch',
                'style': 'primary',
                'order': 0,
                'target_step_id': wf_b['step_id'],   # step belongs to workflow B
            },
            content_type='application/json',
        )

        assert res.status_code == 400, (
            f"BUG-2.2: cross-workflow target_step was accepted (got {res.status_code}). "
            f"Response: {res.json()}"
        )
        data = res.json()
        assert 'target_step_id' in data, (
            f"Expected 'target_step_id' key in error response, got: {data}"
        )

    def test_same_workflow_target_step_accepted(self, admin_client, two_workflows):
        """Sanity check: target_step within the same workflow must be accepted."""
        wf_a = two_workflows['wf_a']
        # Add a second step to workflow A to use as target
        step_a2_id = _create_step(admin_client, wf_a['id'], 'Step A2', order=1)

        res = admin_client.post(
            f'/api/workflows/definitions/{wf_a["id"]}/steps/{wf_a["step_id"]}/branches/',
            {
                'label': 'Same WF Branch',
                'style': 'primary',
                'order': 0,
                'target_step_id': step_a2_id,
            },
            content_type='application/json',
        )

        assert res.status_code == 201, (
            f"Valid same-workflow target_step was rejected (got {res.status_code}). "
            f"Response: {res.json()}"
        )

    def test_null_target_step_accepted(self, admin_client, two_workflows):
        """A terminal branch (target_step_id=null) must still be accepted."""
        wf_a = two_workflows['wf_a']

        res = admin_client.post(
            f'/api/workflows/definitions/{wf_a["id"]}/steps/{wf_a["step_id"]}/branches/',
            {
                'label': 'Terminal Branch',
                'style': 'danger',
                'order': 1,
                'terminal_status': 'completed',
            },
            content_type='application/json',
        )

        assert res.status_code == 201, (
            f"Terminal branch (no target_step) was rejected (got {res.status_code}). "
            f"Response: {res.json()}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# BUG-2.2b: BranchConditionRouteWriteSerializer — cross-workflow objects
# ══════════════════════════════════════════════════════════════════════════════

class TestBranchConditionRouteWriteSerializerCrossWorkflow:
    """
    POST /api/workflows/definitions/{wf}/steps/{s}/branches/{b}/routes/
    with target_step_id or condition_id from another workflow must return 400.
    """

    @pytest.fixture
    def setup(self, admin_client, two_workflows):
        """Creates a branch on workflow A to attach routes to."""
        wf_a = two_workflows['wf_a']
        branch_id = _create_branch(admin_client, wf_a['id'], wf_a['step_id'], label='Conditional')
        return {
            'wf_a': wf_a,
            'wf_b': two_workflows['wf_b'],
            'branch_id': branch_id,
        }

    def _route_url(self, wf_id, step_id, branch_id):
        return (
            f'/api/workflows/definitions/{wf_id}'
            f'/steps/{step_id}'
            f'/branches/{branch_id}/routes/'
        )

    def test_cross_workflow_target_step_in_route_rejected(self, admin_client, setup):
        """BUG-2.2: target_step from workflow B must be rejected in workflow A's route."""
        url = self._route_url(
            setup['wf_a']['id'],
            setup['wf_a']['step_id'],
            setup['branch_id'],
        )

        res = admin_client.post(
            url,
            {
                'order': 0,
                'target_step_id': setup['wf_b']['step_id'],  # belongs to workflow B
            },
            content_type='application/json',
        )

        assert res.status_code == 400, (
            f"BUG-2.2: cross-workflow target_step in route was accepted "
            f"(got {res.status_code}). Response: {res.json()}"
        )
        data = res.json()
        assert 'target_step_id' in data, (
            f"Expected 'target_step_id' key in error response, got: {data}"
        )

    def test_cross_workflow_condition_in_route_rejected(self, admin_client, setup):
        """BUG-2.2: condition from workflow B must be rejected in workflow A's route."""
        # Create a condition in workflow B
        cond_b_id = _create_condition(admin_client, setup['wf_b']['id'], name='cond_b')

        url = self._route_url(
            setup['wf_a']['id'],
            setup['wf_a']['step_id'],
            setup['branch_id'],
        )

        res = admin_client.post(
            url,
            {
                'order': 0,
                'condition_id': cond_b_id,  # belongs to workflow B
            },
            content_type='application/json',
        )

        assert res.status_code == 400, (
            f"BUG-2.2: cross-workflow condition in route was accepted "
            f"(got {res.status_code}). Response: {res.json()}"
        )
        data = res.json()
        assert 'condition_id' in data, (
            f"Expected 'condition_id' key in error response, got: {data}"
        )

    def test_same_workflow_target_step_in_route_accepted(self, admin_client, setup):
        """Sanity: target_step from the same workflow must be accepted."""
        # Add a second step to workflow A
        step_a2_id = _create_step(admin_client, setup['wf_a']['id'], 'Step A2', order=1)

        url = self._route_url(
            setup['wf_a']['id'],
            setup['wf_a']['step_id'],
            setup['branch_id'],
        )

        res = admin_client.post(
            url,
            {
                'order': 0,
                'target_step_id': step_a2_id,
            },
            content_type='application/json',
        )

        assert res.status_code == 201, (
            f"Valid same-workflow target_step in route was rejected "
            f"(got {res.status_code}). Response: {res.json()}"
        )

    def test_same_workflow_condition_in_route_accepted(self, admin_client, setup):
        """Sanity: condition from the same workflow must be accepted."""
        cond_a_id = _create_condition(admin_client, setup['wf_a']['id'], name='cond_a')
        # Add a target step so route is complete
        step_a2_id = _create_step(admin_client, setup['wf_a']['id'], 'Step A2 v2', order=2)

        url = self._route_url(
            setup['wf_a']['id'],
            setup['wf_a']['step_id'],
            setup['branch_id'],
        )

        res = admin_client.post(
            url,
            {
                'order': 1,
                'condition_id': cond_a_id,
                'target_step_id': step_a2_id,
            },
            content_type='application/json',
        )

        assert res.status_code == 201, (
            f"Valid same-workflow condition + target_step in route was rejected "
            f"(got {res.status_code}). Response: {res.json()}"
        )
