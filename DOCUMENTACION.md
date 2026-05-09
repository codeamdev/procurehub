# ProcureHub — Documentación del Sistema

> Plataforma B2B de gestión de compras, workflows, negociaciones y proveedores con soporte multi-tenant y asistente IA.

---

## Tabla de contenidos

1. [Visión general](#visión-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Arquitectura del proyecto](#arquitectura-del-proyecto)
4. [Multi-tenancy](#multi-tenancy)
5. [Autenticación y roles](#autenticación-y-roles)
6. [Módulos del backend](#módulos-del-backend)
7. [API — Referencia de endpoints](#api--referencia-de-endpoints)
8. [Frontend](#frontend)
9. [Páginas y rutas](#páginas-y-rutas)
10. [Configuración y despliegue](#configuración-y-despliegue)

---

## Visión general

ProcureHub es una plataforma SaaS multi-tenant para gestión de compras corporativas. Permite a las empresas definir workflows de aprobación personalizados (low-code), gestionar solicitudes de compra, llevar procesos de negociación con proveedores, y contar con un asistente de IA para automatizar tareas de procurement.

**Roles del sistema:**

| Rol | Clave interna | Descripción |
|-----|--------------|-------------|
| Usuario general | `admin` | Puede crear workflows, solicitudes, negociaciones, usuarios y proveedores. Acceso completo a la plataforma. |
| Comprador | `buyer` | Puede crear solicitudes, procesos de negociación, cotizaciones y gestionar proveedores según permisos. |
| Vendedor / Proveedor | `supplier` | Vinculado a una empresa proveedora. Solo ve lo relacionado con su proveedor: solicitudes, negociaciones, marketplace. |

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend framework | Django LTS | 5.2.1 |
| Lenguaje backend | Python | 3.12 |
| Base de datos | PostgreSQL | — |
| Multi-tenancy | django-tenants | 3.10.1 |
| API REST | Django REST Framework | 3.17.1 |
| Autenticación | SimpleJWT | 5.5.1 |
| IA | Anthropic Claude (claude-sonnet-4-6) | SDK 0.98.0 |
| Frontend framework | React | 18.3.1 |
| Build tool | Vite | 5.2.12 |
| Estilos | Tailwind CSS | 4.1.12 |
| Componentes UI | Radix UI | 1.x |
| Enrutamiento | React Router DOM | 6.23.1 |
| Cliente HTTP | Axios | 1.7.2 |
| Gráficas | Recharts | 3.8.1 |
| Iconos | Lucide React | 0.487 |

---

## Arquitectura del proyecto

```
proyecto_general/
├── backend/
│   ├── config/
│   │   ├── settings.py          # Configuración principal Django
│   │   ├── urls.py              # Enrutamiento raíz
│   │   └── urls_public.py       # URLs públicas (sin tenant)
│   ├── apps/
│   │   ├── accounts/            # Usuarios, perfiles y autenticación
│   │   ├── workflows/           # Builder + motor de ejecución de workflows
│   │   ├── negotiation/         # Procesos de negociación y órdenes de compra
│   │   ├── procurement/         # Solicitudes legacy de procurement
│   │   ├── ai_assistant/        # Chat IA (comprador y proveedor)
│   │   ├── tenants/             # Multi-tenancy (esquemas de BD)
│   │   └── common/              # Utilidades compartidas
│   ├── requirements.txt
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── pages/               # Componentes de página (por ruta)
│   │   ├── components/          # Componentes reutilizables
│   │   │   ├── builder/         # Editor visual de workflows
│   │   │   └── ui/              # Librería UI base (Radix)
│   │   ├── context/             # AuthContext, TenantContext
│   │   ├── hooks/               # useApi, useDarkMode
│   │   ├── services/            # api.js (cliente Axios)
│   │   └── utils/               # Helpers (errors, etc.)
│   ├── package.json
│   └── vite.config.js
└── DOCUMENTACION.md
```

---

## Multi-tenancy

La plataforma usa `django-tenants` para aislar completamente los datos de cada empresa en su propio esquema de PostgreSQL.

- Cada empresa tiene un `schema_name` único en la base de datos.
- El enrutamiento se hace por subdominio: `empresa.localhost:5173` o `empresa.tudominio.com`.
- Las apps compartidas (auth base, tenants) viven en el esquema `public`.
- Las apps de negocio (workflows, negotiation, ai_assistant, etc.) son por tenant.

**Acceso de desarrollo:**
```
http://acme.localhost:5173   → tenant "acme"
```

---

## Autenticación y roles

### Flujo JWT

```
POST /api/auth/login/
  → { access: "jwt_token", refresh: "jwt_token", user: {...} }

Header en cada request:
  Authorization: Bearer <access_token>

Refresh automático:
POST /api/auth/token/refresh/
  body: { refresh: "..." }
```

**Duración de tokens:**
- Access token: 8 horas
- Refresh token: 30 días (rotación habilitada)

### Permisos por rol

| Acción | admin | buyer | supplier |
|--------|:-----:|:-----:|:--------:|
| Crear/editar workflows | ✅ | ✅ | ❌ |
| Ver workflows activos | ✅ | ✅ | ❌ |
| Crear solicitudes | ✅ | ✅ | ❌ |
| Ver solicitudes propias | ✅ | ✅ | ✅ |
| Crear procesos de negociación | ✅ | ✅ | ❌ |
| Responder ofertas (negociación) | ❌ | ❌ | ✅ |
| Gestionar proveedores | ✅ | ✅ | ❌ |
| Aprobar proveedores | ✅ | ❌ | ❌ |
| AI Assistant (comprador) | ✅ | ✅ | ❌ |
| AI Advisor (proveedor) | ❌ | ❌ | ✅ |
| Panel de administración | ✅ | ❌ | ❌ |

### Rate limiting

| Endpoint | Límite |
|---------|--------|
| Login | 5/minuto |
| Registro | 10/hora |
| Usuario autenticado | 1000/hora |
| Anónimo | 60/hora |

---

## Módulos del backend

### 1. Accounts (`apps/accounts/`)

Gestión de usuarios, perfiles y categorías de suministro.

**Modelos:**

```
User (AbstractUser)
  email          — identificador único (sin username)
  role           — admin | buyer | supplier
  is_approved    — flag para proveedores (requiere aprobación)

Category
  name, description, icon

SupplierProfile
  user (1:1)
  company_name, tax_id, address, phone
  categories (M2M → Category)

BuyerProfile
  user (1:1)
  department, company_name, phone
```

---

### 2. Workflows (`apps/workflows/`)

Motor low-code para definir y ejecutar flujos de aprobación.

#### Modelos del builder (definición)

```
WorkflowDefinition
  name, description, version
  status: draft | active | deprecated
  family_id           — agrupa versiones del mismo workflow
  show_in_menu        — aparece en el menú lateral de Solicitudes
  created_by

Step
  workflow (FK)
  name, order
  is_initial, is_final
  allowed_roles_to_view / edit / act   — arrays JSON de roles

Field
  workflow (FK)
  key                 — clave programática (ej: "vendor_name")
  label, field_type, options, metadata, order
  Tipos disponibles: text, textarea, number, date, datetime,
                     boolean, select, multiselect, file,
                     email, phone, currency

FieldRule
  field (FK), step (FK)
  is_visible, is_editable, is_required   — flags estáticos
  visibility_condition / editable_condition / required_condition
                       — condiciones Python opcionales (override)

Branch
  step (FK)
  label, style (primary | secondary | danger | warning)
  target_step (FK, nullable → transición terminal)
  terminal_status: completed | cancelled
  condition, validations, effects   — JSON
  order

BranchConditionRoute
  branch (FK)
  condition (FK → WorkflowCondition, null = ruta por defecto)
  target_step (FK), terminal_status
  order   — se evalúan en orden; primera que cumple gana

WorkflowCondition
  workflow (FK)
  name, label, description
  code   — Python que asigna result = True/False
           Variables disponibles: data (dict campo→valor),
                                  request (instancia Request)
```

#### Modelos de ejecución (instancias)

```
Request
  workflow_definition (FK — versión exacta, nunca migra)
  current_step (FK, nullable)
  status: active | completed | cancelled
  title
  created_by

RequestData
  request (FK), field (FK)
  value (JSON)   — almacena cualquier tipo de campo

RequestHistory  (inmutable)
  request (FK)
  from_step → to_step
  branch (FK)
  executed_by, executed_at
  data_snapshot (JSON — copia del estado en el momento)
  notes
```

#### Ciclo de vida de un workflow

```
DRAFT
  └─[publish]──→ ACTIVE
                   └─[deprecate]──→ DEPRECATED
                   └─[clone]──────→ DRAFT (nueva versión)
```

#### Ciclo de vida de una solicitud (Request)

```
[create_request] → ACTIVE (current_step = paso inicial)
  └─[transition] → ACTIVE (nuevo current_step) o
                   COMPLETED / CANCELLED (transición terminal)
```

---

### 3. Negotiation (`apps/negotiation/`)

Procesos de negociación multi-proveedor con generación de órdenes de compra.

**Modelos:**

```
NegotiationProcess
  title, description, deadline
  status: draft | open | evaluating | closed
  created_by

NegotiationItem
  process (FK)
  name, quantity, unit, order

NegotiationInvite
  process (FK), supplier (FK)
  status: pending | accepted | declined
  [UNIQUE: (process, supplier)]

SupplierOffer
  process (FK), supplier (FK)
  status: draft | submitted | accepted | rejected
  notes, delivery_days, validity_days
  [UNIQUE: (process, supplier)]

OfferLine
  offer (FK), item (FK)
  unit_price
  [UNIQUE: (offer, item)]

PurchaseOrder
  offer (OneToOne FK)
  process (FK), supplier (FK)
  status: draft | sent | confirmed | completed | cancelled
  total_amount, created_by
```

#### Ciclo de vida de un proceso

```
DRAFT
  └─[publish]──────────→ OPEN
                           └─[set_evaluating]──→ EVALUATING
                           └─[close]──────────→ CLOSED
                           └─[accept_offer]───→ CLOSED + PO generada
```

---

### 4. AI Assistant (`apps/ai_assistant/`)

Integración con Claude (Anthropic) para asistir en tareas de procurement.

**Para compradores/admin (`POST /api/ai/chat/`):**
- Crear solicitudes vía lenguaje natural
- Recomendar proveedores
- Contexto: solicitudes recientes, workflows activos, proveedores aprobados

**Para proveedores (`POST /api/ai/supplier/chat/`):**
- Entender solicitudes de compra
- Generar borradores de propuesta
- Sugerencias de precio, tiempo de entrega e insights competitivos

**Modelos:**
```
AIConversation   — por usuario, historial de conversación
AIMessage        — role: user | assistant, contenido JSON
```

---

## API — Referencia de endpoints

Todos los endpoints tienen el prefijo `/api/`.  
Autenticación requerida salvo indicación contraria.

### Auth (`/api/auth/`)

| Método | Endpoint | Descripción | Roles |
|--------|---------|-------------|-------|
| POST | `/auth/register/` | Registro nuevo usuario | Público |
| POST | `/auth/login/` | Login → tokens JWT | Público |
| POST | `/auth/logout/` | Logout (blacklist token) | Autenticado |
| GET | `/auth/me/` | Info usuario actual | Autenticado |
| GET | `/auth/categories/` | Listar categorías | Autenticado |
| POST | `/auth/categories/` | Crear categoría | admin |
| GET/POST | `/auth/suppliers-v2/` | Listar/crear proveedores | admin/buyer |
| PATCH | `/auth/suppliers-v2/{id}/profile/` | Actualizar perfil proveedor | admin/buyer |
| GET/POST | `/auth/buyers/` | Listar/crear compradores | admin |
| PATCH | `/auth/buyers/{id}/profile/` | Actualizar perfil comprador | admin |

### Workflows — Definiciones (`/api/workflows/definitions/`)

| Método | Endpoint | Descripción | Roles |
|--------|---------|-------------|-------|
| GET | `/definitions/` | Listar workflows | admin/buyer |
| POST | `/definitions/` | Crear workflow (DRAFT) | admin/buyer |
| GET | `/definitions/{id}/` | Detalle completo | admin/buyer |
| PATCH | `/definitions/{id}/` | Editar (solo DRAFT) | admin/buyer |
| DELETE | `/definitions/{id}/` | Eliminar (solo DRAFT) | admin/buyer |
| POST | `/definitions/{id}/publish/` | DRAFT → ACTIVE | admin/buyer |
| POST | `/definitions/{id}/deprecate/` | ACTIVE → DEPRECATED | admin/buyer |
| POST | `/definitions/{id}/clone/` | Clonar → nuevo DRAFT | admin/buyer |
| POST | `/definitions/{id}/toggle-menu/` | Mostrar/ocultar en menú | admin/buyer |
| GET | `/definitions/{id}/export/` | Exportar JSON | admin/buyer |
| POST | `/definitions/importar/` | Importar desde JSON | admin/buyer |
| GET | `/definitions/{id}/field-matrix/` | Matriz campo × paso | admin/buyer |

### Workflows — Pasos, Campos, Ramas (rutas anidadas)

| Método | Endpoint | Descripción |
|--------|---------|-------------|
| GET/POST | `/definitions/{wf_pk}/steps/` | Pasos del workflow |
| PATCH/DELETE | `/definitions/{wf_pk}/steps/{id}/` | Editar/borrar paso |
| GET/POST | `/definitions/{wf_pk}/fields/` | Campos del workflow |
| PATCH/DELETE | `/definitions/{wf_pk}/fields/{id}/` | Editar/borrar campo |
| GET/POST | `/definitions/{wf_pk}/steps/{step_pk}/field-rules/` | Reglas campo×paso |
| GET/POST | `/definitions/{wf_pk}/steps/{step_pk}/branches/` | Ramas del paso |
| PATCH/DELETE | `/definitions/{wf_pk}/steps/{step_pk}/branches/{id}/` | Editar rama |
| GET/POST | `/definitions/{wf_pk}/conditions/` | Condiciones Python |
| GET/POST | `/definitions/{wf_pk}/steps/{step_pk}/branches/{branch_pk}/routes/` | Rutas condicionales |

### Workflows — Solicitudes (Requests) (`/api/workflows/requests/`)

| Método | Endpoint | Descripción | Roles |
|--------|---------|-------------|-------|
| GET | `/requests/` | Listar solicitudes | Todos |
| POST | `/requests/` | Crear solicitud | admin/buyer |
| GET | `/requests/{id}/` | Detalle solicitud | Todos |
| PATCH | `/requests/{id}/` | Guardar datos de formulario | admin/buyer |
| GET | `/requests/{id}/form-schema/` | Esquema dinámico del form | Todos |
| GET | `/requests/{id}/available-branches/` | Acciones disponibles | Todos |
| POST | `/requests/{id}/transition/` | Ejecutar rama (avanzar) | Todos |
| GET | `/requests/{id}/history/` | Historial de transiciones | Todos |

### Negociaciones (`/api/negotiations/`)

| Método | Endpoint | Descripción | Roles |
|--------|---------|-------------|-------|
| GET/POST | `/processes/` | Listar/crear procesos | admin/buyer |
| GET/PATCH | `/processes/{id}/` | Detalle/editar proceso | admin/buyer |
| POST | `/processes/{id}/publish/` | DRAFT → OPEN | admin/buyer |
| POST | `/processes/{id}/set-evaluating/` | OPEN → EVALUATING | admin/buyer |
| POST | `/processes/{id}/close/` | Cerrar proceso | admin/buyer |
| GET/POST | `/processes/{id}/items/` | Gestionar ítems | admin/buyer |
| POST | `/processes/{id}/invite/` | Invitar proveedor | admin/buyer |
| DELETE | `/processes/{id}/invite/{pk}/` | Retirar invitación | admin/buyer |
| GET | `/processes/{id}/compare/` | Matriz comparativa ofertas | admin/buyer |
| POST | `/processes/{id}/offers/{pk}/accept/` | Aceptar oferta → genera OC | admin/buyer |
| POST | `/processes/{id}/offers/{pk}/reject/` | Rechazar oferta | admin/buyer |
| GET | `/processes/{proc_pk}/my-offer/` | Ver mi oferta (proveedor) | supplier |
| PUT | `/processes/{proc_pk}/my-offer/` | Guardar borrador oferta | supplier |
| POST | `/processes/{proc_pk}/my-offer/submit/` | Enviar oferta | supplier |
| GET/POST | `/orders/` | Órdenes de compra | admin/buyer |
| POST | `/orders/{id}/status/` | Actualizar estado OC | admin/buyer |

### IA (`/api/ai/`)

| Método | Endpoint | Descripción | Roles |
|--------|---------|-------------|-------|
| POST | `/ai/chat/` | Chat comprador/admin | admin/buyer |
| POST | `/ai/confirm-request/` | Confirmar solicitud sugerida por IA | admin/buyer |
| POST | `/ai/supplier/chat/` | Chat proveedor | supplier |
| POST | `/ai/supplier/suggestions/` | Sugerencias sin estado | supplier |

---

## Frontend

### Estructura de `src/`

```
src/
├── App.jsx                    # Router principal + providers
├── context/
│   ├── AuthContext.jsx        # Estado de sesión (user, login, logout)
│   └── TenantContext.jsx      # Subdominio y nombre de empresa
├── hooks/
│   ├── useApi.js              # Fetcher genérico (loading, error, data, refetch)
│   └── useDarkMode.js         # Toggle tema oscuro/claro
├── services/
│   └── api.js                 # Cliente Axios + todos los métodos de API
├── utils/
│   └── errors.js              # extractError() normaliza mensajes de error
├── components/
│   ├── Layout.jsx             # Shell: Sidebar + Topbar + TabBar + main
│   ├── Sidebar.jsx            # Navegación lateral (acordeón, rutas dinámicas)
│   ├── Topbar.jsx             # Barra superior (tema, notificaciones)
│   ├── TabBar.jsx             # Pestañas de páginas abiertas
│   ├── ProtectedRoute.jsx     # Guard de rutas por rol
│   ├── ErrorBoundary.jsx      # Captura errores React → muestra UI en lugar de blank
│   ├── WorkflowWizard.jsx     # Ejecuta una solicitud paso a paso
│   ├── DynamicForm.jsx        # Renderiza campos de formulario dinámico
│   ├── builder/               # Editor visual de workflows
│   │   ├── StepManager.jsx
│   │   ├── FieldManager.jsx
│   │   ├── FieldMatrixEditor.jsx
│   │   ├── BranchManager.jsx
│   │   ├── ConditionsManager.jsx
│   │   └── ConditionBuilder.jsx
│   └── ui/                    # Componentes base (Input, Button, Dialog, etc.)
└── pages/
    ├── LoginPage.jsx
    ├── RegisterPage.jsx
    ├── DashboardPage.jsx
    ├── SolicitudesPage.jsx
    ├── WorkflowListPage.jsx
    ├── WorkflowBuilderPage.jsx
    ├── NegotiationsPage.jsx
    ├── NegotiationDetailPage.jsx
    ├── SuppliersPage.jsx
    ├── BuyersPage.jsx
    ├── MarketplacePage.jsx
    ├── AIPage.jsx
    ├── SupplierAIPage.jsx
    └── AdminPage.jsx
```

### Rutas de la aplicación

| Ruta | Página | Roles |
|------|--------|-------|
| `/login` | LoginPage | Público |
| `/register` | RegisterPage | Público |
| `/dashboard` | DashboardPage | admin, buyer |
| `/solicitudes` | SolicitudesPage | Todos |
| `/solicitudes/workflow/:workflowId` | SolicitudesPage (filtrada) | Todos |
| `/workflows` | WorkflowListPage | admin, buyer |
| `/workflows/:id` | WorkflowBuilderPage | admin, buyer |
| `/negotiations` | NegotiationsPage | Todos |
| `/negotiations/:id` | NegotiationDetailPage | Todos |
| `/suppliers` | SuppliersPage | admin |
| `/buyers` | BuyersPage | admin |
| `/marketplace` | MarketplacePage | supplier |
| `/ai` | AIPage | admin, buyer |
| `/supplier-ai` | SupplierAIPage | supplier |
| `/admin-panel` | AdminPage | admin |

### Hook `useApi`

```js
const { data, loading, error, refetch } = useApi(fetchFn, deps)

// Maneja respuestas paginadas (results) y planas automáticamente
// setData(res.data?.results ?? res.data)
```

### Cliente API (`services/api.js`)

```js
authAPI          // register, login, logout, me
workflowDefAPI   // list, get, create, update, publish, clone, export, import...
workflowAPI      // listRequests, getRequest, createRequest, transition, formSchema...
negotiationAPI   // processes, items, invites, offers, orders, compare...
suppliersAPI     // suppliers, buyers, categories, profiles...
aiAPI            // chat, confirmRequest, supplierChat, suggestions
```

Interceptor de Axios: reintenta automáticamente con refresh token ante 401.

### Componentes clave

**`WorkflowWizard`**  
Maneja la ejecución de una solicitud completa:
- Muestra barra de progreso de pasos
- Renderiza formulario dinámico con `DynamicForm`
- Muestra botones de acción (ramas disponibles)
- Panel de historial de transiciones colapsable
- Endpoints: `form-schema/`, `available-branches/`, `transition/`, `history/`

**`DynamicForm`**  
Renderiza campos de cualquier tipo (`text`, `select`, `boolean`, `date`, etc.) según el esquema que devuelve `form-schema/`.

**`WorkflowBuilderPage`**  
Editor del workflow con 5 pestañas:
1. **Pasos** — Crear/editar/reordenar pasos y configurar roles
2. **Campos** — Definir campos del formulario
3. **Matriz** — Grid paso × campo para visibilidad/edición/obligatoriedad
4. **Ramas** — Acciones disponibles en cada paso (con rutas condicionales)
5. **Condiciones** — Funciones Python reutilizables

**`ErrorBoundary`**  
Captura errores de renderizado React en cualquier nivel. Muestra mensaje de error + stack trace + botón de recarga en lugar de pantalla en blanco.

---

## Configuración y despliegue

### Variables de entorno (backend)

```env
DEBUG=True
SECRET_KEY=<clave secreta>
ALLOWED_HOSTS=localhost,*.localhost
DB_NAME=procurehub
DB_USER=postgres
DB_PASSWORD=<password>
DB_HOST=localhost
DB_PORT=5432
ANTHROPIC_API_KEY=<clave Anthropic>
```

### Levantar en desarrollo

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate           # Windows
pip install -r requirements.txt
python manage.py migrate_schemas --shared
python manage.py runserver 0.0.0.0:8001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

**Acceso con tenant:**
```
http://acme.localhost:5173      # tenant "acme"
```

### Crear un tenant nuevo

```bash
# En Django shell
from tenants.models import Company, Domain
c = Company(schema_name='miempresa', name='Mi Empresa')
c.save()
Domain(domain='miempresa.localhost', tenant=c, is_primary=True).save()

# Migrar el nuevo esquema
python manage.py migrate_schemas
```

### Build de producción

```bash
# Frontend
cd frontend && npm run build    # genera dist/

# Backend
python manage.py collectstatic
gunicorn config.wsgi:application --bind 0.0.0.0:8001
```

---

## Estado actual del desarrollo

| Módulo | Estado |
|--------|--------|
| Autenticación JWT + multi-tenant | ✅ Completo |
| Gestión de usuarios (admin, buyer, supplier) | ✅ Completo |
| Perfiles de proveedor y comprador | ✅ Completo |
| Builder de workflows (low-code) | ✅ Completo |
| Motor de ejecución de workflows | ✅ Completo |
| Condiciones Python dinámicas | ✅ Completo |
| Rutas condicionales en ramas | ✅ Completo |
| Solicitudes con formularios dinámicos | ✅ Completo |
| Historial de transiciones (auditoría) | ✅ Completo |
| Procesos de negociación | ✅ Completo |
| Ofertas de proveedor + comparación | ✅ Completo |
| Órdenes de compra | ✅ Completo |
| Marketplace de proveedores | ✅ Completo |
| AI Assistant (comprador) | ✅ Completo |
| AI Advisor (proveedor) | ✅ Completo |
| Dashboard con métricas y gráficas | ✅ Completo |
| UI dark mode | ✅ Completo |
| ErrorBoundary (prevención pantalla en blanco) | ✅ Completo |
| Sistema de pestañas (TabBar) | ✅ Completo |
| Panel de administración | ✅ Completo |
