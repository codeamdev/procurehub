import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Prefetch, Q

from apps.accounts.permissions import IsAdminOrBuyer
from apps.common.exceptions import ConflictError
from .engine import get_form_service, get_state_machine, TransitionError
from .models import (
    WorkflowDefinition, Step, Field, FieldRule,
    Branch, Request, RequestData, RequestHistory,
    WorkflowCondition, BranchConditionRoute,
)
from .serializers import (
    WorkflowDefinitionSerializer,
    WorkflowDefinitionDetailSerializer,
    StepSerializer, StepWriteSerializer,
    FieldSerializer, FieldWriteSerializer,
    FieldRuleSerializer, FieldRuleWriteSerializer,
    BranchSerializer, BranchWriteSerializer,
    RequestSerializer, RequestDetailSerializer,
    RequestHistorySerializer, TransitionSerializer,
    WorkflowConditionSerializer, WorkflowConditionWriteSerializer,
    BranchConditionRouteSerializer, BranchConditionRouteWriteSerializer,
)
from .permissions import (
    can_view_request, can_edit_step, can_execute_action,
    get_permissions_for_user, get_accessible_step_ids,
)
from . import services

logger = logging.getLogger(__name__)


# ── WorkflowDefinition ────────────────────────────────────────────────────────

class WorkflowDefinitionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBuyer]

    def get_queryset(self):
        qs = WorkflowDefinition.objects.select_related('created_by')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        show_in_menu = self.request.query_params.get('show_in_menu')
        if show_in_menu is not None:
            qs = qs.filter(show_in_menu=show_in_menu.lower() == 'true')
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return WorkflowDefinitionDetailSerializer
        return WorkflowDefinitionSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        if not instance.is_editable:
            raise ConflictError('Only DRAFT workflows can be edited.')
        serializer.save()

    def perform_destroy(self, instance):
        if not instance.is_editable:
            raise ConflictError('Only DRAFT workflows can be deleted.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        wf = self.get_object()
        updated = services.publish_workflow(wf)
        return Response(WorkflowDefinitionSerializer(updated).data)

    @action(detail=True, methods=['post'])
    def deprecate(self, request, pk=None):
        wf = self.get_object()
        updated = services.deprecate_workflow(wf)
        return Response(WorkflowDefinitionSerializer(updated).data)

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        wf = self.get_object()
        new_wf = services.clone_workflow(wf, request.user)
        return Response(
            WorkflowDefinitionSerializer(new_wf).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='toggle-menu')
    def toggle_menu(self, request, pk=None):
        """Toggle whether this workflow appears as a menu item. Only ACTIVE workflows."""
        wf = self.get_object()
        if wf.status != WorkflowDefinition.Status.ACTIVE:
            raise ConflictError(
                'Solo los workflows activos pueden aparecer en el menú. '
                f'Este workflow está en estado "{wf.status}".'
            )
        wf.show_in_menu = not wf.show_in_menu
        wf.save(update_fields=['show_in_menu', 'updated_at'])
        return Response(WorkflowDefinitionSerializer(wf).data)

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """
        Exporta un workflow como JSON en español.
        GET /api/workflows/definitions/{id}/export/
        """
        wf = self.get_object()
        payload = services.export_workflow(wf)
        return Response(payload)

    @action(detail=False, methods=['post'])
    def importar(self, request):
        """
        Importa un workflow desde JSON en español.
        POST /api/workflows/definitions/importar/
        """
        try:
            new_wf = services.import_workflow(request.data, request.user)
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)})
        return Response(
            WorkflowDefinitionSerializer(new_wf).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='field-matrix')
    def field_matrix(self, request, pk=None):
        """
        Returns a matrix representation of {step × field → rule} for the Workflow Builder UI.

        GET /api/workflows/definitions/{id}/field-matrix/
        Response shape:
        {
          "steps": [{id, name, order}, ...],
          "fields": [{id, key, label, field_type}, ...],
          "matrix": {
            "<step_id>": {
              "<field_id>": {is_visible, is_editable, is_required, condition} | null
            }
          }
        }
        """
        wf = self.get_object()
        steps = list(wf.steps.order_by('order'))
        fields = list(wf.fields.order_by('order'))

        rules_qs = FieldRule.objects.filter(step__workflow=wf).select_related('field', 'step')
        rule_map = {
            (str(r.step_id), str(r.field_id)): r for r in rules_qs
        }

        matrix = {}
        for step in steps:
            matrix[str(step.id)] = {}
            for field in fields:
                rule = rule_map.get((str(step.id), str(field.id)))
                if rule:
                    matrix[str(step.id)][str(field.id)] = {
                        'id': str(rule.id),
                        'is_visible': rule.is_visible,
                        'is_editable': rule.is_editable,
                        'is_required': rule.is_required,
                        'visibility_condition_id': str(rule.visibility_condition_id) if rule.visibility_condition_id else None,
                        'editable_condition_id': str(rule.editable_condition_id) if rule.editable_condition_id else None,
                        'required_condition_id': str(rule.required_condition_id) if rule.required_condition_id else None,
                    }
                else:
                    matrix[str(step.id)][str(field.id)] = None

        return Response({
            'steps': [{'id': str(s.id), 'name': s.name, 'order': s.order, 'is_initial': s.is_initial, 'is_final': s.is_final} for s in steps],
            'fields': [{'id': str(f.id), 'key': f.key, 'label': f.label, 'field_type': f.field_type} for f in fields],
            'matrix': matrix,
        })


