"""
Implementaciones reales de las herramientas del agente.
Toda interacción con el ORM ocurre aquí.
El user (request.user) se inyecta desde la vista — nunca desde el modelo.
"""
from apps.accounts.models import User, SupplierProfile
from apps.accounts.serializers import SupplierProfileSerializer
from apps.accounts import services as account_services
from apps.common.exceptions import NotFoundError

from .agent_permissions import allowed_tools_for_role, is_write_tool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _supplier_to_dict(user: User) -> dict:
    d = {
        'id': user.pk,
        'email': user.email,
        'is_approved': user.is_approved,
        'is_active': user.is_active,
    }
    try:
        p = user.supplier_profile
        d['company_name'] = p.company_name
        d['tax_id'] = p.tax_id
        d['phone'] = p.phone
        d['website'] = p.website
        d['description'] = p.description
        d['categories'] = [c.name for c in p.categories.all()]
    except SupplierProfile.DoesNotExist:
        d['company_name'] = ''
        d['categories'] = []
    return d


# ── Herramientas de lectura ───────────────────────────────────────────────────

def listar_proveedores(is_approved=None, category_name=None) -> list:
    qs = User.objects.filter(role='supplier').select_related('supplier_profile')
    if is_approved is not None:
        qs = qs.filter(is_approved=is_approved)
    if category_name:
        qs = qs.filter(supplier_profile__categories__name__icontains=category_name).distinct()
    return [_supplier_to_dict(u) for u in qs[:20]]


def obtener_proveedor(supplier_id: int) -> dict:
    try:
        user = (
            User.objects
            .filter(role='supplier')
            .prefetch_related('supplier_profile__categories')
            .get(pk=supplier_id)
        )
        return _supplier_to_dict(user)
    except User.DoesNotExist:
        raise NotFoundError(f'Proveedor {supplier_id} no encontrado.')


def buscar_por_categoria(categoria: str) -> list:
    qs = (
        User.objects
        .filter(role='supplier', supplier_profile__categories__name__icontains=categoria)
        .select_related('supplier_profile')
        .distinct()
    )
    return [_supplier_to_dict(u) for u in qs[:20]]


# ── Herramientas de escritura ─────────────────────────────────────────────────

def aprobar_proveedor(supplier_id: int, acting_user: User) -> dict:
    supplier = account_services.approve_supplier(acting_user, supplier_id)
    return {'success': True, 'supplier': _supplier_to_dict(supplier)}


def rechazar_proveedor(supplier_id: int, acting_user: User) -> dict:
    supplier = account_services.reject_supplier(acting_user, supplier_id)
    return {'success': True, 'supplier': _supplier_to_dict(supplier)}


def actualizar_perfil(supplier_id: int, datos: dict, acting_user: User) -> dict:
    try:
        supplier_user = User.objects.filter(role='supplier').get(pk=supplier_id)
    except User.DoesNotExist:
        raise NotFoundError(f'Proveedor {supplier_id} no encontrado.')
    profile, _ = SupplierProfile.objects.get_or_create(user=supplier_user)
    ser = SupplierProfileSerializer(profile, data=datos, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return {'success': True, 'profile': ser.data}


# ── Despachador central ───────────────────────────────────────────────────────

def execute_tool(name: str, args: dict, user: User) -> dict:
    """
    Ejecuta la herramienta indicada. user es el request.user autenticado.

    Segunda capa de autorización (la primera es filtrar tools antes de la API):
    si el modelo propone una tool no permitida para el rol, se rechaza aquí.
    Suppliers solo pueden operar sobre su propio ID.
    """
    allowed = allowed_tools_for_role(user.role)
    if name not in allowed:
        return {'error': f'Herramienta "{name}" no permitida para el rol "{user.role}".'}

    # Restricción adicional para suppliers: solo pueden ver/editar su propio perfil
    if user.role == 'supplier' and name in ('obtener_proveedor', 'actualizar_perfil'):
        supplier_id = args.get('supplier_id')
        if supplier_id != user.pk:
            return {'error': 'Solo puedes acceder a tu propio perfil.'}

    try:
        if name == 'listar_proveedores':
            return {'result': listar_proveedores(**args)}
        if name == 'obtener_proveedor':
            return {'result': obtener_proveedor(**args)}
        if name == 'buscar_por_categoria':
            return {'result': buscar_por_categoria(**args)}
        if name == 'aprobar_proveedor':
            return aprobar_proveedor(acting_user=user, **args)
        if name == 'rechazar_proveedor':
            return rechazar_proveedor(acting_user=user, **args)
        if name == 'actualizar_perfil':
            return actualizar_perfil(acting_user=user, **args)
    except NotFoundError as exc:
        return {'error': str(exc)}
    except Exception as exc:
        return {'error': f'Error ejecutando {name}: {exc}'}

    return {'error': f'Herramienta desconocida: {name}'}


def build_action_preview(tool_name: str, args: dict) -> str:
    """Resumen legible de la acción propuesta, para mostrar al usuario antes de confirmar."""
    if tool_name == 'aprobar_proveedor':
        return f"Aprobar proveedor con ID {args.get('supplier_id')}."
    if tool_name == 'rechazar_proveedor':
        return f"Rechazar proveedor con ID {args.get('supplier_id')}."
    if tool_name == 'actualizar_perfil':
        campos = ', '.join(args.get('datos', {}).keys())
        return f"Actualizar perfil del proveedor {args.get('supplier_id')}: campos [{campos}]."
    return f"{tool_name}({args})"
