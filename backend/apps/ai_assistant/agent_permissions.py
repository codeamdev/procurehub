"""
Matriz de permisos: rol → herramientas permitidas.

El agente aplica esta verificación en DOS momentos:
  1. Antes de llamar a la API (filtra el menú de tools que ve el modelo).
  2. En el momento de ejecutar (re-verifica en execute_tool, incluso si el modelo
     propone una tool no autorizada por cualquier motivo).
"""

# ── Matriz rol → tools ────────────────────────────────────────────────────────

ROLE_TOOLS: dict[str, frozenset] = {
    'admin': frozenset({
        'listar_proveedores',
        'obtener_proveedor',
        'buscar_por_categoria',
        'aprobar_proveedor',
        'rechazar_proveedor',
        'actualizar_perfil',
    }),
    'buyer': frozenset({
        'listar_proveedores',
        'obtener_proveedor',
        'buscar_por_categoria',
    }),
    'supplier': frozenset({
        'obtener_proveedor',    # solo el suyo propio (validado en execute_tool)
        'actualizar_perfil',   # solo el suyo propio (validado en execute_tool)
    }),
}

# Herramientas que modifican estado — requieren confirmación obligatoria del usuario.
WRITE_TOOLS: frozenset = frozenset({
    'aprobar_proveedor',
    'rechazar_proveedor',
    'actualizar_perfil',
})


def allowed_tools_for_role(role: str) -> frozenset:
    return ROLE_TOOLS.get(role, frozenset())


def is_write_tool(tool_name: str) -> bool:
    return tool_name in WRITE_TOOLS
