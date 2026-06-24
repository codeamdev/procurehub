"""
Workflow permission utilities — centralized, reusable.
Uses Django Groups and Permissions per step (one group + 3 perms per step).
"""
import uuid
from django.contrib.auth.models import Permission
from django.db.models import Q


def _step_perm_codename(step_id, perm_type):
    return f"{perm_type}_{str(step_id).replace('-', '')}"


def _user_has_step_perm(user, step, perm_type) -> bool:
    if step is None:
        return False
    codename = _step_perm_codename(step.id, perm_type)
    return user.has_perm(f'workflows.{codename}')


# ── Step-level access ─────────────────────────────────────────────────────────

def can_view_request(user, request) -> bool:
    if request.created_by_id == user.pk:
        return True
    # Active requests: standard step permission check.
    if request.current_step is not None:
        return _user_has_step_perm(user, request.current_step, 'step_view')
    # Completed/cancelled: current_step is None.
    # Grant access if the user executed any action on this request.
    from .models import RequestHistory
    return RequestHistory.objects.filter(
        request=request,
        executed_by=user,
    ).exists()


def can_edit_step(user, request) -> bool:
    if not request.is_active:
        return False
    return _user_has_step_perm(user, request.current_step, 'step_edit')


def can_execute_action(user, request) -> bool:
    if not request.is_active:
        return False
    return _user_has_step_perm(user, request.current_step, 'step_execute')


def get_permissions_for_user(user, request) -> dict:
    return {
        'can_view': can_view_request(user, request),
        'can_edit': can_edit_step(user, request),
        'can_act': can_execute_action(user, request),
    }


# ── Queryset helpers ──────────────────────────────────────────────────────────

def get_accessible_step_ids(user) -> list:
    """Return UUIDs of steps where the user has step_view permission (via groups or directly)."""
    view_perms = (
        Permission.objects
        .filter(
            codename__startswith='step_view_',
            content_type__app_label='workflows',
        )
        .filter(Q(group__user=user) | Q(user=user))
        .values_list('codename', flat=True)
    )
    step_ids = []
    prefix_len = len('step_view_')
    for codename in view_perms:
        hex_id = codename[prefix_len:]
        try:
            step_ids.append(uuid.UUID(hex_id))
        except ValueError:
            pass
    return step_ids
