"""
Workflow services — Phase 1: CRUD + basic request lifecycle.
Phase 2 will add: RuleEvaluator, StateMachine, FormService, BranchExecutor.
"""
import logging
import datetime
from django.db import transaction, IntegrityError
from rest_framework.exceptions import ValidationError

from apps.common.exceptions import NotFoundError, ConflictError
from .models import (
    WorkflowDefinition, Step, Field, FieldRule,
    Branch, Request, RequestData, RequestHistory,
    WorkflowCondition, BranchConditionRoute,
    RequestCodeCounter,
)

logger = logging.getLogger(__name__)


# ── WorkflowDefinition ────────────────────────────────────────────────────────

def publish_workflow(workflow: WorkflowDefinition) -> WorkflowDefinition:
    """Move a DRAFT workflow to ACTIVE. Validates minimal structure first."""
    if workflow.status != WorkflowDefinition.Status.DRAFT:
        raise ConflictError('Only DRAFT workflows can be published.')

    steps = list(workflow.steps.all())
    if not steps:
        raise ValidationError('Workflow must have at least one step before publishing.')
    if not any(s.is_initial for s in steps):
        raise ValidationError('Workflow must have exactly one initial step.')

    workflow.status = WorkflowDefinition.Status.ACTIVE
    workflow.save(update_fields=['status', 'updated_at'])
    logger.info('WorkflowDefinition "%s" v%d published.', workflow.name, workflow.version)
    return workflow


def deprecate_workflow(workflow: WorkflowDefinition) -> WorkflowDefinition:
    """Move an ACTIVE workflow to DEPRECATED."""
    if workflow.status != WorkflowDefinition.Status.ACTIVE:
        raise ConflictError('Only ACTIVE workflows can be deprecated.')
    workflow.status = WorkflowDefinition.Status.DEPRECATED
    workflow.save(update_fields=['status', 'updated_at'])
    logger.info('WorkflowDefinition "%s" v%d deprecated.', workflow.name, workflow.version)
    return workflow


@transaction.atomic
def clone_workflow(workflow: WorkflowDefinition, user) -> WorkflowDefinition:
    """
    Clone an ACTIVE or DEPRECATED workflow into a new DRAFT with version+1.
    The caller can then edit the DRAFT before publishing.
    """
    next_version = (
        WorkflowDefinition.objects
        .filter(family_id=workflow.family_id)
        .order_by('-version')
        .values_list('version', flat=True)
        .first() or 0
    ) + 1

    new_wf = WorkflowDefinition.objects.create(
        family_id=workflow.family_id,
        name=workflow.name,
        description=workflow.description,
        version=next_version,
        status=WorkflowDefinition.Status.DRAFT,
        created_by=user,
    )

    # Clone steps
    step_map = {}  # old_step_id → new_step
    for old_step in workflow.steps.all():
        new_step = Step.objects.create(
            workflow=new_wf,
            name=old_step.name,
            order=old_step.order,
            is_initial=old_step.is_initial,
            is_final=old_step.is_final,
        )
        step_map[str(old_step.id)] = new_step

    # Clone fields
    field_map = {}  # old_field_id → new_field
    for old_field in workflow.fields.all():
        new_field = Field.objects.create(
            workflow=new_wf,
            key=old_field.key,
            label=old_field.label,
            field_type=old_field.field_type,
            options=old_field.options,
            metadata=old_field.metadata,
            order=old_field.order,
        )
        field_map[str(old_field.id)] = new_field

    # Clone conditions first so FieldRule FKs can be remapped
    condition_map = {}  # old_condition_id → new_condition
    for old_cond in WorkflowCondition.objects.filter(workflow=workflow):
        new_cond = WorkflowCondition.objects.create(
            workflow=new_wf,
            name=old_cond.name,
            label=old_cond.label,
            description=old_cond.description,
            code=old_cond.code,
        )
        condition_map[str(old_cond.id)] = new_cond

    # Clone field rules (condition FKs remapped)
    for old_rule in FieldRule.objects.filter(step__workflow=workflow).select_related(
        'visibility_condition', 'editable_condition', 'required_condition'
    ):
        FieldRule.objects.create(
            field=field_map[str(old_rule.field_id)],
            step=step_map[str(old_rule.step_id)],
            is_visible=old_rule.is_visible,
            is_editable=old_rule.is_editable,
            is_required=old_rule.is_required,
            visibility_condition=condition_map.get(str(old_rule.visibility_condition_id)) if old_rule.visibility_condition_id else None,
            editable_condition=condition_map.get(str(old_rule.editable_condition_id)) if old_rule.editable_condition_id else None,
            required_condition=condition_map.get(str(old_rule.required_condition_id)) if old_rule.required_condition_id else None,
        )

    # Clone branches (target_step remapped to new steps)
    branch_map = {}  # old_branch_id → new_branch
    for old_branch in Branch.objects.filter(step__workflow=workflow):
        new_target = step_map.get(str(old_branch.target_step_id)) if old_branch.target_step_id else None
        new_branch = Branch.objects.create(
            step=step_map[str(old_branch.step_id)],
            label=old_branch.label,
            style=old_branch.style,
            order=old_branch.order,
            target_step=new_target,
            terminal_status=old_branch.terminal_status,
            condition=old_branch.condition,
            validations=old_branch.validations,
            effects=old_branch.effects,
        )
        branch_map[str(old_branch.id)] = new_branch

    # Clone condition routes (condition + target_step remapped)
    for old_route in BranchConditionRoute.objects.filter(branch__step__workflow=workflow):
        BranchConditionRoute.objects.create(
            branch=branch_map[str(old_route.branch_id)],
            condition=condition_map.get(str(old_route.condition_id)) if old_route.condition_id else None,
            order=old_route.order,
            target_step=step_map.get(str(old_route.target_step_id)) if old_route.target_step_id else None,
            terminal_status=old_route.terminal_status,
        )

    logger.info(
        'WorkflowDefinition "%s" cloned from v%d to v%d.',
        new_wf.name, workflow.version, new_wf.version,
    )
    return new_wf


