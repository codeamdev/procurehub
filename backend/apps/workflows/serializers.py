from rest_framework import serializers
from .models import (
    WorkflowDefinition, Step, Field, FieldRule,
    Branch, Request, RequestData, RequestHistory,
    WorkflowCondition, BranchConditionRoute,
)


# ── WorkflowCondition ─────────────────────────────────────────────────────────

class WorkflowConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowCondition
        fields = ('id', 'name', 'label', 'description', 'code', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class WorkflowConditionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowCondition
        fields = ('name', 'label', 'description', 'code')

    def validate_name(self, value):
        import re
        if not re.match(r'^[a-z][a-z0-9_]*$', value):
            raise serializers.ValidationError(
                'El nombre debe ser alfanumérico en minúsculas/guión_bajo y comenzar con letra.'
            )
        return value

    def validate_code(self, value):
        from .engine.python_evaluator import validate_condition_code
        errors = validate_condition_code(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value


# ── BranchConditionRoute ──────────────────────────────────────────────────────

class BranchConditionRouteSerializer(serializers.ModelSerializer):
    condition_id = serializers.SerializerMethodField()
    condition_name = serializers.SerializerMethodField()
    condition_label = serializers.SerializerMethodField()
    target_step_id = serializers.SerializerMethodField()
    target_step_name = serializers.SerializerMethodField()

    class Meta:
        model = BranchConditionRoute
        fields = (
            'id', 'order',
            'condition_id', 'condition_name', 'condition_label',
            'target_step_id', 'target_step_name',
            'terminal_status',
        )

    def get_condition_id(self, obj):
        return str(obj.condition_id) if obj.condition_id else None

    def get_condition_name(self, obj):
        return obj.condition.name if obj.condition else None

    def get_condition_label(self, obj):
        return obj.condition.label if obj.condition else None

    def get_target_step_id(self, obj):
        return str(obj.target_step_id) if obj.target_step_id else None

    def get_target_step_name(self, obj):
        return obj.target_step.name if obj.target_step else None


class BranchConditionRouteWriteSerializer(serializers.ModelSerializer):
    condition_id = serializers.UUIDField(allow_null=True, required=False)
    target_step_id = serializers.UUIDField(allow_null=True, required=False)

    class Meta:
        model = BranchConditionRoute
        fields = ('order', 'condition_id', 'target_step_id', 'terminal_status')

    def validate(self, data):
        condition_id = data.pop('condition_id', None)
        target_step_id = data.pop('target_step_id', None)

        if condition_id:
            try:
                data['condition'] = WorkflowCondition.objects.get(pk=condition_id)
            except WorkflowCondition.DoesNotExist:
                raise serializers.ValidationError({'condition_id': 'Condición no encontrada.'})
        else:
            data['condition'] = None

        if target_step_id:
            try:
                data['target_step'] = Step.objects.get(pk=target_step_id)
            except Step.DoesNotExist:
                raise serializers.ValidationError({'target_step_id': 'Paso no encontrado.'})
        else:
            data['target_step'] = None

        return data


# ── Branch ────────────────────────────────────────────────────────────────────

class BranchSerializer(serializers.ModelSerializer):
    target_step_id = serializers.PrimaryKeyRelatedField(
        source='target_step',
        queryset=Step.objects.all(),
        allow_null=True,
        required=False,
        pk_field=serializers.UUIDField(),
    )
    condition_routes = BranchConditionRouteSerializer(many=True, read_only=True)

    class Meta:
        model = Branch
        fields = (
            'id', 'label', 'style', 'order',
            'target_step_id', 'terminal_status',
            'condition', 'validations', 'effects',
            'condition_routes',
        )


# ── FieldRule ─────────────────────────────────────────────────────────────────

class FieldRuleSerializer(serializers.ModelSerializer):
    field_id = serializers.UUIDField(source='field.id', read_only=True)
    field_key = serializers.CharField(source='field.key', read_only=True)
    visibility_condition_id = serializers.SerializerMethodField()
    visibility_condition_name = serializers.SerializerMethodField()
    editable_condition_id = serializers.SerializerMethodField()
    editable_condition_name = serializers.SerializerMethodField()
    required_condition_id = serializers.SerializerMethodField()
    required_condition_name = serializers.SerializerMethodField()

    class Meta:
        model = FieldRule
        fields = (
            'id', 'field_id', 'field_key',
            'is_visible', 'is_editable', 'is_required',
            'visibility_condition_id', 'visibility_condition_name',
            'editable_condition_id', 'editable_condition_name',
            'required_condition_id', 'required_condition_name',
        )

    def get_visibility_condition_id(self, obj):
        return str(obj.visibility_condition_id) if obj.visibility_condition_id else None

    def get_visibility_condition_name(self, obj):
        return obj.visibility_condition.name if obj.visibility_condition_id else None

    def get_editable_condition_id(self, obj):
        return str(obj.editable_condition_id) if obj.editable_condition_id else None

    def get_editable_condition_name(self, obj):
        return obj.editable_condition.name if obj.editable_condition_id else None

    def get_required_condition_id(self, obj):
        return str(obj.required_condition_id) if obj.required_condition_id else None

    def get_required_condition_name(self, obj):
        return obj.required_condition.name if obj.required_condition_id else None


# ── Step ──────────────────────────────────────────────────────────────────────

class StepMinimalSerializer(serializers.ModelSerializer):
    """Lightweight step info used in request responses for the progress bar."""
    class Meta:
        model = Step
        fields = ('id', 'name', 'order', 'is_initial', 'is_final')


class StepSerializer(serializers.ModelSerializer):
    branches = BranchSerializer(many=True, read_only=True)
    field_rules = FieldRuleSerializer(many=True, read_only=True)

    class Meta:
        model = Step
        fields = (
            'id', 'name', 'order', 'is_initial', 'is_final',
            'allowed_roles_to_view', 'allowed_roles_to_edit', 'allowed_roles_to_act',
            'branches', 'field_rules',
        )


# ── Field ─────────────────────────────────────────────────────────────────────

class FieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = Field
        fields = ('id', 'key', 'label', 'field_type', 'options', 'metadata', 'order')


# ── WorkflowDefinition ────────────────────────────────────────────────────────

class WorkflowDefinitionSerializer(serializers.ModelSerializer):
    """Flat serializer for list views."""
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = WorkflowDefinition
        fields = (
            'id', 'family_id', 'name', 'description',
            'version', 'status', 'show_in_menu', 'created_by_email', 'created_at',
        )
        read_only_fields = ('id', 'family_id', 'version', 'created_at')


class WorkflowDefinitionDetailSerializer(serializers.ModelSerializer):
    """Full nested serializer for detail/builder views."""
    steps = StepSerializer(many=True, read_only=True)
    fields = FieldSerializer(many=True, read_only=True)
    conditions = WorkflowConditionSerializer(many=True, read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = WorkflowDefinition
        fields = (
            'id', 'family_id', 'name', 'description',
            'version', 'status', 'show_in_menu', 'is_editable',
            'created_by_email', 'created_at', 'updated_at',
            'steps', 'fields', 'conditions',
        )
        read_only_fields = ('id', 'family_id', 'version', 'created_at', 'updated_at', 'is_editable')


# ── Step write serializers ────────────────────────────────────────────────────

class StepWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Step
        fields = (
            'name', 'order', 'is_initial', 'is_final',
            'allowed_roles_to_view', 'allowed_roles_to_edit', 'allowed_roles_to_act',
        )


class FieldWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Field
        fields = ('key', 'label', 'field_type', 'options', 'metadata', 'order')

    def validate_key(self, value):
        import re
        if not re.match(r'^[a-z][a-z0-9_]*$', value):
            raise serializers.ValidationError(
                "Key must be lowercase alphanumeric/underscore and start with a letter."
            )
        return value


class FieldRuleWriteSerializer(serializers.ModelSerializer):
    field_id = serializers.UUIDField(write_only=True)
    step_id = serializers.UUIDField(write_only=True)
    visibility_condition_id = serializers.UUIDField(allow_null=True, required=False)
    editable_condition_id = serializers.UUIDField(allow_null=True, required=False)
    required_condition_id = serializers.UUIDField(allow_null=True, required=False)

    class Meta:
        model = FieldRule
        fields = (
            'field_id', 'step_id',
            'is_visible', 'is_editable', 'is_required',
            'visibility_condition_id', 'editable_condition_id', 'required_condition_id',
        )

    def _resolve_condition(self, data, key):
        cond_id = data.pop(key, None)
        model_key = key.replace('_id', '')
        if cond_id:
            try:
                data[model_key] = WorkflowCondition.objects.get(pk=cond_id)
            except WorkflowCondition.DoesNotExist:
                raise serializers.ValidationError({key: 'Condición no encontrada.'})
        else:
            data[model_key] = None
        return data

    def validate(self, data):
        try:
            field = Field.objects.get(pk=data['field_id'])
        except Field.DoesNotExist:
            raise serializers.ValidationError({'field_id': 'Field not found.'})
        try:
            step = Step.objects.get(pk=data['step_id'])
        except Step.DoesNotExist:
            raise serializers.ValidationError({'step_id': 'Step not found.'})
        if field.workflow_id != step.workflow_id:
            raise serializers.ValidationError(
                'Field and Step must belong to the same workflow.'
            )
        data['field'] = field
        data['step'] = step
        data = self._resolve_condition(data, 'visibility_condition_id')
        data = self._resolve_condition(data, 'editable_condition_id')
        data = self._resolve_condition(data, 'required_condition_id')
        return data

    def create(self, validated_data):
        validated_data.pop('field_id', None)
        validated_data.pop('step_id', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('field_id', None)
        validated_data.pop('step_id', None)
        return super().update(instance, validated_data)


class BranchWriteSerializer(serializers.ModelSerializer):
    target_step_id = serializers.UUIDField(allow_null=True, required=False)

    class Meta:
        model = Branch
        fields = (
            'label', 'style', 'order',
            'target_step_id', 'terminal_status',
            'condition', 'validations', 'effects',
        )

    def validate(self, data):
        target_id = data.pop('target_step_id', None)
        if target_id:
            try:
                data['target_step'] = Step.objects.get(pk=target_id)
            except Step.DoesNotExist:
                raise serializers.ValidationError({'target_step_id': 'Step not found.'})
        else:
            data['target_step'] = None
            # terminal_status not required when condition_routes handle routing
        return data


# ── Request serializers ───────────────────────────────────────────────────────

class RequestDataSerializer(serializers.ModelSerializer):
    field_key = serializers.CharField(source='field.key', read_only=True)
    field_label = serializers.CharField(source='field.label', read_only=True)
    field_type = serializers.CharField(source='field.field_type', read_only=True)

    class Meta:
        model = RequestData
        fields = ('field_key', 'field_label', 'field_type', 'value', 'updated_at')
        read_only_fields = ('updated_at',)


class RequestSerializer(serializers.ModelSerializer):
    """Flat serializer for list views."""
    workflow_name = serializers.CharField(
        source='workflow_definition.name', read_only=True
    )
    workflow_version = serializers.IntegerField(
        source='workflow_definition.version', read_only=True
    )
    current_step_name = serializers.CharField(
        source='current_step.name', read_only=True
    )
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    workflow_definition_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = Request
        fields = (
            'id', 'title', 'status',
            'workflow_definition_id', 'workflow_name', 'workflow_version',
            'current_step_name', 'created_by_email',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'status', 'workflow_name', 'workflow_version',
            'current_step_name', 'created_by_email', 'created_at', 'updated_at',
        )

    def validate_workflow_definition_id(self, value):
        try:
            wf = WorkflowDefinition.objects.get(pk=value, status=WorkflowDefinition.Status.ACTIVE)
        except WorkflowDefinition.DoesNotExist:
            raise serializers.ValidationError(
                'Workflow not found or is not active.'
            )
        return wf


class RequestDetailSerializer(serializers.ModelSerializer):
    """Full serializer for request detail view."""
    workflow_definition = WorkflowDefinitionSerializer(read_only=True)
    workflow_steps = serializers.SerializerMethodField()
    current_step = StepSerializer(read_only=True)
    field_data = RequestDataSerializer(many=True, read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = Request
        fields = (
            'id', 'title', 'status',
            'workflow_definition', 'workflow_steps', 'current_step',
            'field_data', 'created_by_email',
            'created_at', 'updated_at',
        )
        read_only_fields = fields

    def get_workflow_steps(self, obj):
        # Use .all() so Django returns the prefetch_related cache when available.
        # order_by() would create a new queryset and bypass the cache.
        steps = sorted(obj.workflow_definition.steps.all(), key=lambda s: s.order)
        return StepMinimalSerializer(steps, many=True).data


class RequestHistorySerializer(serializers.ModelSerializer):
    from_step_name = serializers.CharField(source='from_step.name', read_only=True)
    to_step_name = serializers.CharField(source='to_step.name', read_only=True)
    branch_label = serializers.CharField(source='branch.label', read_only=True)
    executed_by_email = serializers.EmailField(source='executed_by.email', read_only=True)

    class Meta:
        model = RequestHistory
        fields = (
            'id', 'from_step_name', 'to_step_name', 'branch_label',
            'executed_by_email', 'executed_at', 'data_snapshot', 'notes',
        )


# ── Transition serializer (used by Phase 3 engine) ────────────────────────────

class TransitionSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    field_data = serializers.DictField(required=False, default=dict)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
