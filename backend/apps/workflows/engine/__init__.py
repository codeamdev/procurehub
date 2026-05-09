from .rule_evaluator import RuleEvaluator
from .form_service import FormService
from .state_machine import WorkflowStateMachine, TransitionError
from .branch_executor import BranchExecutor
from .python_evaluator import evaluate_python_condition

# ── Shared singletons (stateless, thread-safe) ────────────────────────────────
_evaluator = RuleEvaluator()
_form_service = FormService()
_executor = BranchExecutor()
_state_machine = WorkflowStateMachine(_evaluator, _form_service, _executor)


def get_evaluator() -> RuleEvaluator:
    return _evaluator


def get_form_service() -> FormService:
    return _form_service


def get_state_machine() -> WorkflowStateMachine:
    return _state_machine


__all__ = [
    'RuleEvaluator', 'FormService', 'WorkflowStateMachine', 'BranchExecutor',
    'TransitionError', 'evaluate_python_condition',
    'get_evaluator', 'get_form_service', 'get_state_machine',
]
