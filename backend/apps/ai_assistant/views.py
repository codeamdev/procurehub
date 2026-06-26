import json
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from apps.accounts.permissions import IsAdminOrBuyer, IsApprovedSupplier
from apps.common.exceptions import NotFoundError

from .models import AIConversation, AIMessage
from .services import SYSTEM_PROMPT, build_context, call_claude, handle_ai_response
from .supplier_services import (
    build_supplier_context, dispatch_supplier_chat, generate_suggestions
)

logger = logging.getLogger(__name__)


# ── Shared helpers ────────────────────────────────────────────────────────────

def _get_or_create_conversation(user, conv_id) -> AIConversation:
    if conv_id:
        try:
            return AIConversation.objects.get(pk=conv_id, user=user)
        except AIConversation.DoesNotExist:
            raise NotFoundError('Conversation not found.')
    return AIConversation.objects.create(user=user)


def _conversation_history(conversation: AIConversation) -> list:
    return [
        {'role': msg.role, 'content': msg.content}
        for msg in conversation.messages.order_by('created_at')[:20]
    ]


# ── Buyer / admin AI ──────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAdminOrBuyer])
def chat(request):
    """Buyer/admin AI chat. POST {message, context, conversation_id}."""
    message = request.data.get('message', '').strip()
    if not message:
        return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

    ctx_data = request.data.get('context', {})
    conversation = _get_or_create_conversation(request.user, request.data.get('conversation_id'))

    context = build_context(
        request.tenant.schema_name,
        request_id=ctx_data.get('request_id'),
        workflow_id=ctx_data.get('workflow_id'),
    )
    system_with_context = (
        SYSTEM_PROMPT + f'\n\nContexto del sistema:\n{json.dumps(context, indent=2, ensure_ascii=False)}'
    )
    messages = (
        _conversation_history(conversation)
        + [{'role': 'user', 'content': message}]
    )

    result = handle_ai_response(call_claude(messages, system_with_context), request.user, request.tenant.schema_name)

    AIMessage.objects.bulk_create([
        AIMessage(conversation=conversation, role='user', content=message),
        AIMessage(conversation=conversation, role='assistant', content=json.dumps(result)),
    ])

    return Response({'conversation_id': conversation.pk, 'response': result})


@api_view(['POST'])
@permission_classes([IsAdminOrBuyer])
def confirm_create_request(request):
    """Confirm an AI-suggested procurement request after user review."""
    from apps.procurement.serializers import ProcurementRequestSerializer
    from apps.procurement.services import create_procurement_request

    serializer = ProcurementRequestSerializer(data=request.data.get('data', {}))
    serializer.is_valid(raise_exception=True)
    req = create_procurement_request(request.user, serializer.validated_data)
    return Response(ProcurementRequestSerializer(req).data, status=status.HTTP_201_CREATED)


# ── Supplier AI ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsApprovedSupplier])
def supplier_chat(request):
    """
    Supplier-specific AI chat with request context.

    POST /api/ai/supplier/chat/
    Body: {
        "message": "Explain this request",
        "request_id": 42,          // optional — injects request context
        "conversation_id": null    // optional — resumes existing conversation
    }
    Response: {
        "conversation_id": 5,
        "response": {
            "type": "explanation|price_suggestion|proposal_draft|message",
            ...type-specific fields...
        }
    }
    """
    message = request.data.get('message', '').strip()
    if not message:
        return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

    request_id = request.data.get('request_id')
    conversation = _get_or_create_conversation(request.user, request.data.get('conversation_id'))

    # Build supplier-scoped context (includes their history + the target request)
    ctx = build_supplier_context(request.user, request_id=request_id)

    # Dispatch to mock or LLM
    result = dispatch_supplier_chat(message, ctx)

    AIMessage.objects.bulk_create([
        AIMessage(conversation=conversation, role='user', content=message),
        AIMessage(conversation=conversation, role='assistant', content=json.dumps(result)),
    ])

    logger.info(
        'Supplier %d AI chat: request_id=%s type=%s',
        request.user.pk, request_id, result.get('type'),
    )

    return Response({'conversation_id': conversation.pk, 'response': result})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agent_chat(request):
    """
    Agente conversacional de gestión de proveedores con tool-calling.

    POST /api/ai/agent/
    Turno 1 — mensaje normal:
        {"message": "lista los proveedores pendientes", "conversation_id": null}
    Turno 2 — confirmar escritura propuesta:
        {"confirm_action": {"tool": "aprobar_proveedor", "args": {"supplier_id": 5}},
         "conversation_id": 3}

    Respuestas posibles:
        {"type": "message", "content": "..."}
        {"type": "pending_action", "tool": "...", "args": {...}, "preview": "..."}
        {"type": "action_confirmed", "success": true, ...}
    """
    from .agent import SupplierAgent

    agent = SupplierAgent(request.user)
    conversation_id = request.data.get('conversation_id')

    if 'confirm_action' in request.data:
        action = request.data['confirm_action']
        tool = action.get('tool', '').strip()
        args = action.get('args', {})
        if not tool:
            return Response(
                {'error': 'confirm_action.tool es requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(conversation_id, int):
            return Response(
                {'error': 'conversation_id (int) es requerido para confirmaciones.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = agent.confirm_action(tool, args, conversation_id)
        return Response(result)

    message = request.data.get('message', '').strip()
    if not message:
        return Response(
            {'error': 'message es requerido.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = agent.run(message, conversation_id)
    return Response(result)


@api_view(['POST'])
@permission_classes([IsApprovedSupplier])
def supplier_suggestions(request):
    """
    Stateless structured suggestions for a specific request.
    No conversation history — pure request-in / suggestions-out.

    POST /api/ai/supplier/suggestions/
    Body: { "request_id": 42 }
    Response: {
        "price_suggestion": { "suggested", "range", "reasoning", "confidence" },
        "delivery_suggestion": { "days", "reasoning" },
        "proposal_template": { "price", "delivery_time", "message" },
        "competitive_insights": { "competing_proposals", "budget_utilization_pct", "tip" }
    }
    """
    request_id = request.data.get('request_id')
    if not request_id:
        return Response({'error': 'request_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    suggestions = generate_suggestions(request.user, request_id)
    logger.info('Supplier %d suggestions generated for request %d', request.user.pk, request_id)
    return Response(suggestions)
