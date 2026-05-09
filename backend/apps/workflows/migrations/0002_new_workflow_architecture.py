"""
Migration 0002: Replace the basic workflow models with the full architecture.

Removes: Workflow, WorkflowStep, WorkflowAction, WorkflowRequest
Creates:  WorkflowDefinition, Step, Field, FieldRule, Branch,
          Request, RequestData, RequestHistory
"""

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workflows', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Drop old models (FK-safe order) ───────────────────────────────────
        migrations.DeleteModel(name='WorkflowAction'),
        migrations.DeleteModel(name='WorkflowRequest'),
        migrations.DeleteModel(name='WorkflowStep'),
        migrations.DeleteModel(name='Workflow'),

        # ── WorkflowDefinition ────────────────────────────────────────────────
        migrations.CreateModel(
            name='WorkflowDefinition',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                )),
                ('family_id', models.UUIDField(default=uuid.uuid4, db_index=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('version', models.PositiveIntegerField(default=1)),
                ('status', models.CharField(
                    choices=[('draft', 'Draft'), ('active', 'Active'), ('deprecated', 'Deprecated')],
                    default='draft',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_workflows',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddConstraint(
            model_name='workflowdefinition',
            constraint=models.UniqueConstraint(
                fields=['family_id', 'version'],
                name='unique_workflow_family_version',
            ),
        ),

        # ── Step ──────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Step',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                )),
                ('name', models.CharField(max_length=255)),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_initial', models.BooleanField(default=False)),
                ('is_final', models.BooleanField(default=False)),
                ('allowed_roles_to_view', models.JSONField(default=list)),
                ('allowed_roles_to_edit', models.JSONField(default=list)),
                ('allowed_roles_to_act', models.JSONField(default=list)),
                ('workflow', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='steps',
                    to='workflows.workflowdefinition',
                )),
            ],
            options={'ordering': ['order']},
        ),

        # ── Field ─────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Field',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                )),
                ('key', models.CharField(max_length=100)),
                ('label', models.CharField(max_length=255)),
                ('field_type', models.CharField(
                    choices=[
                        ('text', 'Text'), ('textarea', 'Textarea'), ('number', 'Number'),
                        ('date', 'Date'), ('datetime', 'DateTime'), ('boolean', 'Boolean'),
                        ('select', 'Select'), ('multiselect', 'Multi-Select'),
                        ('file', 'File'), ('email', 'Email'), ('phone', 'Phone'),
                        ('currency', 'Currency'),
                    ],
                    default='text',
                    max_length=30,
                )),
                ('options', models.JSONField(blank=True, default=list)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('order', models.PositiveIntegerField(default=0)),
                ('workflow', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='fields',
                    to='workflows.workflowdefinition',
                )),
            ],
            options={'ordering': ['order']},
        ),
        migrations.AddConstraint(
            model_name='field',
            constraint=models.UniqueConstraint(
                fields=['workflow', 'key'], name='unique_field_key_per_workflow'
            ),
        ),

        # ── FieldRule ─────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='FieldRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('is_visible', models.BooleanField(default=True)),
                ('is_editable', models.BooleanField(default=True)),
                ('is_required', models.BooleanField(default=False)),
                ('condition', models.JSONField(blank=True, null=True)),
                ('field', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='rules',
                    to='workflows.field',
                )),
                ('step', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='field_rules',
                    to='workflows.step',
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name='fieldrule',
            constraint=models.UniqueConstraint(
                fields=['field', 'step'], name='unique_field_rule_per_step'
            ),
        ),

        # ── Branch ────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Branch',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                )),
                ('label', models.CharField(max_length=255)),
                ('style', models.CharField(
                    choices=[
                        ('primary', 'Primary'), ('secondary', 'Secondary'),
                        ('danger', 'Danger'), ('warning', 'Warning'),
                    ],
                    default='primary',
                    max_length=20,
                )),
                ('order', models.PositiveIntegerField(default=0)),
                ('terminal_status', models.CharField(
                    blank=True,
                    choices=[('completed', 'Completed'), ('cancelled', 'Cancelled')],
                    max_length=20,
                    null=True,
                )),
                ('condition', models.JSONField(blank=True, null=True)),
                ('validations', models.JSONField(blank=True, null=True)),
                ('effects', models.JSONField(blank=True, default=list)),
                ('step', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='branches',
                    to='workflows.step',
                )),
                ('target_step', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='incoming_branches',
                    to='workflows.step',
                )),
            ],
            options={'ordering': ['order']},
        ),

        # ── Request ───────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Request',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                )),
                ('status', models.CharField(
                    choices=[
                        ('active', 'Active'),
                        ('completed', 'Completed'),
                        ('cancelled', 'Cancelled'),
                    ],
                    default='active',
                    max_length=20,
                )),
                ('title', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='workflow_requests',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('current_step', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='active_requests',
                    to='workflows.step',
                )),
                ('workflow_definition', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='requests',
                    to='workflows.workflowdefinition',
                )),
            ],
            options={'ordering': ['-created_at']},
        ),

        # ── RequestData ───────────────────────────────────────────────────────
        migrations.CreateModel(
            name='RequestData',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('value', models.JSONField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('field', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='request_data',
                    to='workflows.field',
                )),
                ('request', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='field_data',
                    to='workflows.request',
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name='requestdata',
            constraint=models.UniqueConstraint(
                fields=['request', 'field'], name='unique_request_field_value'
            ),
        ),

        # ── RequestHistory ────────────────────────────────────────────────────
        migrations.CreateModel(
            name='RequestHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('executed_at', models.DateTimeField(auto_now_add=True)),
                ('data_snapshot', models.JSONField(default=dict)),
                ('notes', models.TextField(blank=True)),
                ('branch', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to='workflows.branch',
                )),
                ('executed_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('from_step', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to='workflows.step',
                )),
                ('request', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='history',
                    to='workflows.request',
                )),
                ('to_step', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to='workflows.step',
                )),
            ],
            options={'ordering': ['executed_at']},
        ),
    ]
