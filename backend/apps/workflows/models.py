import uuid
from django.db import models
from django.conf import settings


class FieldType(models.TextChoices):
    TEXT = 'text', 'Text'
    TEXTAREA = 'textarea', 'Textarea'
    NUMBER = 'number', 'Number'
    DATE = 'date', 'Date'
    DATETIME = 'datetime', 'DateTime'
    BOOLEAN = 'boolean', 'Boolean'
    SELECT = 'select', 'Select'
    MULTISELECT = 'multiselect', 'Multi-Select'
    FILE = 'file', 'File'
    EMAIL = 'email', 'Email'
    PHONE = 'phone', 'Phone'
    CURRENCY = 'currency', 'Currency'


class WorkflowDefinition(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        DEPRECATED = 'deprecated', 'Deprecated'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # family_id groups all versions of the same workflow together
    family_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    code_prefix = models.CharField(max_length=20, blank=True, default='')
    show_in_menu = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_workflows',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['family_id', 'version'],
                name='unique_workflow_family_version',
            )
        ]

    def __str__(self):
        return f"{self.name} v{self.version} ({self.status})"

    @property
    def is_editable(self):
        return self.status == self.Status.DRAFT


class Step(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE, related_name='steps'
    )
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    is_initial = models.BooleanField(default=False)
    is_final = models.BooleanField(default=False)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.workflow.name} → {self.name}"


class Field(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE, related_name='fields'
    )
    # Programmatic key used in data storage and conditions: "vendor_name"
    key = models.CharField(max_length=100)
    label = models.CharField(max_length=255)
    field_type = models.CharField(
        max_length=30, choices=FieldType.choices, default=FieldType.TEXT
    )
    # For SELECT / MULTISELECT: list of option strings or {value, label} objects
    options = models.JSONField(default=list, blank=True)
    # Type-specific config: min/max for numbers, regex for text, etc.
    metadata = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(
                fields=['workflow', 'key'], name='unique_field_key_per_workflow'
            )
        ]

    def __str__(self):
        return f"{self.workflow.name} / {self.key}"


class FieldRule(models.Model):
    """Controls visibility, editability, and required state of a field per step.

    Static flags (is_visible, is_editable, is_required) are the default when no
    condition function is assigned. When a condition FK is set, the Python function
    is evaluated at runtime against the current request data and its result overrides
    the static flag.
    """
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name='rules')
    step = models.ForeignKey(Step, on_delete=models.CASCADE, related_name='field_rules')
    is_visible = models.BooleanField(default=True)
    is_editable = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)
    # Python condition functions (WorkflowCondition) that override the static flags.
    visibility_condition = models.ForeignKey(
        'WorkflowCondition', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='visibility_rules',
    )
    editable_condition = models.ForeignKey(
        'WorkflowCondition', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='editable_rules',
    )
    required_condition = models.ForeignKey(
        'WorkflowCondition', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='required_rules',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'step'], name='unique_field_rule_per_step'
            )
        ]

    def __str__(self):
        return f"{self.step.name} / {self.field.key}"


class Branch(models.Model):
    """
    A button/action available on a step that drives workflow transitions.
    Replaces the old WorkflowAction with full condition + validation + effects support.
    """
    class Style(models.TextChoices):
        PRIMARY = 'primary', 'Primary'
        SECONDARY = 'secondary', 'Secondary'
        DANGER = 'danger', 'Danger'
        WARNING = 'warning', 'Warning'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    step = models.ForeignKey(Step, on_delete=models.CASCADE, related_name='branches')
    label = models.CharField(max_length=255)
    style = models.CharField(max_length=20, choices=Style.choices, default=Style.PRIMARY)
    order = models.PositiveIntegerField(default=0)
    # null target_step = terminal transition (ends the request)
    target_step = models.ForeignKey(
        Step,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incoming_branches',
    )
    # Only used when target_step is null — determines final request status
    terminal_status = models.CharField(
        max_length=20,
        choices=[('completed', 'Completed'), ('cancelled', 'Cancelled')],
        null=True,
        blank=True,
    )
    # JSON condition tree: when to SHOW this branch (evaluated server + client)
    condition = models.JSONField(null=True, blank=True)
    # JSON condition tree: rules that MUST pass before execution is allowed
    validations = models.JSONField(null=True, blank=True)
    # JSON list of side effects to fire after a successful transition
    # Example: [{"type": "NOTIFY", "to": "requester", "template": "approved"}]
    effects = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        target = self.target_step.name if self.target_step else f'[{self.terminal_status}]'
        return f"{self.step.name} →[{self.label}]→ {target}"


