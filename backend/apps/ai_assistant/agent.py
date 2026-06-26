"""
Bucle de tool-calling para el agente de gestión de proveedores.

Flujo:
  run()         → llamada normal (lectura o propuesta de escritura)
  confirm_action() → segunda vuelta: ejecuta la escritura confirmada por el usuario

El modelo PROPONE herramientas; NUESTRO código decide si ejecutarlas.
Las herramientas de escritura nunca se ejecutan en run() — siempre se devuelve
un pending_action para que el usuario confirme explícitamente.
"""
import json
import logging
from django.conf import settings
from rest_framework.exceptions import PermissionDenied

from .models import AIConversation, AIMessage
from .agent_tools_schema import TOOLS
from .agent_permissions import allowed_tools_for_role, is_write_tool
from .agent_tools_impl import execute_tool, build_action_preview

logger = logging.getLogger(__name__)

MAX_TOOL_TURNS = 5

_SYSTEM_PROMPT = """\
Eres un asistente especializado en gestión de proveedores para una plataforma B2B de compras.
Tu función es ayudar a consultar y gestionar el directorio de proveedores.

Reglas:
- Usa las herramientas disponibles para responder con datos reales.
- Para herramientas de escritura (aprobar, rechazar, actualizar): describe brevemente
  lo que propones hacer y usa la herramienta. El sistema pedirá confirmación al usuario
  antes de ejecutar — no tienes que pedirla tú.
- Responde siempre en español, de forma concisa y profesional.
- Nunca inventes datos; usa solo lo que retornan las herramientas.
"""


class SupplierAgent:
    """
    Agente conversacional con tool-calling para gestión de proveedores.
    Una instancia por request; se crea en la vista con el user autenticado.
    """

    def __init__(self, user):
        self.user = user

    # ── Punto de entrada principal ────────────────────────────────────────────

    def run(self, message: str, conversation_id=None) -> dict:
        """
        Procesa un mensaje del usuario.
        Retorna:
          {'type': 'message', 'content': '...'}          → respuesta de texto
          {'type': 'pending_action', 'tool': ..., 'args': ..., 'preview': ...}
              → el modelo propuso una escritura; el usuario debe confirmar
        """
        import anthropic

        conversation = self._get_or_create_conversation(conversation_id)
        history = self._load_history(conversation)
        messages = history + [{'role': 'user', 'content': message}]

        allowed = allowed_tools_for_role(self.user.role)
        tools = [t for t in TOOLS if t['name'] in allowed]

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        system = self._build_system_prompt()
        result = self._run_loop(client, messages, tools, system)

        AIMessage.objects.bulk_create([
            AIMessage(conversation=conversation, role='user', content=message),
            AIMessage(conversation=conversation, role='assistant', content=json.dumps(result)),
        ])
        logger.info('Agent run: user=%d type=%s', self.user.pk, result.get('type'))
        return {'conversation_id': conversation.pk, 'response': result}

    def confirm_action(self, tool: str, args: dict, conversation_id: int) -> dict:
        """
        Ejecuta una herramienta de escritura previamente propuesta.
        Segunda verificación de permisos — la primera ocurrió en run().
        """
        allowed = allowed_tools_for_role(self.user.role)
        if tool not in allowed:
            raise PermissionDenied(
                f'Herramienta "{tool}" no permitida para el rol "{self.user.role}".'
            )
        if not is_write_tool(tool):
            raise PermissionDenied('confirm_action solo aplica a herramientas de escritura.')

        result = execute_tool(tool, args, self.user)

        conversation = AIConversation.objects.get(pk=conversation_id, user=self.user)
        AIMessage.objects.create(
            conversation=conversation,
            role='assistant',
            content=json.dumps({'type': 'action_confirmed', **result}),
        )
        logger.info('Action confirmed: tool=%s user=%d', tool, self.user.pk)
        return {
            'conversation_id': conversation_id,
            'response': {'type': 'action_confirmed', **result},
        }

    # ── Internals ─────────────────────────────────────────────────────────────

    def _run_loop(self, client, messages: list, tools: list, system: str) -> dict:
        """
        Bucle de tool-calling con límite de MAX_TOOL_TURNS iteraciones.
        - end_turn → devuelve la respuesta de texto.
        - tool_use → si es lectura: ejecuta y continúa; si es escritura: pausa y pide confirmación.
        """
        for _ in range(MAX_TOOL_TURNS):
            response = client.messages.create(
                model='claude-sonnet-4-6',
                max_tokens=1024,
                system=system,
                tools=tools,
                messages=messages,
            )

            if response.stop_reason == 'end_turn':
                text = next(
                    (b.text for b in response.content if hasattr(b, 'text')), ''
                )
                return {'type': 'message', 'content': text}

            if response.stop_reason == 'tool_use':
                tool_block = next(
                    (b for b in response.content if b.type == 'tool_use'), None
                )
                if tool_block is None:
                    break

                tool_name = tool_block.name
                tool_args = tool_block.input

                # Segunda capa de autorización (el modelo podría proponer cualquier cosa)
                allowed = allowed_tools_for_role(self.user.role)
                if tool_name not in allowed:
                    return {
                        'type': 'error',
                        'content': f'Herramienta "{tool_name}" no permitida.',
                    }

                # Escritura → detener el bucle y pedir confirmación al usuario
                if is_write_tool(tool_name):
                    return {
                        'type': 'pending_action',
                        'tool': tool_name,
                        'args': tool_args,
                        'preview': build_action_preview(tool_name, tool_args),
                    }

                # Lectura → ejecutar, inyectar resultado y continuar el bucle
                tool_result = execute_tool(tool_name, tool_args, self.user)
                messages = messages + [
                    {'role': 'assistant', 'content': response.content},
                    {
                        'role': 'user',
                        'content': [{
                            'type': 'tool_result',
                            'tool_use_id': tool_block.id,
                            'content': json.dumps(tool_result, ensure_ascii=False),
                        }],
                    },
                ]
                continue

            break  # stop_reason desconocido

        return {'type': 'message', 'content': 'Sin respuesta del modelo.'}

    def _build_system_prompt(self) -> str:
        role_labels = {
            'admin': 'administrador (puede aprobar, rechazar y actualizar proveedores)',
            'buyer': 'comprador (acceso de solo lectura)',
            'supplier': 'proveedor (acceso solo a su propio perfil)',
        }
        label = role_labels.get(self.user.role, self.user.role)
        return _SYSTEM_PROMPT + f'\n\nUsuario activo: {self.user.email} — {label}.'

    def _get_or_create_conversation(self, conversation_id) -> AIConversation:
        if conversation_id:
            return AIConversation.objects.get(pk=conversation_id, user=self.user)
        return AIConversation.objects.create(user=self.user)

    def _load_history(self, conversation: AIConversation) -> list:
        return [
            {'role': msg.role, 'content': msg.content}
            for msg in conversation.messages.order_by('created_at')[:20]
        ]
