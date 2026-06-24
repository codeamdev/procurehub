"""
Unit tests for the workflow services layer.
Tests are written to be RED before the fix and GREEN after.
"""
import pytest
import datetime
from django.db import transaction

pytestmark = pytest.mark.django_db


# ── Shared workflow fixtures ──────────────────────────────────────────────────

@pytest.fixture
def admin_user(make_user):
    return make_user('wf-admin@test.com', role='admin')


@pytest.fixture
def active_workflow(admin_user):
    from apps.workflows.models import WorkflowDefinition, Step
    wf = WorkflowDefinition.objects.create(
        name='Test WF',
        code_prefix='TS',
        status=WorkflowDefinition.Status.ACTIVE,
        created_by=admin_user,
    )
    Step.objects.create(workflow=wf, name='Inicio', order=0, is_initial=True)
    return wf


@pytest.fixture
def draft_workflow(admin_user):
    from apps.workflows.models import WorkflowDefinition
    return WorkflowDefinition.objects.create(
        name='Draft WF',
        code_prefix='DR',
        status=WorkflowDefinition.Status.DRAFT,
        created_by=admin_user,
    )


# ══════════════════════════════════════════════════════════════════════════════
# BUG-001: race condition en _generate_request_code
# ══════════════════════════════════════════════════════════════════════════════

class TestRequestCodeGeneration:

    def test_sequential_codes_are_unique(self, active_workflow):
        """
        BUG-001 regression: two calls without an intervening Request.objects.create
        must still produce different codes.

        RED  with old implementation (both see last_code=None → same code).
        GREEN after counter-table fix.
        """
        from apps.workflows.services import _generate_request_code

        with transaction.atomic():
            code1 = _generate_request_code(active_workflow)
        with transaction.atomic():
            code2 = _generate_request_code(active_workflow)

        assert code1 != code2, (
            f"BUG-001: same code generated twice: {code1!r}. "
            "The counter table is missing or not being used."
        )

    def test_code_format_with_prefix(self, active_workflow):
        from apps.workflows.services import _generate_request_code
        year = datetime.date.today().year
        with transaction.atomic():
            code = _generate_request_code(active_workflow)
        assert code.startswith(f'TS-{year}-'), f"Expected TS-{year}-NNNN, got {code!r}"

    def test_code_format_without_prefix(self, admin_user):
        from apps.workflows.models import WorkflowDefinition, Step
        from apps.workflows.services import _generate_request_code
        year = datetime.date.today().year
        wf = WorkflowDefinition.objects.create(
            name='No Prefix WF', code_prefix='',
            status=WorkflowDefinition.Status.ACTIVE, created_by=admin_user,
        )
        Step.objects.create(workflow=wf, name='Start', order=0, is_initial=True)
        with transaction.atomic():
            code = _generate_request_code(wf)
        assert code.startswith(f'{year}-'), f"Expected {year}-NNNN, got {code!r}"

    def test_counter_increments_across_versions(self, admin_user):
        """Codes across family versions share the same counter (scoped to family_id)."""
        from apps.workflows.models import WorkflowDefinition, Step
        from apps.workflows.services import _generate_request_code, clone_workflow
        wf = WorkflowDefinition.objects.create(
            name='Versioned WF', code_prefix='VR',
            status=WorkflowDefinition.Status.ACTIVE, created_by=admin_user,
        )
        Step.objects.create(workflow=wf, name='Start', order=0, is_initial=True)

        cloned = clone_workflow(wf, admin_user)
        cloned.status = WorkflowDefinition.Status.ACTIVE
        cloned.save(update_fields=['status', 'updated_at'])

        with transaction.atomic():
            code_v1 = _generate_request_code(wf)
        with transaction.atomic():
            code_v2 = _generate_request_code(cloned)

        assert code_v1 != code_v2, "Family counter not shared across versions."
        seq_v1 = int(code_v1.rsplit('-', 1)[1])
        seq_v2 = int(code_v2.rsplit('-', 1)[1])
        assert seq_v2 == seq_v1 + 1, f"Expected consecutive sequences, got {seq_v1} and {seq_v2}"


# ══════════════════════════════════════════════════════════════════════════════
# BUG-003: aprobadores no ven solicitudes cerradas
# ══════════════════════════════════════════════════════════════════════════════

