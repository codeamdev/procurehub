# ProcureHub — CLAUDE.md

SaaS multi-tenant de compras. Backend Django 5.2 + DRF + PostgreSQL + django-tenants. Frontend React 18 + Vite + Tailwind v4 + react-hook-form.

## Comandos (exactos — Windows)
```
cd backend && venv\Scripts\activate
pytest                      # -v --tb=short -p no:warnings (pytest.ini)
pytest tests/unit/          # | integration/ | multitenant/
pytest -k "nombre"
python manage.py runserver
python manage.py migrate_schemas --shared   # solo shared
python manage.py migrate                    # shared + tenants
python manage.py tenant_command createsuperuser --schema=acme
```
Frontend: `cd frontend && npm run dev` (puerto 5173). Build: `npm run build`.

**Requiere PostgreSQL real corriendo.** django-tenants no soporta BD en memoria.

## Stack — versiones fijas
Django 5.2.1 · DRF 3.17.1 · simplejwt 5.5.1 · django-tenants 3.10.1 · RestrictedPython 7.4 · React 18.3 · Vite 5.2 · Tailwind 4.1 · RHF 7.75.

**No subir versiones sin pedir.** Gestor: pip + `requirements.txt` (NO poetry/uv). venv en `backend/venv/`.

## Lo que NO existe (no asumir, no inventar)
- Sin ruff/black/flake8/isort/pre-commit. No hay linters.
- Sin eslint/prettier en frontend.
- Sin CI (`.github/workflows`), sin Dockerfile, sin docker-compose.
- pytest + pytest-django NO están en `requirements.txt` — instalados manual en el venv. `rf`, `db`, `django_db_blocker` son fixtures de pytest-django, no del proyecto.
- factory_boy NO se usa. Las "factories" son fixtures de pytest que retornan callables.
- `SETUP.md` → la sección "Load sample workflow" referencia modelos obsoletos (`Workflow`, `WorkflowStep`, `WorkflowAction`). Ignorar ese bloque; la arquitectura real está en `workflows/models.py`.

## Arquitectura
**Services layer:** cada app tiene `services.py` con funciones puras. Las views llaman al service; el service hace la lógica y lanza excepciones de `apps.common.exceptions`. Nueva lógica de negocio va en services, no en views/serializers.

Apps:
- `accounts` — User, JWT, permisos de rol
- `workflows` — motor de flujos; sub-paquete `engine/` (state_machine, form_service, rule_evaluator, python_evaluator, branch_executor)
- `procurement` — ProcurementRequest, Proposal
- `tenants` — Company, Domain (django-tenants)
- `negotiation`, `ai_assistant`, `common`

## Multi-tenancy (regla crítica)
- `TenantMainMiddleware` resuelve tenant por subdominio (Host header). Va primero en MIDDLEWARE.
- El middleware pone la conexión en el schema correcto → **no filtrar por tenant en querysets**; el aislamiento es por schema de BD.
- `auth` está en SHARED_APPS **y** TENANT_APPS → `auth_group`/`auth_permission` existen por schema tenant. Los grupos/permisos de Step (`signals.py`) se crean en el schema activo del tenant.
- **La fuga real no es entre tenants (schemas): es entre workflows dentro del mismo tenant.** `Step.objects.get(pk=id)` sin filtrar por `workflow` permite enlazar objetos de otro workflow. Siempre validar que el objeto referenciado pertenece al workflow en contexto.

## Convenciones de tests
- Clases `TestXxx`, `pytestmark = pytest.mark.django_db`, sin setUp/tearDown de unittest.
- HTTP con `TenantClient` (de `django_tenants.test.client`).
- Fixture `tenant` session-scoped en `backend/conftest.py` (schema `test`).
- Fixtures `make_user`, `make_request`, `buyer_client`, `supplier_client`, `admin_client` en `tests/conftest.py`.

## Permisos de Step
Grupo: `step:{uuid}`. Codenames: `step_view_{uuid_sin_guiones}`, `step_edit_*`, `step_execute_*`.
Creados por signal `post_save` en `signals.py`. Verificados con `user.has_perm('workflows.<codename>')`.

## Roles
- `admin` — crea y publica workflows, crea solicitudes
- `buyer` — crea solicitudes
- `supplier` — acceso solo a los pasos que se le asignen explícitamente; requiere `is_approved=True`

## Commits
Mensaje imperativo: `fix: <qué>` / `feat: <qué>` / `refactor: <qué>`. No commitear `frontend/dist/`, `.env`, ni `venv/`.
