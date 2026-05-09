"""
AI service layer — prompt construction, Anthropic Claude calls, and response handling.
All business logic stays here; views only handle HTTP concerns.
"""
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres un asistente de IA integrado en una plataforma de gestión de compras B2B.
Ayudas a los equipos de compras a gestionar solicitudes de flujos de trabajo, evaluar proveedores y analizar cotizaciones.

Puedes realizar las siguientes acciones devolviendo JSON estructurado:

1. Responder preguntas → {"type": "message", "content": "tu respuesta"}
2. Crear una solicitud de workflow → {"type": "create_request", "workflow_id": "<uuid>", "data": {"title": "...", "description": "..."}}
3. Recomendar proveedores → {"type": "recommend_suppliers", "suppliers": [<id>, ...], "reason": "..."}

Reglas:
- SIEMPRE responde con JSON válido.
- Mantén las respuestas concisas y profesionales.
- Nunca inventes datos; usa solo la información proporcionada en el contexto.
- Responde siempre en español.
"""


def build_context(tenant_schema: str, request_id=None, workflow_id=None) -> dict:
    """Gather tenant-scoped data to inject into the AI prompt."""
    from apps.workflows.models import Request, WorkflowDefinition
    from django.contrib.auth import get_user_model

    User = get_user_model()
    ctx: dict = {}

    ctx['solicitudes_recientes'] = [
        {
            'id': str(r.id),
            'titulo': r.title,
            'estado': r.status,
            'workflow': r.workflow_definition.name if r.workflow_definition else '',
            'creado': str(r.created_at.date()),
        }
        for r in Request.objects.select_related('workflow_definition')
                         .order_by('-created_at')[:10]
    ]

    ctx['workflows_activos'] = [
        {'id': str(wf.id), 'nombre': wf.name, 'descripcion': wf.description}
        for wf in WorkflowDefinition.objects.filter(status='active')
    ]

    ctx['proveedores'] = [
        {'id': s.id, 'email': s.email}
        for s in User.objects.filter(role='supplier', is_approved=True)
    ]

    if request_id:
        try:
            req = Request.objects.select_related('workflow_definition', 'current_step').get(pk=request_id)
            ctx['solicitud_actual'] = {
                'id': str(req.id),
                'titulo': req.title,
                'estado': req.status,
                'paso_actual': req.current_step.name if req.current_step else None,
                'workflow': req.workflow_definition.name if req.workflow_definition else '',
            }
        except Request.DoesNotExist:
            pass

    return ctx


def call_claude(messages: list, system: str = SYSTEM_PROMPT) -> dict:
    """Call Anthropic Claude and parse the JSON response."""
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=1024,
            system=system,
            messages=messages,
        )

        content = response.content[0].text if response.content else '{}'

        # Extract JSON — Claude may wrap it in markdown code blocks
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()

        return json.loads(content)

    except json.JSONDecodeError:
        logger.error('Claude returned non-JSON response')
        return {'type': 'message', 'content': 'El servicio de IA devolvió una respuesta inesperada.'}
    except Exception as exc:
        logger.error('Claude call failed: %s', exc, exc_info=True)
        return {'type': 'message', 'content': 'El servicio de IA no está disponible temporalmente.'}


def handle_ai_response(ai_response: dict, user, tenant_schema: str) -> dict:
    """Execute side-effects based on the AI response type and return the client payload."""
    rtype = ai_response.get('type')

    if rtype == 'message':
        return ai_response

    if rtype == 'create_request':
        return {
            'type': 'create_request',
            'preview': ai_response.get('data', {}),
            'workflow_id': ai_response.get('workflow_id'),
            'requires_confirmation': True,
        }

    if rtype == 'recommend_suppliers':
        from django.contrib.auth import get_user_model
        User = get_user_model()
        supplier_ids = ai_response.get('suppliers', [])
        suppliers = User.objects.filter(pk__in=supplier_ids, role='supplier', is_approved=True)
        return {
            'type': 'recommend_suppliers',
            'suppliers': [{'id': s.id, 'email': s.email} for s in suppliers],
            'reason': ai_response.get('reason', ''),
        }

    logger.warning('Unknown AI response type "%s" — treating as message', rtype)
    return {'type': 'message', 'content': str(ai_response)}