class TestCanViewRequest:

    @pytest.fixture
    def approver(self, make_user):
        return make_user('approver@test.com', role='admin')

    @pytest.fixture
    def completed_request(self, active_workflow, admin_user, approver):
        """A request that has been completed; approver executed the last branch."""
        from apps.workflows.models import Branch, Step
        from apps.workflows.services import create_request

        # Add a terminal branch on the initial step
        step = active_workflow.steps.get(is_initial=True)
        terminal = Branch.objects.create(
            step=step, label='Aprobar', style='primary', order=0,
            target_step=None, terminal_status='completed',
        )

        req = create_request(admin_user, active_workflow, 'Test request')

        # Simulate approver having executed the transition (record in history)
        from apps.workflows.models import RequestHistory
        RequestHistory.objects.create(
            request=req,
            from_step=step,
            to_step=None,
            branch=terminal,
            executed_by=approver,
            data_snapshot={},
            notes='Aprobado',
        )
        # Mark as completed
        req.status = 'completed'
        req.current_step = None
        req.save(update_fields=['status', 'current_step', 'updated_at'])
        return req

    def test_creator_always_sees_completed_request(self, completed_request, admin_user):
        from apps.workflows.permissions import can_view_request
        assert can_view_request(admin_user, completed_request)

    def test_approver_sees_completed_request_they_acted_on(self, completed_request, approver):
        """
        BUG-003: approver with current_step=None was blocked.
        After fix: history-based lookup grants access.
        """
        from apps.workflows.permissions import can_view_request
        assert can_view_request(approver, completed_request), (
            "BUG-003: approver who acted on the request cannot see it after completion."
        )

    def test_stranger_cannot_see_completed_request(self, completed_request, make_user):
        stranger = make_user('stranger@test.com', role='admin')
        from apps.workflows.permissions import can_view_request
        assert not can_view_request(stranger, completed_request)

    def test_approver_sees_cancelled_request(self, active_workflow, admin_user, make_user):
        """Same fix applies to cancelled status."""
        from apps.workflows.models import Branch, Step, RequestHistory
        from apps.workflows.services import create_request
        from apps.workflows.permissions import can_view_request

        approver = make_user('approver2@test.com', role='admin')
        step = active_workflow.steps.get(is_initial=True)
        cancel_branch = Branch.objects.create(
            step=step, label='Cancelar', style='danger', order=1,
            target_step=None, terminal_status='cancelled',
        )
        req = create_request(admin_user, active_workflow, 'To cancel')
        RequestHistory.objects.create(
            request=req, from_step=step, to_step=None,
            branch=cancel_branch, executed_by=approver,
            data_snapshot={}, notes='',
        )
        req.status = 'cancelled'
        req.current_step = None
        req.save(update_fields=['status', 'current_step', 'updated_at'])

        assert can_view_request(approver, req)


# ══════════════════════════════════════════════════════════════════════════════
# BUG-004: clone_workflow no copia code_prefix
# ══════════════════════════════════════════════════════════════════════════════

class TestCloneWorkflow:

    def test_clone_copies_code_prefix(self, admin_user):
        from apps.workflows.models import WorkflowDefinition, Step
        from apps.workflows.services import clone_workflow

        wf = WorkflowDefinition.objects.create(
            name='PO Workflow', code_prefix='PO',
            status=WorkflowDefinition.Status.ACTIVE, created_by=admin_user,
        )
        Step.objects.create(workflow=wf, name='Start', order=0, is_initial=True)

        cloned = clone_workflow(wf, admin_user)

        assert cloned.code_prefix == 'PO', (
            f"BUG-004: clone has code_prefix={cloned.code_prefix!r}, expected 'PO'."
        )

    def test_clone_increments_version(self, admin_user):
        from apps.workflows.models import WorkflowDefinition, Step
        from apps.workflows.services import clone_workflow

        wf = WorkflowDefinition.objects.create(
            name='Version WF', status=WorkflowDefinition.Status.ACTIVE,
            created_by=admin_user,
        )
        Step.objects.create(workflow=wf, name='Start', order=0, is_initial=True)
        cloned = clone_workflow(wf, admin_user)
        assert cloned.version == wf.version + 1

    def test_clone_is_draft(self, admin_user):
        from apps.workflows.models import WorkflowDefinition, Step
        from apps.workflows.services import clone_workflow

        wf = WorkflowDefinition.objects.create(
            name='Clone Draft WF', status=WorkflowDefinition.Status.ACTIVE,
            created_by=admin_user,
        )
        Step.objects.create(workflow=wf, name='Start', order=0, is_initial=True)
        cloned = clone_workflow(wf, admin_user)
        assert cloned.status == WorkflowDefinition.Status.DRAFT