# ── Request code generation ───────────────────────────────────────────────────

def _generate_request_code(workflow_definition: 'WorkflowDefinition') -> str:
    """
    Generate a unique code: PREFIX-YEAR-NNNN (or YEAR-NNNN if no prefix).
    Uses a counter table so select_for_update always locks an existing row,
    eliminating the race condition that occurred when the result set was empty.
    Must be called inside a transaction (guaranteed by create_request).
    """
    year = datetime.date.today().year
    prefix = (workflow_definition.code_prefix or '').strip().upper()

    # Ensure the counter row exists, then lock it for the duration of the transaction.
    RequestCodeCounter.objects.get_or_create(
        family_id=workflow_definition.family_id,
        year=year,
        defaults={'last_seq': 0},
    )
    counter = (
        RequestCodeCounter.objects
        .select_for_update()
        .get(family_id=workflow_definition.family_id, year=year)
    )
    counter.last_seq += 1
    counter.save(update_fields=['last_seq'])

    seq = f"{counter.last_seq:04d}"
    return f"{prefix}-{year}-{seq}" if prefix else f"{year}-{seq}"


# ── Request lifecycle ─────────────────────────────────────────────────────────

def create_request(user, workflow_definition: WorkflowDefinition, title: str = '') -> Request:
    """
    Create a new Request starting at the initial step.
    Retries up to 3 times on IntegrityError (last-resort safety net for the unique
    code constraint; should never trigger with the counter-table approach).
    """
    if workflow_definition.status != WorkflowDefinition.Status.ACTIVE:
        raise ConflictError('Cannot create a request from a non-active workflow.')

    initial_step = workflow_definition.steps.filter(is_initial=True).first()
    if not initial_step:
        raise ConflictError('Workflow has no initial step configured.')

    request = None
    for attempt in range(3):
        try:
            with transaction.atomic():
                code = _generate_request_code(workflow_definition)
                request = Request.objects.create(
                    workflow_definition=workflow_definition,
                    current_step=initial_step,
                    created_by=user,
                    code=code,
                    title=title or f'{workflow_definition.name} — {user.email}',
                )
            break
        except IntegrityError:
            if attempt == 2:
                raise ConflictError('No se pudo generar un código único para la solicitud.')

    RequestHistory.objects.create(
        request=request,
        from_step=None,
        to_step=initial_step,
        branch=None,
        executed_by=user,
        data_snapshot={},
        notes='Request created.',
    )
    logger.info('Request %s created by %s on workflow "%s".', request.id, user.email, workflow_definition.name)
    return request


def get_request_data_as_dict(request: Request) -> dict:
    """Return all current RequestData values as {field_key: value}."""
    return {
        rd.field.key: rd.value
        for rd in request.field_data.select_related('field').all()
    }


@transaction.atomic
def save_field_data(request: Request, field_data: dict) -> Request:
    """
    Persist field values for the current step.
    Only writes fields that belong to the request's workflow.
    """
    if not request.is_active:
        raise ConflictError('Cannot modify a request that is not active.')

    workflow_fields = {
        f.key: f
        for f in Field.objects.filter(workflow=request.workflow_definition)
    }
    for key, value in field_data.items():
        if key not in workflow_fields:
            continue
        RequestData.objects.update_or_create(
            request=request,
            field=workflow_fields[key],
            defaults={'value': value},
        )

    request.save(update_fields=['updated_at'])
    logger.info('Request %s field data saved.', request.id)
    return request


