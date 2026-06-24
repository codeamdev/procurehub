"""
Signals for the workflows app.
Auto-creates/deletes a Django Group and 3 Permissions per Step.
"""
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

STEP_PERMISSIONS = [
    ('step_view', 'Lectura - Ver el paso'),
    ('step_edit', 'Escritura - Editar campos y guardar'),
    ('step_execute', 'Ejecución - Ejecutar branches'),
]


def step_group_name(step_id):
    return f"step:{step_id}"


def step_perm_codename(step_id, prefix):
    return f"{prefix}_{str(step_id).replace('-', '')}"


def create_step_group_and_perms(step):
    from django.contrib.auth.models import Group, Permission
    from django.contrib.contenttypes.models import ContentType
    from .models import Step

    ct = ContentType.objects.get_for_model(Step)
    for prefix, desc in STEP_PERMISSIONS:
        Permission.objects.get_or_create(
            codename=step_perm_codename(step.id, prefix),
            content_type=ct,
            defaults={'name': f'{desc}'},
        )
    Group.objects.get_or_create(name=step_group_name(step.id))


def delete_step_group_and_perms(step_id):
    from django.contrib.auth.models import Group, Permission

    codenames = [step_perm_codename(step_id, prefix) for prefix, _ in STEP_PERMISSIONS]
    Permission.objects.filter(codename__in=codenames).delete()
    Group.objects.filter(name=step_group_name(step_id)).delete()


@receiver(post_save, sender='workflows.Step')
def on_step_created(sender, instance, created, **kwargs):
    if created:
        create_step_group_and_perms(instance)


@receiver(pre_delete, sender='workflows.Step')
def on_step_deleted(sender, instance, **kwargs):
    delete_step_group_and_perms(instance.id)