class Request(models.Model):
    """
    A running instance of a workflow.
    Always points to the exact workflow version used at creation — never migrated.
    """
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_definition = models.ForeignKey(
        WorkflowDefinition,
        on_delete=models.PROTECT,
        related_name='requests',
    )
    current_step = models.ForeignKey(
        Step,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_requests',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    code = models.CharField(max_length=60, blank=True, unique=True)
    title = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workflow_requests',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Request {self.id} — {self.workflow_definition.name}"

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE


class RequestData(models.Model):
    """Normalized per-field value storage for a request."""
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name='field_data')
    field = models.ForeignKey(Field, on_delete=models.PROTECT, related_name='request_data')
    # All values stored as JSON to support any field type without schema changes
    value = models.JSONField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['request', 'field'], name='unique_request_field_value'
            )
        ]

    def __str__(self):
        return f"[{self.request_id}] {self.field.key} = {self.value}"


class WorkflowCondition(models.Model):
    """
    A reusable Python condition function scoped to a workflow (and implicitly to a tenant).
    The code must assign `result = True` or `result = False`.
    Available variables: data (dict of field_key→value), request (Request instance).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE, related_name='conditions'
    )
    name = models.CharField(max_length=100)
    label = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    code = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['workflow', 'name'],
                name='unique_condition_name_per_workflow',
            )
        ]

    def __str__(self):
        return f"{self.workflow.name} / {self.name}"


class BranchConditionRoute(models.Model):
    """
    Conditional routing rule for a Branch.
    Routes are evaluated in order; the first matching route determines the destination.
    condition=null  → default/else route (always matches).
    target_step=null AND terminal_status=null → stay on current step (data saved, no move).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch, on_delete=models.CASCADE, related_name='condition_routes'
    )
    condition = models.ForeignKey(
        WorkflowCondition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='branch_routes',
    )
    order = models.PositiveIntegerField(default=0)
    target_step = models.ForeignKey(
        Step,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incoming_condition_routes',
    )
    terminal_status = models.CharField(
        max_length=20,
        choices=[('completed', 'Completed'), ('cancelled', 'Cancelled')],
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        cond = self.condition.name if self.condition else 'default'
        if self.target_step:
            target = self.target_step.name
        elif self.terminal_status:
            target = f'[{self.terminal_status}]'
        else:
            target = '[stay]'
        return f"{self.branch.label} / [{cond}] → {target}"


class RequestCodeCounter(models.Model):
    """
    Atomic per-(family_id, year) counter for Request.code generation.
    select_for_update() on this row (always exists) eliminates the race
    that occurs when select_for_update on an empty Request queryset locks nothing.
    """
    family_id = models.UUIDField()
    year = models.PositiveIntegerField()
    last_seq = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['family_id', 'year'],
                name='unique_code_counter_family_year',
            )
        ]


class RequestHistory(models.Model):
    """Immutable audit trail. One entry per branch execution."""
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name='history')
    from_step = models.ForeignKey(
        Step, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    to_step = models.ForeignKey(
        Step, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+',
    )
    executed_at = models.DateTimeField(auto_now_add=True)
    # Point-in-time snapshot: {field_key: value} for full reproducibility
    data_snapshot = models.JSONField(default=dict)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['executed_at']

    def __str__(self):
        return f"[{self.request_id}] {self.from_step} → {self.to_step} at {self.executed_at}"
