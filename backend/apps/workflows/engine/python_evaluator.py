"""
Python condition evaluator — executes user-defined condition code in a strict sandbox.

Security model
--------------
1. RestrictedPython compiles the AST with guard injections before any execution.
   This is done at the bytecode level, not the runtime level, so it cannot be
   bypassed by clever Python tricks (unlike a plain exec() with filtered builtins).

2. The Django ORM Request instance is NEVER passed to the sandbox.
   Only a frozen RequestContext dataclass with a handful of scalar fields is exposed.

3. Every attribute access goes through _safe_getattr_, which blocks:
   - All dunder/private attrs (anything starting with '_')
   - Any access on types not in our explicit allowlist

4. Only a carefully curated set of builtins is available — no open(), exec(), eval(),
   compile(), __import__(), globals(), locals(), getattr(), type(), super(), etc.

Available variables inside a condition
---------------------------------------
  data    : dict[str, Any]   — {field_key: current_value} for the request
  request : RequestContext   — read-only: .id, .status, .workflow_name, .created_by_email
  result  : bool             — must be set by the code (default False)

Example condition code
----------------------
  result = data.get('amount', 0) > 1000

  # Multi-line
  amount = data.get('amount', 0)
  department = data.get('department', '')
  result = amount > 5000 and department in ('IT', 'Finance')
"""
import logging
from dataclasses import dataclass
from typing import Any

from RestrictedPython import compile_restricted
from RestrictedPython.Guards import guarded_iter_unpack_sequence

logger = logging.getLogger(__name__)


# ── Safe request context ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class RequestContext:
    """
    Immutable, safe view of a Request instance for use inside condition code.
    Only scalar fields are exposed — no ORM relationships, no querysets.
    """
    id: str = ''
    status: str = ''
    workflow_name: str = ''
    created_by_email: str = ''

    @classmethod
    def from_request(cls, request) -> 'RequestContext':
        if request is None:
            return cls()
        try:
            return cls(
                id=str(request.id),
                status=str(request.status),
                workflow_name=(
                    str(request.workflow_definition.name)
                    if request.workflow_definition_id else ''
                ),
                created_by_email=(
                    str(request.created_by.email)
                    if request.created_by_id else ''
                ),
            )
        except Exception:
            return cls()


# ── Guard functions ───────────────────────────────────────────────────────────

# Types whose instances are safe to access attributes on.
_SAFE_ATTR_TYPES = (dict, list, str, int, float, bool, type(None), RequestContext)


def _safe_getattr(obj: Any, name: str) -> Any:
    """
    Guard for all attribute lookups inside restricted code.
    RestrictedPython transforms every `obj.attr` to `_getattr_(obj, attr)`.
    Blocks dunder/private attrs and access on non-safe types.
    """
    if name.startswith('_'):
        raise AttributeError(
            f"El acceso al atributo '{name}' no está permitido en condiciones."
        )
    if not isinstance(obj, _SAFE_ATTR_TYPES):
        raise AttributeError(
            f"El acceso a atributos en '{type(obj).__name__}' no está permitido."
        )
    return getattr(obj, name)


def _safe_getitem(obj: Any, index: Any) -> Any:
    """Guard for subscript access: obj[index]."""
    if not isinstance(obj, (dict, list, tuple, str)):
        raise TypeError(
            f"El acceso por índice en '{type(obj).__name__}' no está permitido."
        )
    return obj[index]


def _safe_write(obj: Any) -> Any:
    """
    Guard for augmented assignment / attribute writes.
    Blocks all writes to external objects; local variable assignment (result = True)
    goes directly to the local namespace and does NOT pass through this guard.
    """
    raise TypeError(
        "La asignación a objetos externos no está permitida en condiciones."
    )


def _inplacevar_stub(op: str, x: Any, y: Any) -> Any:
    """
    RestrictedPython transforms `x += y` to `x = _inplacevar_('+', x, y)`.
    Only numeric and string in-place operations are allowed.
    """
    if op == '+=' and isinstance(x, (int, float, str)):
        return x + y
    if op == '-=' and isinstance(x, (int, float)):
        return x - y
    if op == '*=' and isinstance(x, (int, float)):
        return x * y
    if op == '/=' and isinstance(x, (int, float)):
        return x / y
    raise TypeError(f"Operador en-lugar '{op}' no permitido en condiciones.")


# ── Condition-safe builtins ───────────────────────────────────────────────────

