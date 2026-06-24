"""
Remove the role-based JSONFields from Step and introduce one Django Group +
3 Permissions per step (Lectura, Escritura, Ejecución).

Existing steps get their group/permissions created by the data migration.
New steps get them via the post_save signal in signals.py.
"""
from django.db import migrations


STEP_PERMISSIONS = [
    ('step_view', 'Lectura - Ver el paso'),
    ('step_edit', 'Escritura - Editar campos y guardar'),
    ('step_execute', 'Ejecución - Ejecutar branches'),
]


def create_groups_for_existing_steps(apps, schema_editor):
    from django.db.models.signals import post_save
    from apps.workflows.models import Step as Step_real
    from apps.workflows import signals as wf_signals

    Step = apps.get_model('workflows', 'Step')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    Permission = apps.get_model('auth', 'Permission')
    Group = apps.get_model('auth', 'Group')

    ct, _ = ContentType.objects.get_or_create(app_label='workflows', model='step')

    post_save.disconnect(wf_signals.on_step_created, sender=Step_real)
    try:
        for step in Step.objects.all():
            step_id_str = str(step.id).replace('-', '')
            group_name = f"step:{step.id}"
            Group.objects.get_or_create(name=group_name)
            for prefix, desc in STEP_PERMISSIONS:
                codename = f"{prefix}_{step_id_str}"
                Permission.objects.get_or_create(
                    codename=codename,
                    content_type=ct,
                    defaults={'name': desc},
                )
    finally:
        post_save.connect(wf_signals.on_step_created, sender=Step_real)


def delete_groups_for_existing_steps(apps, schema_editor):
    Step = apps.get_model('workflows', 'Step')
    Permission = apps.get_model('auth', 'Permission')
    Group = apps.get_model('auth', 'Group')

    for step in Step.objects.all():
        hex_id = str(step.id).replace('-', '')
        codenames = [
            f"step_view_{hex_id}",
            f"step_edit_{hex_id}",
            f"step_execute_{hex_id}",
        ]
        Permission.objects.filter(codename__in=codenames).delete()
        Group.objects.filter(name=f"step:{step.id}").delete()


class Migration(migrations.Migration):

    dependencies = [
        ('workflows', '0006_workflowdefinition_show_in_menu'),
        ('contenttypes', '0002_remove_content_type_name'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RemoveField(model_name='step', name='allowed_roles_to_view'),
        migrations.RemoveField(model_name='step', name='allowed_roles_to_edit'),
        migrations.RemoveField(model_name='step', name='allowed_roles_to_act'),
        migrations.RunPython(create_groups_for_existing_steps, delete_groups_for_existing_steps),
    ]