# ── Step / Field / Branch helpers ─────────────────────────────────────────────

def reorder_steps(workflow: WorkflowDefinition, ordered_ids: list) -> None:
    """Bulk-update step order. ordered_ids is a list of Step UUIDs in desired order."""
    if not workflow.is_editable:
        raise ConflictError('Cannot modify steps of a non-draft workflow.')
    steps = {str(s.id): s for s in workflow.steps.all()}
    for position, step_id in enumerate(ordered_ids):
        step = steps.get(step_id)
        if step:
            step.order = position
            step.save(update_fields=['order'])


def reorder_fields(workflow: WorkflowDefinition, ordered_ids: list) -> None:
    """Bulk-update field order. ordered_ids is a list of Field UUIDs in desired order."""
    if not workflow.is_editable:
        raise ConflictError('Cannot modify fields of a non-draft workflow.')
    fields = {str(f.id): f for f in workflow.fields.all()}
    for position, field_id in enumerate(ordered_ids):
        field = fields.get(field_id)
        if field:
            field.order = position
            field.save(update_fields=['order'])


# ── Import / Export ───────────────────────────────────────────────────────────

def export_workflow(workflow: WorkflowDefinition) -> dict:
    """
    Serializa un workflow completo en formato JSON en español.
    Ramas y rutas usan referencias por nombre de paso/condición, no UUIDs.
    """
    steps = list(
        workflow.steps
        .prefetch_related(
            'branches__condition_routes__condition',
            'branches__condition_routes__target_step',
            'field_rules__field',
            'field_rules__visibility_condition',
            'field_rules__editable_condition',
            'field_rules__required_condition',
        )
        .order_by('order')
    )
    fields = list(workflow.fields.order_by('order'))
    conditions = list(workflow.conditions.order_by('name'))

    step_id_to_name = {str(s.id): s.name for s in steps}

    # Exportar condiciones Python
    condiciones = []
    for cond in conditions:
        condiciones.append({
            'nombre': cond.name,
            'etiqueta': cond.label,
            'descripcion': cond.description,
            'codigo': cond.code,
        })

    pasos = []
    for step in steps:
        ramas = []
        for branch in step.branches.order_by('order'):
            # Exportar rutas condicionales
            rutas = []
            for route in branch.condition_routes.order_by('order'):
                rutas.append({
                    'condicion': route.condition.name if route.condition else None,
                    'orden': route.order,
                    'paso_destino': step_id_to_name.get(str(route.target_step_id)) if route.target_step_id else None,
                    'estado_terminal': route.terminal_status,
                })

            rama = {
                'etiqueta': branch.label,
                'estilo': branch.style,
                'orden': branch.order,
                'paso_destino': step_id_to_name.get(str(branch.target_step_id)) if branch.target_step_id else None,
                'estado_terminal': branch.terminal_status,
                'condicion': branch.condition,
                'validaciones': branch.validations,
                'efectos': branch.effects,
                'rutas': rutas,
            }
            ramas.append(rama)

        reglas = []
        for rule in step.field_rules.all():
            regla = {
                'campo_clave': rule.field.key,
                'es_visible': rule.is_visible,
                'es_editable': rule.is_editable,
                'es_requerido': rule.is_required,
                'condicion_visibilidad': rule.visibility_condition.name if rule.visibility_condition_id else None,
                'condicion_editable': rule.editable_condition.name if rule.editable_condition_id else None,
                'condicion_requerido': rule.required_condition.name if rule.required_condition_id else None,
            }
            reglas.append(regla)

        pasos.append({
            'nombre': step.name,
            'orden': step.order,
            'es_inicial': step.is_initial,
            'es_final': step.is_final,
            'ramas': ramas,
            'reglas_campo': reglas,
        })

    campos = []
    for field in fields:
        campos.append({
            'clave': field.key,
            'etiqueta': field.label,
            'tipo': field.field_type,
            'opciones': field.options,
            'metadatos': field.metadata,
            'orden': field.order,
        })

    return {
        'nombre': workflow.name,
        'descripcion': workflow.description,
        'version': workflow.version,
        'condiciones': condiciones,
        'pasos': pasos,
        'campos': campos,
    }


