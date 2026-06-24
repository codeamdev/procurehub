# ProcureHub — Documentación Técnica

> Plataforma B2B de procurement multi-tenant con motor de workflows, asistente de IA y marketplace de proveedores.

---

## Tabla de contenidos

1. [Descripción General](#1-descripción-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Módulos del Backend](#3-módulos-del-backend)
4. [Autenticación y Roles](#4-autenticación-y-roles)
5. [Multi-Tenancy](#5-multi-tenancy)
6. [Motor de Workflows](#6-motor-de-workflows)
7. [API — Endpoints](#7-api--endpoints)
8. [Frontend React](#8-frontend-react)
9. [Módulo de IA](#9-módulo-de-ia)
10. [Instalación y Configuración](#10-instalación-y-configuración)
11. [Testing](#11-testing)
12. [Roadmap / Mejoras Futuras](#12-roadmap--mejoras-futuras)

---

## 1. Descripción General

### ¿Qué es ProcureHub?

ProcureHub es una plataforma B2B de gestión de compras (*procurement*) diseñada para empresas que necesitan centralizar y automatizar sus procesos de adquisición. Permite a compradores publicar solicitudes de compra, a proveedores enviar propuestas competitivas, y a administradores supervisar y aprobar todo el flujo.

### Problema que resuelve

En empresas medianas y grandes, el proceso de compra suele ser fragmentado: solicitudes por email, cotizaciones en hojas de cálculo, aprobaciones manuales y sin trazabilidad. ProcureHub reemplaza ese caos con un sistema estructurado que:

- Centraliza todas las solicitudes de compra en un solo lugar.
- Permite a múltiples proveedores competir con propuestas transparentes.
- Automatiza las aprobaciones internas mediante un motor de workflows configurable.
- Asiste a compradores y proveedores con inteligencia artificial.
- Aísla completamente los datos de cada empresa cliente (multi-tenancy).

### Concepto de Marketplace B2B

El marketplace opera con dos roles principales:

```
COMPRADOR (Buyer)               PROVEEDOR (Supplier)
      │                                │
      │  Publica solicitud de compra   │
      │ ─────────────────────────────► │
      │                                │  Envía propuesta con precio
      │ ◄───────────────────────────── │  y tiempo de entrega
      │                                │
      │  Evalúa propuestas y adjudica  │
      │ ─────────────────────────────► │  Propuesta aceptada o rechazada
```

El ciclo de vida de una solicitud de compra es:

```
OPEN  ──►  CLOSED   (cerrada manualmente sin adjudicación)
      └──►  AWARDED  (adjudicada a un proveedor ganador)
```

El ciclo de vida de una propuesta es:

```
PENDING  ──►  ACCEPTED  (cuando su solicitud es adjudicada a ella)
         └──►  REJECTED  (cuando otra propuesta es adjudicada)
```

### Motor de Workflows

El sistema incluye un motor de workflows configurable que permite a los administradores definir procesos internos con pasos, formularios dinámicos y transiciones. Por ejemplo: un proceso de aprobación de solicitud de compra con validación de jefe de área, aprobación financiera y orden de compra final.

Los workflows son completamente configurables sin tocar código: se definen en la base de datos y el frontend renderiza los formularios dinámicamente.

---

## 2. Arquitectura del Sistema

### Vista de alto nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Navegador)                       │
│                    React SPA  ·  Vite  ·  Axios                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTPS / HTTP
                               │  Subdominio: empresa.localhost
┌──────────────────────────────▼──────────────────────────────────┐
│                       BACKEND (Django 5.2)                       │
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │
│   │ accounts │  │ tenants  │  │procurement │  │  workflows  │  │
│   └──────────┘  └──────────┘  └────────────┘  └─────────────┘  │
│   ┌────────────────────────┐   ┌──────────────────────────────┐ │
│   │     ai_assistant       │   │    common (excepciones)      │ │
│   └────────────────────────┘   └──────────────────────────────┘ │
│                                                                  │
│   Django REST Framework  ·  JWT (SimpleJWT)  ·  CORS            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    PostgreSQL + django-tenants                    │
│                                                                  │
│   ┌─────────────────┐   ┌─────────────┐   ┌─────────────────┐  │
│   │  Schema: public │   │Schema: acme │   │Schema: globex   │  │
│   │  - tenants      │   │- accounts   │   │- accounts       │  │
│   │  - domains      │   │- procurement│   │- procurement    │  │
│   └─────────────────┘   │- workflows  │   │- workflows      │  │
│                         │- ai_assistant│  │- ai_assistant   │  │
│                         └─────────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Backend framework | Django | 5.2.1 LTS |
| API REST | Django REST Framework | 3.17.1 |
| Multi-tenancy | django-tenants | 3.10.1 |
| Autenticación | djangorestframework-simplejwt | 5.5.1 |
| Base de datos | PostgreSQL + psycopg2-binary | 2.9.12 |
| IA / LLM | OpenAI SDK | 2.32.0 |
| Frontend | React + Vite | — |
| HTTP client | Axios | — |
| Rutas anidadas API | drf-nested-routers | 0.95.0 |
| CORS | django-cors-headers | 4.9.0 |

### Separación: Public Schema vs Tenant Schema

django-tenants divide la base de datos en dos zonas:

**Schema `public`** — datos compartidos entre todos los tenants:
- `tenants_company` — registro de empresas cliente
- `tenants_domain` — mapeo de subdominios a empresas

**Schemas por tenant** (ej: `acme`, `globex`) — datos completamente aislados:
- `accounts_user` — usuarios de esa empresa
- `procurement_procurementrequest` — solicitudes de compra
- `procurement_proposal` — propuestas de proveedores
- `workflows_workflow` / `workflows_workflowrequest` — flujos internos
- `ai_assistant_aiconversation` / `ai_assistant_aimessage` — historial de IA

Esto garantiza que **ninguna empresa puede ver datos de otra**, incluso si comparten la misma instancia de base de datos.

---

## 3. Módulos del Backend

La aplicación está organizada en apps Django bajo el directorio `backend/apps/`:

```
backend/
├── config/
│   ├── settings.py
│   ├── urls.py           ← router principal
│   └── urls_public.py    ← rutas del schema público
└── apps/
    ├── accounts/         ← usuarios y autenticación
    ├── tenants/          ← gestión de empresas (tenants)
    ├── procurement/      ← solicitudes y propuestas
    ├── workflows/        ← motor de workflows
    ├── ai_assistant/     ← asistente de inteligencia artificial
    └── common/           ← excepciones y utilidades compartidas
```

---

### 3.1 App `accounts`

**Responsabilidad**: gestión de usuarios, autenticación JWT, roles y flujo de aprobación de proveedores.

#### Modelo principal: `User`

```python
class User(AbstractUser):
    email      = EmailField(unique=True)   # campo de login (USERNAME_FIELD)
    role       = CharField(choices=['admin', 'buyer', 'supplier'])
    is_approved = BooleanField(default=True)
    # Los proveedores se crean con is_approved=False hasta aprobación admin
```

El campo `username` de Django no se usa; el login es por **email + contraseña**.

#### Servicios clave (`accounts/services.py`)

| Función | Descripción |
|---|---|
| `issue_tokens(user)` | Genera par access/refresh JWT |
| `blacklist_token(refresh)` | Invalida un token de refresco |
| `authenticate_user(request, email, password)` | Valida credenciales y retorna usuario + tokens |
| `approve_supplier(approver, supplier_id)` | Aprueba un proveedor pendiente |
| `reject_supplier(approver, supplier_id)` | Rechaza un proveedor |
| `list_pending_suppliers()` | Lista proveedores pendientes de aprobación |

#### Endpoints (`/api/auth/`)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register/` | Registro de nuevo usuario |
| `POST` | `/api/auth/login/` | Inicio de sesión |
| `POST` | `/api/auth/logout/` | Cierre de sesión (invalida refresh token) |
| `GET` | `/api/auth/me/` | Datos del usuario autenticado |
| `POST` | `/api/auth/token/refresh/` | Renovar access token |
| `GET` | `/api/auth/suppliers/` | Listar proveedores pendientes (solo admin) |
| `POST` | `/api/auth/suppliers/{id}/approve/` | Aprobar proveedor (solo admin) |
| `POST` | `/api/auth/suppliers/{id}/reject/` | Rechazar proveedor (solo admin) |

---

### 3.2 App `tenants`

**Responsabilidad**: definir las empresas cliente y sus dominios. Es la base del sistema multi-tenant.

#### Modelos

```python
class Company(TenantMixin):
    name       = CharField(max_length=100)
    created_on = DateField(auto_now_add=True)
    is_active  = BooleanField(default=True)
    # auto_create_schema = True → crea el schema PG automáticamente al guardar

class Domain(DomainMixin):
    # Heredado de django-tenants
    # Mapea un dominio/subdominio a una Company
```

Esta app no expone endpoints propios. La gestión de tenants se hace directamente desde el panel de administración de Django (`/admin/`) o por consola.

---

### 3.3 App `procurement`

**Responsabilidad**: ciclo completo de solicitudes de compra y propuestas de proveedores.

#### Modelos

```python
class ProcurementRequest:
    title       = CharField
    description = TextField
    budget      = DecimalField
    category    = CharField
    deadline    = DateField
    status      = CharField(choices=['open', 'closed', 'awarded'])
    created_by  = ForeignKey(User)
    created_at  = DateTimeField(auto_now_add)
    # Ordenado por -created_at (más reciente primero)

class Proposal:
    request       = ForeignKey(ProcurementRequest)
    supplier      = ForeignKey(User)
    price         = DecimalField
    delivery_time = PositiveIntegerField  # días
    message       = TextField
    status        = CharField(choices=['pending', 'accepted', 'rejected'])
    created_at    = DateTimeField(auto_now_add)
    # unique_together: (request, supplier) — un proveedor, una propuesta por solicitud
    # Ordenado por price (más barato primero)
```

#### Servicios clave (`procurement/services.py`)

| Función | Descripción |
|---|---|
| `create_procurement_request(user, data)` | Crea una solicitud de compra |
| `close_procurement_request(user, req)` | Cierra la solicitud sin adjudicar |
| `award_procurement_request(user, req, proposal_id)` | Adjudica al proveedor ganador, rechaza el resto. Usa `select_for_update()` para evitar race conditions |
| `submit_proposal(supplier, req, data)` | Envía una propuesta; valida que la solicitud esté abierta y el proveedor no haya enviado antes |

#### Endpoints (`/api/procurement/`)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/api/procurement/requests/` | Autenticado | Lista solicitudes (filtrado por rol) |
| `POST` | `/api/procurement/requests/` | Admin / Buyer | Crear solicitud |
| `GET` | `/api/procurement/requests/{id}/` | Autenticado | Detalle de solicitud |
| `POST` | `/api/procurement/requests/{id}/close/` | Admin / Buyer | Cerrar solicitud |
| `POST` | `/api/procurement/requests/{id}/award/` | Admin / Buyer | Adjudicar solicitud |
| `GET` | `/api/procurement/requests/{id}/proposals/` | Autenticado | Listar propuestas |
| `POST` | `/api/procurement/requests/{id}/proposals/` | Supplier aprobado | Enviar propuesta |
| `GET` | `/api/procurement/requests/{id}/proposals/{pid}/` | Autenticado | Detalle de propuesta |

**Reglas de visibilidad**:
- Un **proveedor no aprobado** recibe lista vacía.
- Un **proveedor aprobado** solo ve solicitudes con `status=open`.
- Un **proveedor** solo ve sus propias propuestas (no las de la competencia).
- **Buyers y admins** ven todo.

---

### 3.4 App `workflows`

**Responsabilidad**: motor de flujos de trabajo configurables. Permite definir procesos internos con pasos, formularios dinámicos y transiciones.

#### Modelos

```python
class Workflow:
    name        = CharField
    description = TextField
    is_active   = BooleanField
    created_at  = DateTimeField

class WorkflowStep:
    workflow              = ForeignKey(Workflow)
    name                  = CharField
    type                  = CharField(default='form')
    order                 = PositiveIntegerField
    fields                = JSONField  # lista de campos dinámicos
    allowed_roles_to_view = JSONField  # ej: ["admin", "buyer"]
    allowed_roles_to_edit = JSONField
    allowed_roles_to_act  = JSONField
    # Ordenado por order

class WorkflowAction:
    step      = ForeignKey(WorkflowStep)
    label     = CharField       # texto del botón, ej: "Aprobar"
    type      = CharField       # 'next' | 'submit' | 'reject' | 'approve'
    next_step = ForeignKey(WorkflowStep, null=True)  # hacia dónde va

class WorkflowRequest:
    workflow      = ForeignKey(Workflow)
    current_step  = ForeignKey(WorkflowStep, null=True)
    data          = JSONField   # datos acumulados de todos los pasos
    status        = CharField(choices=['in_progress', 'completed', 'rejected'])
    created_by    = ForeignKey(User)
    created_at    = DateTimeField
    updated_at    = DateTimeField
```

Ver la sección [6. Motor de Workflows](#6-motor-de-workflows) para una explicación detallada.

---

### 3.5 App `ai_assistant`

**Responsabilidad**: asistente de inteligencia artificial para compradores y proveedores.

#### Modelos

```python
class AIConversation:
    user       = ForeignKey(User)
    created_at = DateTimeField(auto_now_add)

class AIMessage:
    conversation = ForeignKey(AIConversation)
    role         = CharField(choices=['user', 'assistant'])
    content      = TextField
    created_at   = DateTimeField(auto_now_add)
    # Ordenado por created_at
```

Ver la sección [9. Módulo de IA](#9-módulo-de-ia) para la explicación completa.

---

### 3.6 App `common`

**Responsabilidad**: tipos de excepciones personalizadas y handler de errores centralizado.

#### Excepciones

```python
class AppError(Exception):          # status 400
class NotFoundError(AppError):      # status 404
class ConflictError(AppError):      # status 409
class PermissionDeniedError(AppError): # status 403
```

#### Handler de errores (`common/exception_handler.py`)

Convierte excepciones de negocio a respuestas HTTP consistentes:

```json
// AppError → 400
{ "error": "mensaje descriptivo", "code": "error" }

// NotFoundError → 404
{ "error": "Procurement request not found.", "code": "not_found" }

// ConflictError → 409
{ "error": "Request is not open.", "code": "conflict" }

// ValidationError de DRF (campos) → 400
{ "errors": { "budget": ["Este campo es requerido."] }, "code": "validation_error" }
```

---

## 4. Autenticación y Roles

### JWT (JSON Web Tokens)

ProcureHub usa **SimpleJWT** para autenticación sin estado. No hay sesiones en el servidor.

| Token | Duración | Uso |
|---|---|---|
| `access_token` | 15 minutos | Enviado en cada request como `Authorization: Bearer <token>` |
| `refresh_token` | 7 días | Usado para obtener un nuevo access token |

**Configuración de seguridad adicional**:
- `ROTATE_REFRESH_TOKENS = True` — cada vez que se usa el refresh, se genera uno nuevo.
- `BLACKLIST_AFTER_ROTATION = True` — el refresh anterior queda invalidado, evitando reutilización.

#### Flujo de autenticación

```
1. POST /api/auth/login/  →  { access, refresh, user }
2. El frontend guarda ambos tokens en localStorage
3. Cada request incluye:  Authorization: Bearer <access_token>
4. Al expirar el access:  POST /api/auth/token/refresh/  →  { access }
5. Al hacer logout:       POST /api/auth/logout/  →  invalida el refresh
```

### Roles

#### ADMIN

El administrador tiene control total sobre el sistema de su empresa:

- Crear, ver y gestionar todas las solicitudes de compra.
- Ver y gestionar todas las propuestas.
- Aprobar o rechazar proveedores.
- Adjudicar solicitudes a proveedores.
- Usar el asistente de IA (comprador).
- Acceder al panel de administración.

#### BUYER (Comprador)

- Crear solicitudes de compra.
- Ver todas las solicitudes y propuestas.
- Cerrar y adjudicar solicitudes.
- Usar el asistente de IA para procurement.
- Usar el motor de workflows.

#### SUPPLIER (Proveedor)

Los proveedores tienen un flujo de aprobación:

```
Registro  →  is_approved=False  →  Admin aprueba  →  is_approved=True  →  Acceso completo
```

Un proveedor **aprobado** puede:
- Ver solicitudes abiertas en el marketplace.
- Enviar una propuesta por solicitud.
- Ver solo sus propias propuestas.
- Usar el asistente de IA para proveedores.

Un proveedor **no aprobado** puede:
- Ver la pantalla de espera de aprobación.
- No puede ver solicitudes ni enviar propuestas.

### Clases de permiso (`accounts/permissions.py`)

```python
IsAdmin                  # role == 'admin'
IsBuyer                  # role in ('buyer', 'admin')
IsSupplier               # role == 'supplier'
IsAdminOrBuyer           # role in ('admin', 'buyer')
IsAdminOrBuyerOrReadOnly # GET: cualquier autenticado; POST/PUT/DELETE: admin o buyer
IsApprovedSupplier       # role == 'supplier' AND is_approved == True
```

---

## 5. Multi-Tenancy

### ¿Qué es un tenant?

Un **tenant** es una empresa cliente que usa la plataforma de forma completamente aislada. Cada empresa tiene su propio esquema (schema) en PostgreSQL, lo que significa que sus datos están físicamente separados de los de otras empresas.

Ejemplo: si `Acme Corp` y `Globex Inc` son clientes, sus datos nunca se mezclan aunque compartan la misma instalación del software.

### Cómo funcionan los schemas

django-tenants implementa multi-tenancy mediante **PostgreSQL schemas**. Cada schema es como un "namespace" dentro de la misma base de datos:

```sql
-- Schema público (compartido)
public.tenants_company   → lista de todas las empresas
public.tenants_domain    → mapeo subdominio → empresa

-- Schema de Acme Corp
acme.accounts_user       → usuarios de Acme
acme.procurement_procurementrequest → solicitudes de Acme

-- Schema de Globex
globex.accounts_user     → usuarios de Globex (completamente separados)
globex.procurement_procurementrequest → solicitudes de Globex
```

Cuando un usuario de Acme hace una consulta, Django automáticamente ejecuta:
```sql
SET search_path TO acme, public;
```

Esto hace que todas las consultas operen sobre los datos de Acme, sin posibilidad de acceder a los de Globex.

### Cómo funcionan los subdominios

El enrutamiento entre tenants se hace por **subdominio**:

| Subdominio | Tenant |
|---|---|
| `acme.localhost:5173` | Acme Corp |
| `globex.localhost:5173` | Globex Inc |
| `localhost:5173` | Sin tenant (muestra pantalla de error) |

El middleware `TenantMainMiddleware` intercepta cada request, extrae el subdominio, busca el `Domain` correspondiente en el schema público y establece el schema activo para todo el ciclo del request.

En el **frontend**, el contexto `TenantContext` lee el subdominio del `window.location.hostname` y lo incluye en el header de cada request HTTP.

### Configuración de SHARED_APPS vs TENANT_APPS

```python
# config/settings.py

SHARED_APPS = [
    'django_tenants',
    'django.contrib.admin',
    # ... otros apps de Django
    'apps.accounts',   # app compartida (usuarios existen en public Y en cada tenant)
    'apps.tenants',    # gestión de tenants
]

TENANT_APPS = [
    'django.contrib.contenttypes',
    'apps.procurement',      # datos aislados por tenant
    'apps.workflows',        # datos aislados por tenant
    'apps.ai_assistant',     # conversaciones aisladas por tenant
]
```

### Aislamiento de datos — garantías

1. **No hay queries cross-tenant**: El ORM de Django siempre opera en el schema activo.
2. **PKs no se filtran**: Un proveedor de Acme con PK=5 y uno de Globex con PK=5 son registros completamente distintos en schemas distintos.
3. **JWT por schema**: Un JWT emitido en Acme es inválido en Globex porque el User al que referencia no existe en ese schema.
4. **Migraciones separadas**: `migrate_schemas --shared` migra el schema público; `migrate_schemas` migra todos los tenants.

---

## 6. Motor de Workflows

### Concepto

El motor de workflows permite a los administradores definir procesos internos sin tocar código. Un workflow es una secuencia de pasos (steps), donde cada paso puede tener un formulario con campos dinámicos y acciones que determinan la transición al siguiente paso.

### Modelos en detalle

#### `Workflow` — Definición del proceso

```python
class Workflow:
    name        # ej: "Aprobación de Solicitud de Compra"
    description # descripción del proceso
    is_active   # si está disponible para iniciar nuevas instancias
    created_at
```

#### `WorkflowStep` — Paso del proceso

```python
class WorkflowStep:
    workflow   # FK al Workflow padre
    name       # ej: "Revisión de Jefe de Área"
    type       # 'form' (actualmente el único tipo)
    order      # 1, 2, 3... determina la secuencia
    fields     # JSONField — lista de campos del formulario de este paso
    allowed_roles_to_view  # quién puede VER este paso
    allowed_roles_to_edit  # quién puede EDITAR los campos
    allowed_roles_to_act   # quién puede ejecutar las acciones
```

**Estructura de `fields` (JSONField)**:

```json
[
  {
    "name": "justificacion",
    "label": "Justificación de la compra",
    "type": "text",
    "required": true
  },
  {
    "name": "monto_aprobado",
    "label": "Monto aprobado",
    "type": "number",
    "required": true
  },
  {
    "name": "urgencia",
    "label": "¿Es urgente?",
    "type": "select",
    "required": false,
    "options": ["Alta", "Media", "Baja"]
  }
]
```

Tipos de campo soportados: `text`, `number`, `select`, `date`, `textarea`.

#### `WorkflowAction` — Botón / acción de transición

```python
class WorkflowAction:
    step      # FK al paso donde aparece este botón
    label     # texto del botón: "Aprobar", "Rechazar", "Siguiente"
    type      # 'next' | 'submit' | 'reject' | 'approve'
    next_step # FK al paso siguiente (null si es el paso final)
```

| Tipo | Comportamiento |
|---|---|
| `next` | Avanza al siguiente paso guardando los datos del formulario |
| `submit` | Marca el workflow como completado |
| `approve` | Aprobación explícita; avanza al siguiente paso |
| `reject` | Marca el workflow como rechazado |

#### `WorkflowRequest` — Instancia de ejecución

```python
class WorkflowRequest:
    workflow      # qué proceso se está ejecutando
    current_step  # en qué paso está ahora (null si terminó)
    data          # JSONField — acumula todos los datos ingresados en cada paso
    status        # 'in_progress' | 'completed' | 'rejected'
    created_by    # quién inició el proceso
    created_at
    updated_at
```

El campo `data` va acumulando valores conforme el proceso avanza:

```json
{
  "paso_1": {
    "justificacion": "Necesitamos renovar equipos",
    "urgencia": "Alta"
  },
  "paso_2": {
    "monto_aprobado": "25000.00",
    "comentario_financiero": "Dentro del presupuesto"
  }
}
```

### Ejemplo completo: Aprobación de compra

**Definición del workflow**:

```
Workflow: "Aprobación de Compra"
│
├── Step 1 (order=1): "Solicitud Inicial"
│   ├── fields: [titulo, descripcion, monto_estimado, categoria]
│   ├── allowed_roles_to_act: ["buyer", "admin"]
│   └── Action: "Enviar a revisión" → type=next → next_step=Step 2
│
├── Step 2 (order=2): "Revisión de Jefe de Área"
│   ├── fields: [comentario_jefe, monto_aprobado]
│   ├── allowed_roles_to_act: ["admin"]
│   ├── Action: "Aprobar" → type=approve → next_step=Step 3
│   └── Action: "Rechazar" → type=reject → next_step=null
│
└── Step 3 (order=3): "Confirmación Final"
    ├── fields: [numero_orden, proveedor_seleccionado]
    ├── allowed_roles_to_act: ["admin", "buyer"]
    └── Action: "Completar" → type=submit → next_step=null
```

**Ejecución paso a paso**:

```
1. Buyer inicia el workflow en /workflows
   → Se crea WorkflowRequest { status: in_progress, current_step: Step 1 }

2. Buyer completa Step 1 y presiona "Enviar a revisión"
   → WorkflowRequest.data = { "paso_1": { titulo: "...", monto_estimado: 15000 } }
   → WorkflowRequest.current_step = Step 2

3. Admin ve el Step 2 con los datos previos visibles
   → Admin completa campos y presiona "Aprobar"
   → WorkflowRequest.data = { "paso_1": {...}, "paso_2": { monto_aprobado: 14500 } }
   → WorkflowRequest.current_step = Step 3

4. Buyer completa Step 3 y presiona "Completar"
   → WorkflowRequest.status = completed
   → WorkflowRequest.current_step = null
   → Proceso terminado ✓

-- Si en Step 2 el admin presiona "Rechazar":
   → WorkflowRequest.status = rejected
   → Proceso terminado con rechazo ✗
```

### Endpoints de Workflows (`/api/workflows/`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/workflows/definitions/` | Lista workflows activos |
| `GET` | `/api/workflows/definitions/{id}/` | Detalle de un workflow con sus steps y acciones |
| `GET` | `/api/workflows/requests/` | Lista instancias del usuario autenticado |
| `POST` | `/api/workflows/requests/` | Iniciar una nueva instancia de workflow |
| `GET` | `/api/workflows/requests/{id}/` | Estado actual de una instancia |
| `PATCH` | `/api/workflows/requests/{id}/` | Actualizar datos del paso actual |
| `POST` | `/api/workflows/requests/{id}/execute/` | Ejecutar una acción (avanzar, aprobar, rechazar) |

---

## 7. API — Endpoints

### Convenciones

- **Base URL**: `/api/`
- **Autenticación**: `Authorization: Bearer <access_token>` en todos los endpoints protegidos.
- **Content-Type**: `application/json`
- **Paginación**: Respuestas de lista usan `{ count, next, previous, results }` con `PAGE_SIZE=20`.
- **Errores**: siempre en formato `{ "error": "...", "code": "..." }`.

### Autenticación

#### `POST /api/auth/register/`

Registra un nuevo usuario. Los proveedores quedan pendientes de aprobación.

**Request:**
```json
{
  "email": "comprador@empresa.com",
  "password": "segura1234",
  "role": "buyer"
}
```

**Response 201:**
```json
{
  "user": {
    "id": 1,
    "email": "comprador@empresa.com",
    "role": "buyer",
    "is_approved": true
  },
  "access": "eyJhbGciOiJIUzI1NiIs...",
  "refresh": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

#### `POST /api/auth/login/`

**Request:**
```json
{
  "email": "comprador@empresa.com",
  "password": "segura1234"
}
```

**Response 200:**
```json
{
  "user": { "id": 1, "email": "comprador@empresa.com", "role": "buyer", "is_approved": true },
  "access": "eyJ...",
  "refresh": "eyJ..."
}
```

**Response 400 (credenciales inválidas):**
```json
{ "error": "Invalid credentials.", "code": "error" }
```

---

#### `GET /api/auth/me/`

**Response 200:**
```json
{
  "id": 1,
  "email": "comprador@empresa.com",
  "role": "buyer",
  "is_active": true,
  "is_approved": true
}
```

---

### Procurement

#### `GET /api/procurement/requests/`

**Response 200:**
```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "20 Laptops Dell",
      "description": "Para el equipo de desarrollo",
      "budget": "25000.00",
      "category": "IT",
      "deadline": "2025-06-30",
      "status": "open",
      "created_by": 1,
      "created_by_email": "comprador@empresa.com",
      "proposal_count": 3,
      "proposals": [],
      "created_at": "2025-04-20T10:00:00Z"
    }
  ]
}
```

---

#### `POST /api/procurement/requests/`

**Request:**
```json
{
  "title": "20 Laptops Dell",
  "description": "Para el equipo de desarrollo, con 16GB RAM y SSD 512GB",
  "budget": "25000.00",
  "category": "IT",
  "deadline": "2025-06-30"
}
```

**Response 201:** objeto `ProcurementRequest` completo.

**Error 400 (presupuesto inválido):**
```json
{ "errors": { "budget": ["El presupuesto debe ser mayor a 0."] }, "code": "validation_error" }
```

---

#### `POST /api/procurement/requests/{id}/award/`

**Request:**
```json
{ "proposal_id": 7 }
```

**Response 200:** solicitud con `status: "awarded"`.

**Error 404:**
```json
{ "error": "Proposal not found.", "code": "not_found" }
```

**Error 409 (ya adjudicada):**
```json
{ "error": "Request is not open.", "code": "conflict" }
```

---

#### `POST /api/procurement/requests/{id}/proposals/`

Solo para proveedores aprobados.

**Request:**
```json
{
  "price": "22500.00",
  "delivery_time": 21,
  "message": "Podemos entregar los 20 equipos en 3 semanas con garantía extendida."
}
```

**Response 201:**
```json
{
  "id": 7,
  "request": 1,
  "supplier": 5,
  "supplier_email": "proveedor@tech.com",
  "price": "22500.00",
  "delivery_time": 21,
  "message": "Podemos entregar...",
  "status": "pending",
  "created_at": "2025-04-21T09:00:00Z"
}
```

**Error 409 (ya enviada):**
```json
{ "error": "You have already submitted a proposal for this request.", "code": "conflict" }
```

---

### IA — Compradores

#### `POST /api/ai/chat/`

**Request:**
```json
{
  "message": "Crea una solicitud para 50 sillas ergonómicas",
  "context": { "request_id": null, "workflow_id": null },
  "conversation_id": null
}
```

**Response 200:**
```json
{
  "conversation_id": 3,
  "response": {
    "type": "create_request",
    "requires_confirmation": true,
    "preview": {
      "title": "50 sillas ergonómicas",
      "description": "...",
      "budget": 15000,
      "category": "Furniture",
      "deadline": "2025-07-31"
    }
  }
}
```

---

#### `POST /api/ai/supplier/suggestions/`

Solo para proveedores aprobados.

**Request:**
```json
{ "request_id": 1 }
```

**Response 200:**
```json
{
  "price_suggestion": {
    "suggested": 22000.00,
    "range": { "min": 16250.00, "max": 23250.00 },
    "reasoning": "Con un presupuesto de $25,000 y 2 propuestas competidoras, ofrecer el 88% posiciona competitivamente.",
    "confidence": "medium"
  },
  "delivery_suggestion": {
    "days": 21,
    "reasoning": "Estimado según complejidad y su historial de entregas."
  },
  "proposal_template": {
    "price": 22000.00,
    "delivery_time": 21,
    "message": "Estimado equipo de compras..."
  },
  "competitive_insights": {
    "competing_proposals": 2,
    "budget_utilization_pct": 88,
    "tip": "2 proveedores ya enviaron propuesta. Mantente competitivo."
  }
}
```

---

### Rate Limiting

| Scope | Límite |
|---|---|
| Usuarios anónimos | 60 requests / hora |
| Usuarios autenticados | 1000 requests / hora |
| Endpoint de login | 5 requests / minuto |
| Endpoint de registro | 10 requests / hora |

---

## 8. Frontend React

### Estructura del proyecto

```
frontend/
├── src/
│   ├── main.jsx                    ← punto de entrada
│   ├── App.jsx                     ← router principal con rutas protegidas
│   ├── context/
│   │   ├── AuthContext.jsx         ← estado global de autenticación
│   │   └── TenantContext.jsx       ← detección del subdominio activo
│   ├── hooks/
│   │   ├── useApi.js               ← hook para llamadas GET con loading/error
│   │   └── useForm.js              ← manejo de estado de formularios
│   ├── services/
│   │   └── api.js                  ← cliente Axios con interceptores JWT
│   ├── components/
│   │   ├── Layout.jsx              ← navegación principal y estructura
│   │   ├── ProtectedRoute.jsx      ← guardia de rutas por autenticación y rol
│   │   ├── WorkflowWizard.jsx      ← wizard de pasos dinámicos
│   │   ├── DynamicForm.jsx         ← formulario generado desde JSONField
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Spinner.jsx
│   │       ├── Alert.jsx
│   │       ├── Badge.jsx
│   │       └── EmptyState.jsx
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── RequestsPage.jsx        ← lista de solicitudes (buyer/admin)
│   │   ├── RequestDetailPage.jsx   ← detalle con propuestas
│   │   ├── MarketplacePage.jsx     ← marketplace de solicitudes (supplier)
│   │   ├── WorkflowsPage.jsx       ← listado y ejecución de workflows
│   │   ├── AIPage.jsx              ← chat de IA para compradores
│   │   ├── SupplierAIPage.jsx      ← asistente de IA para proveedores
│   │   └── AdminPage.jsx           ← gestión de proveedores (admin)
│   └── utils/
│       ├── errors.js               ← extractor de mensajes de error
│       └── tenant.js               ← lectura del subdominio
```

### Manejo de autenticación

`AuthContext` gestiona el estado de sesión en toda la aplicación:

```jsx
// Funciones disponibles a través de useAuth()
const { user, loading, login, register, logout, updateUser } = useAuth()
```

- Los tokens se almacenan en `localStorage` (`access_token`, `refresh_token`).
- El interceptor de Axios detecta respuestas `401` y automáticamente intenta renovar el access token usando el refresh token.
- Si el refresh falla, borra los tokens y redirige a `/login`.

### Rutas y acceso por rol

```jsx
// App.jsx — rutas protegidas por rol
/requests      → admin, buyer
/marketplace   → supplier
/workflows     → todos (autenticados)
/ai            → admin, buyer
/supplier-ai   → supplier
/admin-panel   → admin
```

`ProtectedRoute` verifica que el usuario esté autenticado y tenga el rol requerido. Si no, redirige al destino correcto.

### Dashboards por rol

**Buyer / Admin** ven:
- Lista de solicitudes de compra con filtros de estado.
- Detalle de solicitud con todas las propuestas ordenadas por precio.
- Botones para adjudicar o cerrar solicitudes.
- Asistente de IA para procurement.

**Supplier (proveedor)** ve:
- Pantalla de espera si no está aprobado.
- Marketplace con solicitudes abiertas si está aprobado.
- Detalle de solicitud con formulario para enviar propuesta.
- Asistente de IA específico para proveedores.

**Admin** adicionalmente ve:
- Panel de administración de proveedores (`/admin-panel`).
- Lista de proveedores pendientes con botones de aprobar/rechazar.

### Formularios dinámicos (Workflows)

El componente `WorkflowWizard` renderiza un flujo de pasos basándose en la respuesta de la API:

```jsx
// WorkflowWizard recibe:
{
  workflowRequest: { id, current_step, data, status, permissions },
  onUpdate: (updatedRequest) => void
}
```

`DynamicForm` genera campos de formulario a partir del array `fields` del paso actual:

```json
// Un campo de tipo 'select' en el JSONField:
{ "name": "urgencia", "label": "Urgencia", "type": "select",
  "required": true, "options": ["Alta", "Media", "Baja"] }
// → renderiza un <select> con las opciones correspondientes
```

Los datos ingresados en cada paso se acumulan en `WorkflowRequest.data` en el servidor.

### Cliente API (`services/api.js`)

```javascript
// Grupos de endpoints disponibles:
authAPI.register(data)
authAPI.login(data)
authAPI.logout(refresh)
authAPI.me()

supplierAPI.list()
supplierAPI.approve(id)
supplierAPI.reject(id)

procurementAPI.listRequests()
procurementAPI.getRequest(id)
procurementAPI.createRequest(data)
procurementAPI.closeRequest(id)
procurementAPI.awardRequest(id, proposal_id)
procurementAPI.listProposals(requestId)
procurementAPI.submitProposal(requestId, data)

workflowAPI.list()
workflowAPI.listRequests()
workflowAPI.createRequest(data)
workflowAPI.executeAction(id, data)

aiAPI.chat(message, context, conversation_id)
aiAPI.confirmRequest(data, workflow_id)
aiAPI.supplierChat(message, request_id, conversation_id)
aiAPI.supplierSuggestions(request_id)
```

---

## 9. Módulo de IA

### Descripción general

ProcureHub incluye un asistente de IA con dos modos de operación según el rol del usuario:

| Modo | Usuarios | Endpoint |
|---|---|---|
| IA para compradores | admin, buyer | `/api/ai/chat/` |
| IA para proveedores | supplier aprobado | `/api/ai/supplier/chat/` |

### IA para compradores

**Casos de uso**:
1. **Crear solicitudes de compra**: El comprador describe lo que necesita en lenguaje natural y la IA genera un borrador de solicitud para confirmar.
2. **Recomendar proveedores**: La IA sugiere proveedores del sistema según la categoría de la solicitud.
3. **Consultas generales**: Preguntas sobre el estado del sistema, solicitudes activas, etc.

**Tipos de respuesta**:

```json
// Respuesta de tipo mensaje
{ "type": "message", "content": "Actualmente tienes 3 solicitudes abiertas." }

// Respuesta de tipo creación de solicitud
{
  "type": "create_request",
  "requires_confirmation": true,
  "preview": { "title": "...", "budget": 15000, "category": "IT", ... }
}

// Respuesta de tipo recomendación
{
  "type": "recommend_suppliers",
  "suppliers": [{ "id": 5, "email": "sup@tech.com" }],
  "reason": "Especializados en equipos IT con historial positivo."
}
```

**Flujo de confirmación**:
```
1. Usuario: "Necesito 30 monitores para la oficina"
2. IA: { type: create_request, requires_confirmation: true, preview: {...} }
3. Frontend muestra el borrador
4. Usuario confirma → POST /api/ai/confirm-request/
5. Se crea el ProcurementRequest definitivamente
```

### IA para proveedores

**Casos de uso**:
1. **Explicar una solicitud**: El proveedor pregunta qué necesita el comprador; la IA resume los requisitos clave y riesgos.
2. **Sugerir precio**: La IA analiza el presupuesto, la competencia actual y el historial del proveedor para recomendar un precio competitivo.
3. **Generar borrador de propuesta**: La IA redacta una propuesta profesional lista para enviar.

**Tipos de respuesta**:

```json
// Explicación
{
  "type": "explanation",
  "content": "El comprador necesita 20 laptops Dell...",
  "key_requirements": ["16GB RAM", "SSD 512GB", "Entrega en 3 semanas"],
  "risks": ["3 proveedores ya enviaron propuesta"]
}

// Sugerencia de precio
{
  "type": "price_suggestion",
  "suggested_price": 22000.00,
  "range": { "min": 16250.00, "max": 23250.00 },
  "reasoning": "Con presupuesto de $25k y 2 competidores...",
  "confidence": "medium"
}

// Borrador de propuesta
{
  "type": "proposal_draft",
  "price": 22500.00,
  "delivery_time": 21,
  "message": "Estimado equipo de compras,\n\nNos complace presentar..."
}
```

**Sugerencias estáticas** (endpoint `/api/ai/supplier/suggestions/`):
Retorna en un solo request el análisis completo: precio sugerido, tiempo de entrega recomendado, plantilla de propuesta e insights competitivos. No requiere conversación.

### Arquitectura de la capa de IA

```
views.py
│
├── chat()               → services.py
│   ├── build_context()  → consulta BD (solicitudes, proveedores)
│   ├── call_openai()    → OpenAI GPT-4o-mini
│   └── handle_ai_response() → enruta por tipo de respuesta
│
└── supplier_chat()      → supplier_services.py
    ├── build_supplier_context() → historial del proveedor, solicitud target
    └── dispatch_supplier_chat()
        ├── modo MOCK → _mock_chat()   ← heurístico, no requiere API key
        └── modo LLM  → _llm_chat()   ← llama a OpenAI
```

**Modo mock** (por defecto): `SUPPLIER_AI_MOCK=True` en el entorno. Usa reglas heurísticas basadas en palabras clave para responder sin consumir la API de OpenAI. Ideal para desarrollo y testing.

**Modo LLM**: `SUPPLIER_AI_MOCK=False`. Llama a OpenAI GPT-4o-mini con el contexto del proveedor inyectado en el prompt de sistema.

### Historial de conversación

Las conversaciones se persisten en la base de datos:

```
AIConversation (user=5)
│
├── AIMessage (role=user,      content="Explica esta solicitud")
├── AIMessage (role=assistant, content='{"type":"explanation",...}')
├── AIMessage (role=user,      content="Sugiere un precio")
└── AIMessage (role=assistant, content='{"type":"price_suggestion",...}')
```

El historial (últimos 20 mensajes) se incluye en cada llamada al LLM para mantener el contexto de la conversación.

---

## 10. Instalación y Configuración

### Prerrequisitos

- Python 3.10+
- PostgreSQL 14+
- Node.js 18+ (para el frontend)
- Git

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd proyecto_general
```

### 2. Configurar el backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar el entorno (Linux/Mac)
source venv/bin/activate

# Activar el entorno (Windows)
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

Copiar el archivo de ejemplo y completar los valores:

```bash
cp .env.example .env
```

Editar `.env`:

```ini
DEBUG=True
SECRET_KEY=tu-clave-secreta-aqui-cambia-en-produccion

# Base de datos PostgreSQL
DB_NAME=procurehub
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432

# OpenAI (opcional — solo si se quiere usar el LLM real)
OPENAI_API_KEY=sk-...

# Deshabilitar modo mock del proveedor (por defecto True)
# SUPPLIER_AI_MOCK=False
```

### 4. Configurar PostgreSQL

```sql
-- En psql o pgAdmin:
CREATE DATABASE procurehub;
CREATE USER procurehub_user WITH PASSWORD 'tu_password';
GRANT ALL PRIVILEGES ON DATABASE procurehub TO procurehub_user;

-- Habilitar extensión de schemas (necesaria para django-tenants)
\c procurehub
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 5. Ejecutar migraciones

Con django-tenants, las migraciones se ejecutan en dos fases:

```bash
# Migrar el schema público (tenants, domains, shared apps)
python manage.py migrate_schemas --shared

# Migrar todos los schemas de tenants existentes
python manage.py migrate_schemas
```

### 6. Crear el primer tenant

```bash
python manage.py shell
```

```python
from apps.tenants.models import Company, Domain

# Crear la empresa
company = Company(schema_name='acme', name='Acme Corp')
company.save()  # Esto crea el schema PostgreSQL automáticamente

# Crear el dominio
Domain.objects.create(
    domain='acme.localhost',
    tenant=company,
    is_primary=True
)

print(f"Tenant creado: {company.name} → acme.localhost")
```

### 7. Crear usuario admin en el tenant

```bash
python manage.py tenant_command createsuperuser --schema=acme
```

O desde el shell:

```python
from django_tenants.utils import schema_context
from apps.accounts.models import User

with schema_context('acme'):
    admin = User.objects.create_superuser(
        email='admin@acme.com',
        password='AdminSeguro123!'
    )
    admin.role = 'admin'
    admin.save()
```

### 8. Ejecutar el backend

```bash
python manage.py runserver
```

El backend estará disponible en `http://localhost:8000`.

### 9. Configurar el frontend

```bash
cd ../frontend

# Instalar dependencias
npm install
```

Configurar el proxy para el subdominio (en `vite.config.js` o `.env` de Vite):

```javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
    host: 'localhost',
    port: 5173,
  }
}
```

### 10. Ejecutar el frontend

```bash
npm run dev
```

El frontend estará disponible en `http://localhost:5173`.

Para acceder como el tenant `acme`, navegar a:

```
http://acme.localhost:5173
```

> **Nota para Windows**: puede ser necesario agregar `acme.localhost` en el archivo `C:\Windows\System32\drivers\etc\hosts`:
> ```
> 127.0.0.1  acme.localhost
> ```

---

## 11. Testing

### Stack de testing

- **pytest** + **pytest-django** — framework de tests
- **django-tenants** `TenantTestCase` — base para tests con schema real
- **unittest.mock** — mocking de OpenAI y servicios externos

### Estructura

```
backend/
├── pytest.ini              ← configuración de pytest
├── conftest.py             ← fixture de tenant a nivel de sesión
└── tests/
    ├── conftest.py         ← fixtures compartidas (usuarios, solicitudes, clientes HTTP)
    ├── unit/
    │   ├── test_models.py           ← modelos, constraints, defaults
    │   ├── test_services.py         ← servicios de accounts y procurement
    │   └── test_supplier_services.py← servicios de IA para proveedores
    ├── integration/
    │   ├── test_auth.py             ← endpoints de autenticación
    │   ├── test_requests.py         ← CRUD y ciclo de vida de solicitudes
    │   └── test_proposals.py        ← envío y visibilidad de propuestas
    └── multitenant/
        └── test_tenant_isolation.py ← aislamiento de datos entre tenants
```

### Cómo correr los tests

```bash
cd backend

# Suite completa
pytest

# Solo tests unitarios
pytest tests/unit/

# Solo tests de integración
pytest tests/integration/

# Solo tests de multi-tenancy
pytest tests/multitenant/

# Un archivo específico
pytest tests/integration/test_requests.py

# Un test específico
pytest tests/integration/test_requests.py::TestAwardRequest::test_buyer_can_award_open_request

# Con output verbose
pytest -v

# Detener al primer fallo
pytest -x
```

> **Importante**: los tests requieren una conexión PostgreSQL real (configurada en `.env`). django-tenants no es compatible con SQLite.

### Qué cubren los tests

| Módulo | Cobertura |
|---|---|
| **Modelos** | Defaults de campos, constraints `unique_together`, relaciones FK, cascade delete, manager personalizado |
| **Servicios de accounts** | Generación de tokens, blacklist, autenticación, aprobación/rechazo de proveedores |
| **Servicios de procurement** | Crear solicitud, cerrar, adjudicar (con race condition), enviar propuesta duplicada |
| **Servicios de IA** | Contexto del proveedor, heurísticas de precio, mock chat por palabras clave |
| **Auth endpoints** | Registro, login, logout, refresh, me, aprobación de proveedores |
| **Request endpoints** | CRUD, control de acceso por rol, close, award |
| **Proposal endpoints** | Envío, visibilidad por rol, inmutabilidad (405) |
| **Multi-tenancy** | Usuarios, solicitudes, propuestas y JWT aislados entre tenants |

---

## 12. Roadmap / Mejoras Futuras

### Motor de Workflows

- **Condiciones en transiciones**: permitir que una acción `next` solo esté disponible si un campo tiene cierto valor (ej: solo avanzar si `monto > 10000`).
- **Notificaciones**: enviar email o notificación in-app cuando un paso requiere acción de otro usuario.
- **Asignación de responsables**: poder asignar un `WorkflowRequest` a un usuario específico en lugar de por rol.
- **Historial de pasos**: registrar quién actuó en cada paso y cuándo, con trazabilidad completa.
- **Pasos paralelos**: soporte para que dos pasos puedan ejecutarse en paralelo antes de continuar.
- **Templates de workflow**: biblioteca de workflows predefinidos (aprobación de compra, onboarding de proveedor, etc.).

### Escalabilidad

- **Caché**: añadir Redis para cachear contextos de IA y respuestas frecuentes.
- **Cola de tareas**: usar Celery + Redis para envío de notificaciones y procesamiento asíncrono.
- **Tenant subdomain automático**: API pública para que nuevas empresas puedan auto-registrarse y obtener su subdominio.
- **Rate limiting por tenant**: límites independientes por empresa en lugar de globales.
- **Búsqueda full-text**: integrar `pg_trgm` o Elasticsearch para búsqueda en solicitudes y propuestas.

### Features adicionales

- **Panel de analítica**: métricas de win rate por proveedor, tiempo promedio de adjudicación, volumen de compras por categoría.
- **Integración con ERP**: webhooks para sincronizar órdenes de compra con sistemas externos (SAP, Oracle).
- **Evaluación de proveedores**: sistema de puntuación después de cada adjudicación.
- **Negociación de precio**: módulo de contra-oferta entre comprador y proveedor antes de adjudicar.
- **Multi-idioma (i18n)**: soporte para inglés, español y portugués en la interfaz.
- **IA para onboarding**: asistente que guía a nuevos usuarios en su primer workflow o solicitud.
- **Exportación de reportes**: PDF y Excel de solicitudes, propuestas y resultados de workflows.
- **2FA**: autenticación de doble factor para cuentas admin.

### Deuda técnica conocida

- **Tests de frontend**: actualmente no hay tests de React (Vitest / React Testing Library). Pendiente.
- **Contratos de API documentados**: añadir OpenAPI/Swagger mediante `drf-spectacular` para auto-generar documentación interactiva.
- **Variables de entorno en frontend**: el frontend usa rutas relativas `/api/`; en producción puede ser necesario externalizar la URL base.
- **Configuración de producción**: falta configuración de `gunicorn`, `nginx`, `whitenoise` para archivos estáticos, y variables `DEBUG=False`, `ALLOWED_HOSTS` correctas.

---

*Documentación generada para ProcureHub v1.0 — última actualización: 2026-04-29*
