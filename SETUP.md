# ProcureHub — Setup Instructions

## Stack de versiones
| Componente | Versión |
|-----------|---------|
| Python | 3.12 |
| Django | 5.2.1 LTS |
| django-tenants | 3.10.1 |
| djangorestframework | 3.17.1 |
| simplejwt | 5.5.1 |
| django-cors-headers | 4.9.0 |
| openai SDK | 2.32.0 |
| psycopg2-binary | 2.9.12 |
| Node.js frontend | 18+ |
| PostgreSQL | 14+ |

> **¿Por qué Django 5.2 y no 6.0?**
> `djangorestframework-simplejwt` 5.5.1 aún no soporta Django 6.0 oficialmente.
> Django 5.2 es LTS con soporte hasta abril 2028, la opción más estable.

## Prerequisites
- Python 3.12
- PostgreSQL 14+
- Node.js 18+

---

## 1. Backend Setup

### Create virtualenv
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### Install dependencies
```bash
pip install -r requirements.txt
```

### Configure environment
```bash
cp .env.example .env
# Edit .env with your values:
#   DB_NAME, DB_USER, DB_PASSWORD, OPENAI_API_KEY, etc.
```

### Create PostgreSQL database
```sql
CREATE DATABASE procurement_db;
```

### Run migrations
```bash
# Create public schema tables (tenants, users)
python manage.py migrate_schemas --shared

# Or run all migrations
python manage.py migrate
```

### Create the public tenant
```bash
python manage.py shell
```
```python
from apps.tenants.models import Company, Domain

# Public schema (required by django-tenants)
pub = Company(schema_name='public', name='Public')
pub.save()
Domain.objects.create(domain='localhost', tenant=pub, is_primary=True)

# Create your first company tenant
company = Company(schema_name='acme', name='Acme Corp')
company.save()
Domain.objects.create(domain='acme.localhost', tenant=company, is_primary=True)
```

### Create superuser (inside company schema)
```bash
python manage.py tenant_command createsuperuser --schema=acme
```

### Load sample workflow (optional)
```bash
python manage.py shell
```
```python
from apps.workflows.models import Workflow, WorkflowStep, WorkflowAction

wf = Workflow.objects.create(name='Purchase Request', description='Standard purchase approval workflow')

step1 = WorkflowStep.objects.create(
    workflow=wf, name='Request Details', order=1,
    fields=[
        {'name': 'product', 'label': 'Product Name', 'type': 'text', 'required': True},
        {'name': 'quantity', 'label': 'Quantity', 'type': 'number', 'required': True},
        {'name': 'urgent', 'label': 'Urgent?', 'type': 'boolean', 'required': False},
        {'name': 'category', 'label': 'Category', 'type': 'select', 'required': True, 'options': ['IT', 'Office', 'Marketing', 'Other']},
    ],
    allowed_roles_to_view=['admin', 'buyer'],
    allowed_roles_to_edit=['buyer'],
    allowed_roles_to_act=['buyer'],
)

step2 = WorkflowStep.objects.create(
    workflow=wf, name='Manager Approval', order=2,
    fields=[
        {'name': 'approval_notes', 'label': 'Approval Notes', 'type': 'text', 'required': False},
    ],
    allowed_roles_to_view=['admin', 'buyer'],
    allowed_roles_to_edit=['admin'],
    allowed_roles_to_act=['admin'],
)

WorkflowAction.objects.create(step=step1, label='Submit for Approval', type='next', next_step=step2)
WorkflowAction.objects.create(step=step2, label='Approve', type='approve', next_step=None)
WorkflowAction.objects.create(step=step2, label='Reject', type='reject', next_step=None)
print('Workflow created!')
```

### Run the backend
```bash
python manage.py runserver
```

---

## 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## 3. Accessing the App

### With subdomains (recommended)
Add to your `hosts` file (C:\Windows\System32\drivers\etc\hosts on Windows):
```
127.0.0.1   acme.localhost
```

Then access: http://acme.localhost:5173

### Without subdomains (development)
Update `settings.py` to use `localhost` as the default tenant for testing.

---

## 4. API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register/ | Register user |
| POST | /api/auth/login/ | Login (returns JWT) |
| POST | /api/auth/logout/ | Logout (blacklist token) |
| GET  | /api/auth/me/ | Current user info |
| POST | /api/auth/token/refresh/ | Refresh JWT |
| GET  | /api/workflows/definitions/ | List workflows |
| GET/POST | /api/workflows/requests/ | Workflow request list/create |
| POST | /api/workflows/requests/{id}/execute/ | Execute workflow action |
| GET/POST | /api/procurement/requests/ | Procurement requests |
| GET  | /api/procurement/requests/{id}/ | Request detail |
| POST | /api/procurement/requests/{id}/award/ | Award proposal |
| POST | /api/procurement/requests/{id}/proposals/ | Submit proposal |
| POST | /api/suppliers/request-access/ | Supplier requests company access |
| GET  | /api/suppliers/ | List supplier requests (admin) |
| POST | /api/suppliers/{id}/approve/ | Approve supplier (admin) |
| POST | /api/suppliers/{id}/reject/ | Reject supplier (admin) |
| POST | /api/ai/chat/ | AI assistant chat |
| POST | /api/ai/confirm-request/ | Confirm AI-suggested request |

---

## 5. Roles Summary

| Role | Can Do |
|------|--------|
| ADMIN | Everything + approve suppliers + full access |
| BUYER | Create procurement requests, view proposals |
| SUPPLIER | Request company access, view open requests, submit proposals |

---

## 6. Architecture

```
proyecto_general/
  backend/
    config/          # Django settings, URLs, WSGI
    apps/
      accounts/      # User model, JWT auth, supplier access
      tenants/       # Company & Domain models (django-tenants)
      workflows/     # Dynamic workflow engine (Prompt 1 & 2)
      procurement/   # Request & Proposal models (Prompt 5)
      ai_assistant/  # OpenAI integration (Prompt 3)
    requirements.txt
  frontend/
    src/
      components/    # DynamicForm, WorkflowWizard, Layout, ProtectedRoute
      context/       # AuthContext
      pages/         # Login, Register, Requests, AI, Admin, Marketplace
      services/      # api.js (axios + interceptors)
    package.json
    vite.config.js
```
