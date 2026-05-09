"""
WorkflowStateMachine — the core of the workflow engine.

Responsibilities:
  1. Return branches available for the current step (visibility evaluated).
  2. Validate a branch execution attempt (guards + required fields).
  3. Execute a transition atomically:
       - Persist field data
       - Resolve destination via condition_routes (Python functions) or branch fallback
       - Move current_step (or set terminal status, or stay on current step)
       - Record RequestHistory with data snapshot
       - Dispatch post-transition effects (async, best-effort)
"""
import logging
from django.db import transaction

from ..models import Branch, Request, RequestData, RequestHistory
from ..services import save_field_data, get_request_data_as_dict
from .rule_evaluator import RuleEvaluator
from .form_service import FormService
from .branch_executor import BranchExecutor
from .python_evaluator import evaluate_python_condition

logger = logging.getLogger(__name__)


class TransitionError(Exception):
    """Raised when a transition cannot be executed."""
    def __init__(self, message: str, errors: dict | None = None):
        super().__init__(message)
        self.message = message
        self.errors = errors or {}


class WorkflowStateMachine:
    def __init__(
        self,
        evaluator: RuleEvaluator,
        form_service: FormService,
        executor: BranchExecutor,
    ):
        self.evaluator = evaluator  # used for Branch.condition / Branch.validations (JSON)
        self.form_service = form_service
        self.executor = executor

    # ── Query ─────────────────────────────────────────────────────────────────

    def get_available_branches(self, request: Request, current_data: dict) -> list[Branch]:
        """
        Returns branches visible for the current step.
        Evaluates each branch's `condition` (JSON tree) against current_data.
        """
        if not request.is_active or not request.current_step:
            return []

        return [
            b for b in
            request.current_step.branches.select_related('target_step').order_by('order')
            if self.evaluator.evaluate(b.condition, current_data)
        ]

    # ── Validation ────────────────────────────────────────────────────────────

    def validate(
        self,
        request: Request,
        branch: Branch,
        field_data: dict,
    ) -> dict[str, list[str]]:
        """
        Returns validation errors. Empty dict = can proceed.

        Checks:
          1. Request is active.
          2. Branch belongs to the current step.
          3. Branch condition (JSON) is satisfied.
          4. Branch validation rules pass.
          5. Required fields are filled.
        """
        errors: dict[str, list[str]] = {}

        if not request.is_active:
            errors['__request__'] = ['Request is not active.']
            return errors

        if str(branch.step_id) != str(request.current_step_id):
            errors['__branch__'] = ['Branch does not belong to the current step.']
            return errors

        if branch.condition and not self.evaluator.evaluate(branch.condition, field_data):
            errors['__branch__'] = ['This action is not available for the current data.']
            return errors

        if branch.validations and not self.evaluator.evaluate(branch.validations, field_data):
            errors['__validation__'] = ['Validation conditions were not met.']

        field_errors = self.form_service.validate_required_fields(
            request.current_step, field_data
        )
        errors.update(field_errors)

        return errors

    # ── Route resolution ──────────────────────────────────────────────────────

    def _resolve_route(self, branch: Branch, data: dict, request: Request):
        """
        Evaluate condition_routes in order to determine the transition destination.

        Returns:
          (target_step, terminal_status, stay)
          stay=True → save data but remain on current step (no step change).

        Falls back to branch.target_step / branch.terminal_status when no routes exist.
        """
        routes = list(
            branch.condition_routes
            .select_related('condition', 'target_step')
            .order_by('order')
        )

        if not routes:
            # Legacy / simple branch: use direct target
            return branch.target_step, branch.terminal_status, False

        for route in routes:
            if route.condition is None:
                matched = True  # default / else route
            else:
                matched = evaluate_python_condition(
                    route.condition.code, data, request
                )

            if matched:
                if route.target_step is None and not route.terminal_status:
                    return None, None, True  # stay on current step
                return route.target_step, route.terminal_status, False

        # No route matched → stay on current step
        logger.info(
            'Branch "%s" on request %s: no condition_route matched, staying on step.',
            branch.label,
            request.id,
        )
        return None, None, True

    # ── Execution ─────────────────────────────────────────────────────────────

    @transaction.atomic
    def execute(
        self,
        request: Request,
        branch: Branch,
        field_data: dict,
        user,
        notes: str = '',
    ) -> Request:
        """
        Execute a transition. Raises TransitionError on guard failures.
        """
        errors = self.validate(request, branch, field_data)
        if errors:
            raise TransitionError('Transition validation failed.', errors)

        from_step = request.current_step

        # 1. Persist submitted field data
        save_field_data(request, field_data)

        # 2. Snapshot state after saving (so conditions can read submitted values)
        snapshot = get_request_data_as_dict(request)

        # 3. Resolve destination via condition_routes (or branch fallback)
        target_step, terminal_status, stay = self._resolve_route(branch, snapshot, request)

        # 4. Apply transition
        if not stay:
            if target_step:
                request.current_step = target_step
            else:
                request.current_step = None
                request.status = terminal_status or Request.Status.COMPLETED

        request.save(update_fields=['current_step', 'status', 'updated_at'])

        # 5. Record history (immutable audit trail — always written, even on stay)
        RequestHistory.objects.create(
            request=request,
            from_step=from_step,
            to_step=request.current_step,
            branch=branch,
            executed_by=user,
            data_snapshot=snapshot,
            notes=notes,
        )

        logger.info(
            'Request %s: [%s] →[%s]→ [%s]%s by %s',
            request.id,
            from_step.name if from_step else 'START',
            branch.label,
            request.current_step.name if request.current_step else 'END',
            ' (stayed)' if stay else '',
            user.email if user else 'system',
        )

        # 6. Fire effects outside the transaction (failures do not roll back)
        context = {
            'request': request,
            'branch': branch,
            'from_step': from_step,
            'to_step': request.current_step,
            'executed_by': user,
            'snapshot': snapshot,
            'stayed': stay,
        }
        self.executor.execute_effects(branch.effects or [], context)

        return request
