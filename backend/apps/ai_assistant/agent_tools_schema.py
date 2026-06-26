"""
Definiciones JSON de herramientas para el agente de gestión de proveedores.
Estas son las descripciones que ve el modelo — sin lógica de negocio.
"""

TOOLS = [
    {
        "name": "listar_proveedores",
        "description": (
            "Lista proveedores registrados. Filtra por estado de aprobación y/o categoría. "
            "Devuelve hasta 20 resultados."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "is_approved": {
                    "type": "boolean",
                    "description": "True = solo aprobados, False = solo pendientes. Omitir para ver todos.",
                },
                "category_name": {
                    "type": "string",
                    "description": "Nombre parcial de categoría para filtrar.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "obtener_proveedor",
        "description": "Devuelve los datos completos de un proveedor: perfil, categorías, estado.",
        "input_schema": {
            "type": "object",
            "properties": {
                "supplier_id": {
                    "type": "integer",
                    "description": "ID del proveedor.",
                },
            },
            "required": ["supplier_id"],
        },
    },
    {
        "name": "buscar_por_categoria",
        "description": "Busca proveedores que operan en una categoría específica.",
        "input_schema": {
            "type": "object",
            "properties": {
                "categoria": {
                    "type": "string",
                    "description": "Nombre de la categoría (búsqueda parcial, ej. 'IT', 'Office').",
                },
            },
            "required": ["categoria"],
        },
    },
    {
        "name": "aprobar_proveedor",
        "description": (
            "Aprueba un proveedor pendiente, otorgándole acceso completo. "
            "REQUIERE CONFIRMACIÓN del usuario antes de ejecutarse."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "supplier_id": {
                    "type": "integer",
                    "description": "ID del proveedor a aprobar.",
                },
            },
            "required": ["supplier_id"],
        },
    },
    {
        "name": "rechazar_proveedor",
        "description": (
            "Rechaza o revoca el acceso de un proveedor aprobado. "
            "REQUIERE CONFIRMACIÓN del usuario antes de ejecutarse."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "supplier_id": {
                    "type": "integer",
                    "description": "ID del proveedor a rechazar.",
                },
            },
            "required": ["supplier_id"],
        },
    },
    {
        "name": "actualizar_perfil",
        "description": (
            "Actualiza los datos de perfil de un proveedor (empresa, contacto, categorías). "
            "REQUIERE CONFIRMACIÓN del usuario antes de ejecutarse."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "supplier_id": {
                    "type": "integer",
                    "description": "ID del proveedor.",
                },
                "datos": {
                    "type": "object",
                    "description": "Campos a actualizar.",
                    "properties": {
                        "company_name": {"type": "string"},
                        "tax_id": {"type": "string", "description": "RUC / NIT"},
                        "address": {"type": "string"},
                        "phone": {"type": "string"},
                        "website": {"type": "string"},
                        "description": {"type": "string"},
                        "category_ids": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "IDs de categorías a asignar (reemplaza las actuales).",
                        },
                    },
                },
            },
            "required": ["supplier_id", "datos"],
        },
    },
]
