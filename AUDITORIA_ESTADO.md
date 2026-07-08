# Estado de auditoría — ProcureHub

Última actualización: 2026-07-07

---

## Suite actual

**185 passed · 0 failed · 2 skipped** (11 errors preexistentes en multitenant — requieren schema público, no se ejecutan en suite normal).

---

## Completado

### Auditoría inicial — 12 BUGs corregidos

| BUG | Fix | Commit |
|-----|-----|--------|
| BUG-001 | Generación atómica de código (`RequestCodeCounter` + retry) | `54cc7cc` |
| BUG-002 | `unique=True` en `Request.code` + migración 0009 con dedup | `3ba69de` |
| BUG-003 | `can_view_request`: aprobadores ven solicitudes completed/cancelled vía historial | `79030ea` |
| BUG-004 | `clone_workflow` copia `code_prefix` | `b441c6a` |
| BUG-2.2 | Validación cross-workflow en `BranchWriteSerializer` y `BranchConditionRouteWriteSerializer` | `861bff6` |
| BUG-005/009 | Reverse real en migración 0007 + desconexión de signal durante RunPython | `883434c` |
| BUG-006 | `publish_workflow` exige exactamente un `is_initial` | `f01936f` |
| BUG-007 | `bulk_update` en `reorder_steps` y `reorder_fields` | `2287f72` |
| BUG-008/011 | `import_workflow` valida `field_type` y exactamente un paso inicial | `8fbc6a4` |
| BUG-010 | `toggle_menu` restringido a workflows ACTIVE | `7900abb` |
| BUG-012 | `available_branches` anota `can_execute`; frontend deshabilita botones con tooltip | `e68a05f` |
| BUG-013 | JWT a httpOnly cookies (SameSite=Lax) + `CookieJWTAuthentication` | `67576fc` |

### Pista A — 8 tests mecánicos corregidos (`e62ac3d`)
- 5 tests de `ai_assistant`: reescritos contra la API real (Anthropic, claves en español)
- 1 test `test_ordering_is_newest_first`: desempate `-id` en `ProcurementRequest.Meta.ordering`
- 2 tests `_mock_chat`: marcados `@pytest.mark.skip` (mock temporal reemplazado por agente)

### Pista B — 3 tests de dominio proveedor corregidos (`f69c022`)
- `reject_supplier`: permite rechazar proveedores pendientes; establece `is_active=False`
- `ProposalViewSet`: usa `IsApprovedSupplier` en lugar de `IsSupplier` (bug de seguridad)

### Agente de tool-calling (`e6d5727`, `65ccd28`, `9551044`)
- Backend: `agent_tools_schema.py`, `agent_permissions.py`, `agent_tools_impl.py`, `agent.py`
- Endpoint: `POST /api/ai/agent/` — dos turnos (mensaje → pending_action → confirmación)
- Frontend: `AgentPage.jsx` con chat + panel de confirmación de escrituras

### UX frontend (`c5d0276`)
- Sidebar push-layout con persistencia en localStorage
- DynamicForm en grid 2 columnas (textarea/multiselect/boolean a ancho completo)
- SolicitudesPage: columna de acciones explícita, badge de código de solicitud

---

## Tests nuevos agregados

- `tests/unit/test_workflow_services.py` — BUG-001/003/004/006/008/011
- `tests/unit/test_step_permissions.py` — 15 tests de permisos por paso
- `tests/integration/test_workflow_serializers.py` — 7 tests cross-workflow

---

## Pendiente / no construido

| Qué | Estado |
|-----|--------|
| Notificaciones (email/in-app) al aprobar/rechazar proveedor | No diseñado |
| Workflow completo de homologación de proveedores | Fix pragmático aplicado (booleano); workflow real es trabajo futuro |
| Tests para `CookieJWTAuthentication` y `token_refresh_cookie` | Sin tests de backend para las nuevas vistas de auth con cookies |
| Validación visual en navegador de AgentPage y UX changes | Sin prueba en browser |
