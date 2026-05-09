"""
BranchExecutor — dispatches side effects declared in Branch.effects.

Design principles:
  - Effects are fire-and-forget: failures NEVER roll back the transition.
  - Each handler logs its own errors silently.
  - Adding a new effect type = add a new _handle_* method + register in HANDLERS.

Supported effect types:
  NOTIFY   — placeholder for email / push / in-app notifications
  WEBHOOK  — HTTP POST to a configured URL with request context
  LOG      — explicit structured log entry (useful for auditing)
"""
import logging
import httpx

logger = logging.getLogger(__name__)

# Timeout for outbound HTTP calls (seconds)
_WEBHOOK_TIMEOUT = 5


class BranchExecutor:

    def execute_effects(self, effects: list, context: dict) -> None:
        """
        Dispatch all effects in sequence.
        context keys:
          request, branch, from_step, to_step, executed_by, snapshot
        """
        for effect in effects:
            try:
                self._dispatch(effect, context)
            except Exception:
                logger.exception(
                    'Effect execution failed — request=%s effect=%s',
                    context.get('request') and context['request'].id,
                    effect,
                )

    # ── Dispatcher ────────────────────────────────────────────────────────────

    def _dispatch(self, effect: dict, context: dict) -> None:
        type_ = effect.get('type', '').upper()
        handler = getattr(self, f'_handle_{type_.lower()}', None)
        if handler:
            handler(effect, context)
        else:
            logger.warning('Unknown effect type: %s', type_)

    # ── Handlers ──────────────────────────────────────────────────────────────

    def _handle_notify(self, effect: dict, context: dict) -> None:
        """
        Placeholder notification handler.
        Replace or extend with real email / push logic.

        Effect shape:
          {"type": "NOTIFY", "to": "requester|admin|buyer", "template": "<template_key>"}
        """
        request = context['request']
        logger.info(
            'NOTIFY — request=%s to=%s template=%s',
            request.id,
            effect.get('to'),
            effect.get('template'),
        )
        # TODO: integrate with notification service
        #   e.g. send_notification(
        #       to=resolve_recipient(effect['to'], context),
        #       template=effect['template'],
        #       data={...context payload...},
        #   )

    def _handle_webhook(self, effect: dict, context: dict) -> None:
        """
        POST request payload to an external URL.

        Effect shape:
          {"type": "WEBHOOK", "url": "<url>", "headers": {}}
        """
        url = effect.get('url')
        if not url:
            logger.warning('WEBHOOK effect missing url — skipping.')
            return

        request = context['request']
        payload = {
            'request_id': str(request.id),
            'workflow': request.workflow_definition.name,
            'workflow_version': request.workflow_definition.version,
            'from_step': context['from_step'].name if context.get('from_step') else None,
            'to_step': context['to_step'].name if context.get('to_step') else None,
            'branch': context['branch'].label if context.get('branch') else None,
            'executed_by': context['executed_by'].email if context.get('executed_by') else None,
            'snapshot': context.get('snapshot', {}),
        }
        extra_headers = effect.get('headers', {})

        try:
            response = httpx.post(
                url,
                json=payload,
                headers={'Content-Type': 'application/json', **extra_headers},
                timeout=_WEBHOOK_TIMEOUT,
            )
            logger.info(
                'WEBHOOK — request=%s url=%s status=%s',
                request.id, url, response.status_code,
            )
        except httpx.RequestError as exc:
            logger.error('WEBHOOK request error — url=%s error=%s', url, exc)

    def _handle_log(self, effect: dict, context: dict) -> None:
        """
        Explicit structured log entry.

        Effect shape:
          {"type": "LOG", "message": "<text>", "level": "info|warning|error"}
        """
        level = effect.get('level', 'info').lower()
        message = effect.get('message', '')
        request_id = context['request'].id
        getattr(logger, level, logger.info)(
            'LOG effect — request=%s: %s', request_id, message
        )