# ── Step ─────────────────────────────────────────────────────────────────────

class StepViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBuyer]

    def get_queryset(self):
        return Step.objects.filter(
            workflow_id=self.kwargs['workflow_pk'],
        ).prefetch_related(
            Prefetch(
                'branches',
                queryset=Branch.objects
                    .select_related('target_step')
                    .prefetch_related(
                        Prefetch(
                            'condition_routes',
                            queryset=BranchConditionRoute.objects
                                .select_related('condition', 'target_step')
                                .order_by('order'),
                        )
                    )
                    .order_by('order'),
            ),
            Prefetch(
                'field_rules',
                queryset=FieldRule.objects
                    .select_related(
                        'field',
                        'visibility_condition',
                        'editable_condition',
                        'required_condition',
                    )
                    .order_by('field__order'),
            ),
        )

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return StepWriteSerializer
        return StepSerializer

    def perform_create(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot add steps to a non-draft workflow.')
        serializer.save(workflow=wf)

    def perform_update(self, serializer):
        wf = self.get_object().workflow
        if not wf.is_editable:
            raise ConflictError('Cannot edit steps of a non-draft workflow.')
        serializer.save()

    def perform_destroy(self, instance):
        if not instance.workflow.is_editable:
            raise ConflictError('Cannot delete steps of a non-draft workflow.')
        instance.delete()

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request, workflow_pk=None):
        wf = WorkflowDefinition.objects.get(pk=workflow_pk)
        ordered_ids = request.data.get('ordered_ids', [])
        services.reorder_steps(wf, ordered_ids)
        steps = StepSerializer(
            Step.objects.filter(workflow=wf).prefetch_related('branches', 'field_rules__field'),
            many=True,
        ).data
        return Response(steps)


# ── Field ─────────────────────────────────────────────────────────────────────

class FieldViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBuyer]

    def get_queryset(self):
        return Field.objects.filter(workflow_id=self.kwargs['workflow_pk'])

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return FieldWriteSerializer
        return FieldSerializer

    def perform_create(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot add fields to a non-draft workflow.')
        serializer.save(workflow=wf)

    def perform_update(self, serializer):
        if not self.get_object().workflow.is_editable:
            raise ConflictError('Cannot edit fields of a non-draft workflow.')
        serializer.save()

    def perform_destroy(self, instance):
        if not instance.workflow.is_editable:
            raise ConflictError('Cannot delete fields of a non-draft workflow.')
        instance.delete()

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request, workflow_pk=None):
        wf = WorkflowDefinition.objects.get(pk=workflow_pk)
        ordered_ids = request.data.get('ordered_ids', [])
        services.reorder_fields(wf, ordered_ids)
        fields = FieldSerializer(Field.objects.filter(workflow=wf), many=True).data
        return Response(fields)


# ── FieldRule ─────────────────────────────────────────────────────────────────

class FieldRuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBuyer]

    def get_queryset(self):
        return FieldRule.objects.filter(
            step_id=self.kwargs['step_pk'],
            step__workflow_id=self.kwargs['workflow_pk'],
        ).select_related('field')

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return FieldRuleWriteSerializer
        return FieldRuleSerializer

    def perform_create(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot modify field rules of a non-draft workflow.')
        serializer.save()

    def perform_update(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot modify field rules of a non-draft workflow.')
        serializer.save()


# ── Branch ────────────────────────────────────────────────────────────────────

class BranchViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBuyer]

    def get_queryset(self):
        return Branch.objects.filter(
            step_id=self.kwargs['step_pk'],
            step__workflow_id=self.kwargs['workflow_pk'],
        ).select_related('target_step')

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return BranchWriteSerializer
        return BranchSerializer

    def perform_create(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot add branches to a non-draft workflow.')
        step = Step.objects.get(pk=self.kwargs['step_pk'])
        serializer.save(step=step)

    def perform_update(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot edit branches of a non-draft workflow.')
        serializer.save()

    def perform_destroy(self, instance):
        if not instance.step.workflow.is_editable:
            raise ConflictError('Cannot delete branches of a non-draft workflow.')
        instance.delete()


# ── WorkflowCondition ─────────────────────────────────────────────────────────

class WorkflowConditionViewSet(viewsets.ModelViewSet):
    """
    CRUD for Python condition functions scoped to a workflow.
    GET/POST /api/workflows/definitions/{workflow_pk}/conditions/
    """
    permission_classes = [IsAdminOrBuyer]

    def get_queryset(self):
        return WorkflowCondition.objects.filter(workflow_id=self.kwargs['workflow_pk'])

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return WorkflowConditionWriteSerializer
        return WorkflowConditionSerializer

    def perform_create(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot add conditions to a non-draft workflow.')
        serializer.save(workflow=wf)

    def perform_update(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot edit conditions of a non-draft workflow.')
        serializer.save()

    def perform_destroy(self, instance):
        if not instance.workflow.is_editable:
            raise ConflictError('Cannot delete conditions of a non-draft workflow.')
        instance.delete()


# ── BranchConditionRoute ──────────────────────────────────────────────────────

class BranchConditionRouteViewSet(viewsets.ModelViewSet):
    """
    CRUD for condition routes on a branch.
    GET/POST /api/workflows/definitions/{workflow_pk}/steps/{step_pk}/branches/{branch_pk}/routes/
    """
    permission_classes = [IsAdminOrBuyer]

    def get_queryset(self):
        return BranchConditionRoute.objects.filter(
            branch_id=self.kwargs['branch_pk'],
            branch__step_id=self.kwargs['step_pk'],
            branch__step__workflow_id=self.kwargs['workflow_pk'],
        ).select_related('condition', 'target_step')

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return BranchConditionRouteWriteSerializer
        return BranchConditionRouteSerializer

    def perform_create(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot add routes to a non-draft workflow.')
        branch = Branch.objects.get(pk=self.kwargs['branch_pk'])
        serializer.save(branch=branch)

    def perform_update(self, serializer):
        wf = WorkflowDefinition.objects.get(pk=self.kwargs['workflow_pk'])
        if not wf.is_editable:
            raise ConflictError('Cannot edit routes of a non-draft workflow.')
        serializer.save()

    def perform_destroy(self, instance):
        if not instance.branch.step.workflow.is_editable:
            raise ConflictError('Cannot delete routes of a non-draft workflow.')
        instance.delete()


# ── Request ───────────────────────────────────────────────────────────────────

class RequestViewSet(viewsets.ModelViewSet):

    # Actions that render RequestDetailSerializer — need deep prefetches.
    _DETAIL_ACTIONS = frozenset({'retrieve', 'update', 'partial_update', 'transition'})

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdminOrBuyer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user

        # Base queryset — always-needed relations for the list serializer.
        qs = Request.objects.select_related(
            'workflow_definition',
            'current_step',
            'created_by',
        )

        if not user.is_superuser:
            accessible_step_ids = get_accessible_step_ids(user)
            qs = qs.filter(
                Q(created_by=user) | Q(current_step_id__in=accessible_step_ids)
            )

        workflow_id = self.request.query_params.get('workflow_id')
        if workflow_id:
            qs = qs.filter(workflow_definition_id=workflow_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        # For detail views, add deep prefetches to eliminate N+1 queries.
        # List view intentionally skips these to keep the bulk query lean.
        if self.action in self._DETAIL_ACTIONS:
            qs = self._apply_detail_prefetches(qs)

        return qs

    @staticmethod
    def _apply_detail_prefetches(qs):
        """
        Adds all prefetch_related / select_related needed by RequestDetailSerializer.

        Without these, a single retrieve on a request with:
          - 5 steps, 10 fields, 3 branches/step → ~30+ queries
        With these, it collapses to 6-7 queries regardless of depth.
        """
        return qs.select_related(
            # WorkflowDefinitionSerializer accesses workflow_definition.created_by.email
            'workflow_definition__created_by',
        ).prefetch_related(
            # StepSerializer.branches → BranchSerializer
            Prefetch(
                'current_step__branches',
                queryset=Branch.objects
                    .select_related('target_step')
                    .order_by('order'),
            ),
            # BranchSerializer.condition_routes → BranchConditionRouteSerializer
            Prefetch(
                'current_step__branches__condition_routes',
                queryset=BranchConditionRoute.objects
                    .select_related('condition', 'target_step')
                    .order_by('order'),
            ),
            # StepSerializer.field_rules → FieldRuleSerializer
            Prefetch(
                'current_step__field_rules',
                queryset=FieldRule.objects
                    .select_related(
                        'field',
                        'visibility_condition',
                        'editable_condition',
                        'required_condition',
                    )
                    .order_by('field__order'),
            ),
            # RequestDataSerializer needs field.key / field.label / field.field_type
            Prefetch(
                'field_data',
                queryset=RequestData.objects
                    .select_related('field')
                    .order_by('field__order'),
            ),
            # get_workflow_steps() iterates all steps for the progress bar
            Prefetch(
                'workflow_definition__steps',
                queryset=Step.objects.order_by('order'),
            ),
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return RequestDetailSerializer
        return RequestSerializer

    def create(self, request, *args, **kwargs):
        ser = RequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        # validate_workflow_definition_id already resolved the WorkflowDefinition object
        wf = ser.validated_data['workflow_definition_id']
        title = ser.validated_data.get('title', '')
        instance = services.create_request(request.user, wf, title)
        return Response(RequestDetailSerializer(instance).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not can_view_request(request.user, instance):
            raise PermissionDenied('You do not have access to this request.')
        data = RequestDetailSerializer(instance).data
        data['permissions'] = get_permissions_for_user(request.user, instance)
        return Response(data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not can_edit_step(request.user, instance):
            raise PermissionDenied('You do not have permission to edit this step.')
        services.save_field_data(instance, request.data.get('field_data', {}))
        data = RequestDetailSerializer(instance).data
        data['permissions'] = get_permissions_for_user(request.user, instance)
        return Response(data)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        instance = self.get_object()
        if not can_view_request(request.user, instance):
            raise PermissionDenied('You do not have access to this request.')
        entries = RequestHistory.objects.filter(request=instance).select_related(
            'from_step', 'to_step', 'branch', 'executed_by'
        )
        return Response(RequestHistorySerializer(entries, many=True).data)

    @action(detail=True, methods=['get'], url_path='form-schema')
    def form_schema(self, request, pk=None):
        """
        Returns the resolved form schema for the request's current step.
        Evaluates dynamic field rules against the request's current data.

        GET /api/workflows/requests/{id}/form-schema/
        """
        instance = self.get_object()
        if not can_view_request(request.user, instance):
            raise PermissionDenied('You do not have access to this request.')

        if not instance.current_step:
            return Response({'detail': 'Request has no active step.'}, status=status.HTTP_200_OK)

        current_data = services.get_request_data_as_dict(instance)
        schema = get_form_service().get_form_schema(instance.current_step, current_data)
        return Response(schema)

    @action(detail=True, methods=['get'], url_path='available-branches')
    def available_branches(self, request, pk=None):
        """
        Returns branches available for the current step evaluated against current data.

        GET /api/workflows/requests/{id}/available-branches/
        """
        instance = self.get_object()
        if not can_view_request(request.user, instance):
            raise PermissionDenied('You do not have access to this request.')

        current_data = services.get_request_data_as_dict(instance)
        branches = get_state_machine().get_available_branches(instance, current_data)
        can_act = can_execute_action(request.user, instance)
        return Response({
            'can_execute': can_act,
            'branches': BranchSerializer(branches, many=True).data,
        })

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        """
        Execute a branch transition on the request.

        POST /api/workflows/requests/{id}/transition/
        Body: {"branch_id": "<uuid>", "field_data": {...}, "notes": ""}
        """
        instance = self.get_object()

        if not can_execute_action(request.user, instance):
            raise PermissionDenied('You do not have permission to act on this step.')

        ser = TransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            branch = Branch.objects.select_related('step', 'target_step').get(
                pk=ser.validated_data['branch_id'],
                step__workflow=instance.workflow_definition,
            )
        except Branch.DoesNotExist:
            raise ValidationError({'branch_id': 'Branch not found.'})

        try:
            updated = get_state_machine().execute(
                request=instance,
                branch=branch,
                field_data=ser.validated_data['field_data'],
                user=request.user,
                notes=ser.validated_data['notes'],
            )
        except TransitionError as exc:
            raise ValidationError({'errors': exc.errors, 'detail': exc.message})

        # Re-fetch the request so the serializer gets a clean object with all
        # relations prefetched for the NEW current_step (which changed during execute).
        # The in-memory `updated` object still has the old step's prefetch cache.
        updated = self._apply_detail_prefetches(
            Request.objects.select_related('workflow_definition', 'current_step', 'created_by')
        ).get(pk=updated.pk)

        data = RequestDetailSerializer(updated).data
        data['permissions'] = get_permissions_for_user(request.user, updated)
        return Response(data)
