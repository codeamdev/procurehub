import logging
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from apps.common.exceptions import AppError, NotFoundError, ConflictError

logger = logging.getLogger(__name__)
User = get_user_model()


# ── Token helpers ─────────────────────────────────────────────────────────────

def issue_tokens(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def blacklist_token(refresh_token_str: str) -> None:
    if not refresh_token_str:
        raise AppError('Refresh token is required.', code='token_missing')
    try:
        RefreshToken(refresh_token_str).blacklist()
    except TokenError as exc:
        raise AppError('Invalid or expired refresh token.', code='token_invalid') from exc


# ── Authentication ────────────────────────────────────────────────────────────

def authenticate_user(request, email: str, password: str):
    """Returns (user, tokens) or raises AppError."""
    if not email or not password:
        raise AppError('Email and password are required.', code='missing_credentials')
    user = authenticate(request, username=email, password=password)
    if not user:
        raise AppError('Invalid email or password.', code='invalid_credentials')
    tokens = issue_tokens(user)
    logger.info('User %d authenticated successfully', user.pk)
    return user, tokens


# ── Supplier approval ─────────────────────────────────────────────────────────

def _get_supplier(supplier_id: int) -> 'User':
    try:
        user = User.objects.get(pk=supplier_id, role=User.Role.SUPPLIER)
    except User.DoesNotExist:
        raise NotFoundError('Supplier not found.')
    return user


def approve_supplier(approver, supplier_id: int):
    supplier = _get_supplier(supplier_id)
    if supplier.is_approved:
        raise ConflictError('Supplier is already approved.')
    supplier.is_approved = True
    supplier.save(update_fields=['is_approved'])
    logger.info('Supplier %d approved by user %d', supplier.pk, approver.pk)
    return supplier


def reject_supplier(approver, supplier_id: int):
    supplier = _get_supplier(supplier_id)
    if not supplier.is_approved:
        raise ConflictError('Supplier is already rejected/pending.')
    supplier.is_approved = False
    supplier.save(update_fields=['is_approved'])
    logger.info('Supplier %d rejected by user %d', supplier.pk, approver.pk)
    return supplier


def list_pending_suppliers():
    return User.objects.filter(role=User.Role.SUPPLIER, is_approved=False).order_by('id')