@transaction.atomic
def import_workflow(data: dict, user) -> WorkflowDefinition:
    """
    Crea un nuevo workflow DRAFT desde un JSON en español.
    Valida campos requeridos y referencias entre pasos.
    """
    nombre = data.get('nombre', '').strip()
    if not nombre:
        raise ValueError('El campo "nombre" es obligatorio.')

    new_wf = WorkflowDefinition.objects.create(
        name=nombre,
        description=data.get('descripcion', ''),
        status=WorkflowDefinition.Status.DRAFT,
        created_by=user,
    )

    # Crear campos
    campo_key_to_field = {}
    for c in data.get('campos', []):
        clave = c.get('clave', '').strip()
        if not clave:
            continue
        field = Field.objects.create(
            workflow=new_wf,
            key=clave,
            label=c.get('etiqueta', clave),
            field_type=c.get('tipo', 'text'),
            options=c.get('opciones', []),
            metadata=c.get('metadatos', {}),
            order=c.get('orden', 0),
        )
        campo_key_to_field[clave] = field

    # Crear pasos (primera pasada — sin ramas que referencian otros pasos)
    paso_nombre_to_step = {}
    for p in data.get('pasos', []):
        nombre_paso = p.get('nombre', '').strip()
        if not nombre_paso:
            continue
        step = Step.objects.create(
            workflow=new_wf,
            name=nombre_paso,
            order=p.get('orden', 0),
            is_initial=p.get('es_inicial', False),
            is_final=p.get('es_final', False),
        )
        paso_nombre_to_step[nombre_paso] = step

        # Crear reglas de campo para este paso (condiciones se resuelven en 2ª pasada)
        for regla in p.get('reglas_campo', []):
            clave_campo = regla.get('campo_clave', '').strip()
            field = campo_key_to_field.get(clave_campo)
            if not field:
                continue
            FieldRule.objects.create(
                field=field,
                step=step,
                is_visible=regla.get('es_visible', True),
                is_editable=regla.get('es_editable', True),
                is_required=regla.get('es_requerido', False),
            )

    # Crear condiciones Python (antes de ramas, para que las rutas puedan referenciarlas)
    cond_nombre_to_obj = {}
    for c in data.get('condiciones', []):
        nombre_cond = c.get('nombre', '').strip()
        if not nombre_cond:
            continue
        cond = WorkflowCondition.objects.create(
            workflow=new_wf,
            name=nombre_cond,
            label=c.get('etiqueta', nombre_cond),
            description=c.get('descripcion', ''),
            code=c.get('codigo', 'result = False'),
        )
        cond_nombre_to_obj[nombre_cond] = cond

    # Asignar condiciones Python a las reglas de campo (segunda pasada)
    for p in data.get('pasos', []):
        nombre_paso = p.get('nombre', '').strip()
        step = paso_nombre_to_step.get(nombre_paso)
        if not step:
            continue
        for regla in p.get('reglas_campo', []):
            clave_campo = regla.get('campo_clave', '').strip()
            field = campo_key_to_field.get(clave_campo)
            if not field:
                continue
            vis_name = regla.get('condicion_visibilidad')
            edi_name = regla.get('condicion_editable')
            req_name = regla.get('condicion_requerido')
            if vis_name or edi_name or req_name:
                FieldRule.objects.filter(field=field, step=step).update(
                    visibility_condition=cond_nombre_to_obj.get(vis_name) if vis_name else None,
                    editable_condition=cond_nombre_to_obj.get(edi_name) if edi_name else None,
                    required_condition=cond_nombre_to_obj.get(req_name) if req_name else None,
                )

    # Crear ramas + rutas (tercera pasada — todos los pasos y condiciones existen)
    for p in data.get('pasos', []):
        nombre_paso = p.get('nombre', '').strip()
        step = paso_nombre_to_step.get(nombre_paso)
        if not step:
            continue
        for rama in p.get('ramas', []):
            destino_nombre = rama.get('paso_destino')
            destino_step = paso_nombre_to_step.get(destino_nombre) if destino_nombre else None
            branch = Branch.objects.create(
                step=step,
                label=rama.get('etiqueta', 'Continuar'),
                style=rama.get('estilo', 'primary'),
                order=rama.get('orden', 0),
                target_step=destino_step,
                terminal_status=rama.get('estado_terminal'),
                condition=rama.get('condicion'),
                validations=rama.get('validaciones'),
                effects=rama.get('efectos', []),
            )
            # Crear rutas condicionales para esta rama
            for ruta in rama.get('rutas', []):
                nombre_cond = ruta.get('condicion')
                cond_obj = cond_nombre_to_obj.get(nombre_cond) if nombre_cond else None
                destino_ruta = paso_nombre_to_step.get(ruta.get('paso_destino')) if ruta.get('paso_destino') else None
                BranchConditionRoute.objects.create(
                    branch=branch,
                    condition=cond_obj,
                    order=ruta.get('orden', 0),
                    target_step=destino_ruta,
                    terminal_status=ruta.get('estado_terminal'),
                )

    logger.info('Workflow "%s" importado como DRAFT por %s.', nombre, user.email)
    return new_wf