# Explicit allowlist — no open, exec, eval, compile, __import__, globals, locals,
# getattr, type, super, vars, dir, print, input, etc.
_CONDITION_BUILTINS: dict = {
    # Math / numeric
    'abs': abs,
    'divmod': divmod,
    'float': float,
    'int': int,
    'max': max,
    'min': min,
    'pow': pow,
    'round': round,
    'sum': sum,
    # Sequence / mapping
    'bool': bool,
    'bytes': bytes,
    'chr': chr,
    'dict': dict,
    'enumerate': enumerate,
    'filter': filter,
    'frozenset': frozenset,
    'iter': iter,
    'len': len,
    'list': list,
    'map': map,
    'next': next,
    'ord': ord,
    'range': range,
    'repr': repr,
    'reversed': reversed,
    'set': set,
    'slice': slice,
    'sorted': sorted,
    'str': str,
    'tuple': tuple,
    'zip': zip,
    # Type checks
    'callable': callable,
    'isinstance': isinstance,
    # Constants
    'True': True,
    'False': False,
    'None': None,
    # Common exceptions (for try/except in conditions)
    'ValueError': ValueError,
    'TypeError': TypeError,
    'KeyError': KeyError,
    'IndexError': IndexError,
    'AttributeError': AttributeError,
    # RestrictedPython internal — needed for `x += y` syntax
    '_inplacevar_': _inplacevar_stub,
}


def _build_restricted_globals() -> dict:
    return {
        '__builtins__': _CONDITION_BUILTINS,
        '__name__': None,
        '__doc__': None,
        # Guard hooks that RestrictedPython injects at AST compile time
        '_getattr_': _safe_getattr,
        '_getitem_': _safe_getitem,
        '_getiter_': iter,
        '_iter_unpack_sequence_': guarded_iter_unpack_sequence,
        '_write_': _safe_write,
    }


# ── Public API ────────────────────────────────────────────────────────────────

def evaluate_python_condition(code: str, data: dict, request=None) -> bool:
    """
    Execute a user-defined Python condition inside the restricted sandbox.

    Returns bool(result) after execution. Defaults to False on any error
    (fail-safe: a broken condition never blocks a workflow unexpectedly).
    Thread-safe.
    """
    if not code or not code.strip():
        return False

    try:
        byte_code = compile_restricted(code, '<condition>', 'exec')
    except SyntaxError as exc:
        logger.warning('Condition syntax error: %s | snippet: %.200s', exc, code)
        return False

    local_vars: dict = {
        'data': data,
        'request': RequestContext.from_request(request),
        'result': False,
    }

    try:
        exec(byte_code, _build_restricted_globals(), local_vars)  # noqa: S102
        return bool(local_vars.get('result', False))
    except Exception as exc:
        logger.warning('Condition runtime error: %s | snippet: %.200s', exc, code)
        return False


def validate_condition_code(code: str) -> list[str]:
    """
    Validate condition code at save time (called by serializers).
    Returns a list of human-readable error messages. Empty list = valid.

    Checks:
      1. Not empty
      2. Assigns to 'result'
      3. Compiles through RestrictedPython without SyntaxError
      4. Dry-run with empty data doesn't crash for unexpected reasons
    """
    errors: list[str] = []

    if not code or not code.strip():
        errors.append("El código no puede estar vacío.")
        return errors

    if 'result' not in code:
        errors.append(
            "El código debe asignar 'result' (ej: result = True, "
            "result = data.get('amount', 0) > 1000)."
        )

    try:
        compile_restricted(code, '<condition-validate>', 'exec')
    except SyntaxError as exc:
        errors.append(f"Error de sintaxis en línea {exc.lineno}: {exc.msg}.")
        return errors  # dry-run pointless after syntax failure

    dry_run_error = _dry_run(code)
    if dry_run_error is not None:
        errors.append(f"Error al ejecutar con datos vacíos: {dry_run_error}")

    return errors


def _dry_run(code: str) -> str | None:
    """
    Execute the condition with empty data/request to catch obvious errors.
    Returns an error string if it fails unexpectedly, or None if OK.
    KeyError/TypeError/ValueError/IndexError on empty data are expected and ignored.
    """
    try:
        byte_code = compile_restricted(code, '<condition-dryrun>', 'exec')
        local_vars: dict = {
            'data': {},
            'request': RequestContext(),
            'result': False,
        }
        exec(byte_code, _build_restricted_globals(), local_vars)  # noqa: S102
        return None
    except (KeyError, TypeError, ValueError, IndexError, AttributeError):
        return None
    except Exception as exc:
        return str(exc)
