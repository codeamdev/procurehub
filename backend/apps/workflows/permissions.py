"""
Workflow permission utilities — centralized, reusable.
Used by views and injected into API responses.
"""

_DEFAULT_ROLES = ('admin', 'buyer')


# ── Step-level access ─────────────────────────────────────────────────────────

def _check_step_role(user, step, role_list_attr: str) -> bool:
    if step is None:
        return user.role in _DEFAULT_ROLES
    allowed = getattr(step, role_list_attr, [])
    if not allowed:
        return user.role in _DEFAULT_ROLES
    return user.role in allowed


def can_view_request(user, request) -> bool:
    return _check_step_role(user, request.current_step, 'allowed_roles_to_view')


def can_edit_step(user, request) -> bool:
    if not request.is_active:
        return False
    return _check_step_role(user, request.current_step, 'allowed_roles_to_edit')


def can_execute_action(user, request) -> bool:
    if not request.is_active:
        return False
    return _check_step_role(user, request.current_step, 'allowed_roles_to_act')


def get_permissions_for_user(user, request) -> dict:
    return {
        'can_view': can_view_request(user, request),
        'can_edit': can_edit_step(user, request),
        'can_act': can_execute_action(user, request),
    }