# ══════════════════════════════════════════════════════════════════════════════
# BUG-006: publish_workflow valida "al menos uno" en vez de "exactamente uno"
# ══════════════════════════════════════════════════════════════════════════════

class TestPublishWorkflow:

    def test_publish_with_zero_initial_steps_fails(self, draft_workflow):
        from apps.workflows.models import Step
        from apps.workflows.services import publish_workflow
        from rest_framework.exceptions import ValidationError

        Step.objects.create(workflow=draft_workflow, name='Solo paso', order=0, is_initial=False)
        with pytest.raises(ValidationError):
            publish_workflow(draft_workflow)

    def test_publish_with_two_initial_steps_fails(self, draft_workflow):
        """BUG-006: actualmente pasa sin error. Debe fallar."""
        from apps.workflows.models import Step
        from apps.workflows.services import publish_workflow
        from rest_framework.exceptions import ValidationError

        Step.objects.create(workflow=draft_workflow, name='Inicio A', order=0, is_initial=True)
        Step.objects.create(workflow=draft_workflow, name='Inicio B', order=1, is_initial=True)

        with pytest.raises(ValidationError) as exc_info:
            publish_workflow(draft_workflow)
        assert 'exactamente' in str(exc_info.value).lower() or '2' in str(exc_info.value)

    def test_publish_with_exactly_one_initial_step_succeeds(self, draft_workflow):
        from apps.workflows.models import Step
        from apps.workflows.services import publish_workflow

        Step.objects.create(workflow=draft_workflow, name='Inicio', order=0, is_initial=True)
        result = publish_workflow(draft_workflow)
        assert result.status == 'active'


# ══════════════════════════════════════════════════════════════════════════════
# BUG-008/011: import_workflow validaciones
# ══════════════════════════════════════════════════════════════════════════════

class TestImportWorkflow:

    BASE_JSON = {
        'nombre': 'Importado',
        'descripcion': 'Test',
        'condiciones': [],
        'campos': [{'clave': 'titulo', 'etiqueta': 'Título', 'tipo': 'text', 'orden': 0}],
        'pasos': [{'nombre': 'Inicio', 'orden': 0, 'es_inicial': True, 'es_final': False, 'ramas': [], 'reglas_campo': []}],
    }

    def test_import_valid_json_succeeds(self, admin_user):
        from apps.workflows.services import import_workflow
        wf = import_workflow(self.BASE_JSON, admin_user)
        assert wf.pk is not None
        assert wf.status == 'draft'

    def test_import_invalid_field_type_raises(self, admin_user):
        """BUG-008: tipos inválidos deben ser rechazados con error descriptivo."""
        from apps.workflows.services import import_workflow
        data = {**self.BASE_JSON, 'campos': [
            {'clave': 'x', 'etiqueta': 'X', 'tipo': 'rating', 'orden': 0}
        ]}
        with pytest.raises(ValueError, match='rating'):
            import_workflow(data, admin_user)

    def test_import_no_initial_step_raises(self, admin_user):
        """BUG-011: sin paso inicial debe fallar con error claro."""
        from apps.workflows.services import import_workflow
        data = {**self.BASE_JSON, 'pasos': [
            {'nombre': 'Paso', 'orden': 0, 'es_inicial': False, 'es_final': False, 'ramas': [], 'reglas_campo': []}
        ]}
        with pytest.raises(ValueError, match='inicial'):
            import_workflow(data, admin_user)

    def test_import_multiple_initial_steps_raises(self, admin_user):
        """BUG-011: más de un paso inicial debe fallar."""
        from apps.workflows.services import import_workflow
        data = {**self.BASE_JSON, 'pasos': [
            {'nombre': 'A', 'orden': 0, 'es_inicial': True, 'es_final': False, 'ramas': [], 'reglas_campo': []},
            {'nombre': 'B', 'orden': 1, 'es_inicial': True, 'es_final': False, 'ramas': [], 'reglas_campo': []},
        ]}
        with pytest.raises(ValueError, match='inicial'):
            import_workflow(data, admin_user)
