from django.contrib import admin
from .models import (
    WorkflowDefinition, Step, Field, FieldRule,
    Branch, Request, RequestData, RequestHistory,
)


class StepInline(admin.TabularInline):
    model = Step
    extra = 0
    fields = ('name', 'order', 'is_initial', 'is_final')
    ordering = ('order',)


class FieldInline(admin.TabularInline):
    model = Field
    extra = 0
    fields = ('key', 'label', 'field_type', 'order')
    ordering = ('order',)


@admin.register(WorkflowDefinition)
class WorkflowDefinitionAdmin(admin.ModelAdmin):
    list_display = ('name', 'version', 'status', 'created_by', 'created_at')
    list_filter = ('status',)
    search_fields = ('name',)
    readonly_fields = ('id', 'family_id', 'created_at', 'updated_at')
    inlines = [StepInline, FieldInline]


class FieldRuleInline(admin.TabularInline):
    model = FieldRule
    extra = 0
    fields = ('field', 'is_visible', 'is_editable', 'is_required')


class BranchInline(admin.TabularInline):
    model = Branch
    extra = 0
    fields = ('label', 'style', 'order', 'target_step', 'terminal_status')
    fk_name = 'step'


@admin.register(Step)
class StepAdmin(admin.ModelAdmin):
    list_display = ('name', 'workflow', 'order', 'is_initial', 'is_final')
    list_filter = ('workflow',)
    inlines = [FieldRuleInline, BranchInline]


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ('key', 'label', 'field_type', 'workflow', 'order')
    list_filter = ('field_type', 'workflow')
    search_fields = ('key', 'label')


@admin.register(FieldRule)
class FieldRuleAdmin(admin.ModelAdmin):
    list_display = ('field', 'step', 'is_visible', 'is_editable', 'is_required')
    list_filter = ('step__workflow',)


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ('label', 'step', 'style', 'order', 'target_step', 'terminal_status')
    list_filter = ('step__workflow', 'style')


class RequestDataInline(admin.TabularInline):
    model = RequestData
    extra = 0
    fields = ('field', 'value', 'updated_at')
    readonly_fields = ('updated_at',)


class RequestHistoryInline(admin.TabularInline):
    model = RequestHistory
    extra = 0
    fields = ('from_step', 'to_step', 'branch', 'executed_by', 'executed_at')
    readonly_fields = ('executed_at',)


@admin.register(Request)
class RequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'workflow_definition', 'current_step', 'status', 'created_by', 'created_at')
    list_filter = ('status', 'workflow_definition')
    search_fields = ('title', 'created_by__email')
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [RequestDataInline, RequestHistoryInline]


@admin.register(RequestHistory)
class RequestHistoryAdmin(admin.ModelAdmin):
    list_display = ('request', 'from_step', 'to_step', 'branch', 'executed_by', 'executed_at')
    list_filter = ('request__workflow_definition',)
    readonly_fields = ('executed_at',)
