"""
RuleEvaluator — interprets JSON condition trees against a data context.

Condition schema:
  Composite: {"type": "AND"|"OR"|"NOT", "rules": [...]}
  Leaf:      {"type": "RULE", "field": "<key>", "operator": "<OP>", "value": <any>}

Operators:
  EQ, NEQ          — equality
  GT, LT, GTE, LTE — numeric comparison
  IN, NOT_IN       — membership
  NOT_EMPTY        — value is present and non-blank
  IS_EMPTY         — value is absent or blank
  REGEX            — value matches a pattern string
  CONTAINS         — string/list contains value
  STARTS_WITH      — string starts with value
"""
import re
import logging

logger = logging.getLogger(__name__)


class RuleEvaluator:
    """
    Stateless evaluator. Thread-safe — create one instance per process and reuse.
    Returns True when condition is None (open by default).
    """

    def evaluate(self, condition: dict | None, data: dict) -> bool:
        if not condition:
            return True
        try:
            return self._eval(condition, data)
        except Exception:
            logger.exception('RuleEvaluator error on condition %s', condition)
            return False  # fail-safe: condition error = fail closed

    def _eval(self, condition: dict, data: dict) -> bool:
        type_ = condition.get('type', 'RULE')

        if type_ == 'AND':
            return all(self._eval(r, data) for r in condition.get('rules', []))

        if type_ == 'OR':
            return any(self._eval(r, data) for r in condition.get('rules', []))

        if type_ == 'NOT':
            rules = condition.get('rules', [])
            if not rules:
                return True
            return not self._eval(rules[0], data)

        if type_ == 'RULE':
            return self._eval_rule(condition, data)

        logger.warning('Unknown condition type: %s', type_)
        return True  # unknown type = pass

    def _eval_rule(self, rule: dict, data: dict) -> bool:
        field_key = rule.get('field')
        operator = rule.get('operator', 'NOT_EMPTY')
        expected = rule.get('value')
        actual = data.get(field_key) if field_key else None

        match operator:
            case 'EQ':
                return actual == expected
            case 'NEQ':
                return actual != expected
            case 'GT':
                return self._numeric(actual) > self._numeric(expected)
            case 'LT':
                return self._numeric(actual) < self._numeric(expected)
            case 'GTE':
                return self._numeric(actual) >= self._numeric(expected)
            case 'LTE':
                return self._numeric(actual) <= self._numeric(expected)
            case 'IN':
                return actual in (expected or [])
            case 'NOT_IN':
                return actual not in (expected or [])
            case 'NOT_EMPTY':
                return actual is not None and actual != '' and actual != [] and actual != {}
            case 'IS_EMPTY':
                return actual is None or actual == '' or actual == [] or actual == {}
            case 'REGEX':
                if not isinstance(actual, str) or not isinstance(expected, str):
                    return False
                return bool(re.search(expected, actual))
            case 'CONTAINS':
                if isinstance(actual, str):
                    return isinstance(expected, str) and expected in actual
                if isinstance(actual, list):
                    return expected in actual
                return False
            case 'STARTS_WITH':
                return isinstance(actual, str) and isinstance(expected, str) and actual.startswith(expected)
            case _:
                logger.warning('Unknown operator: %s', operator)
                return True

    @staticmethod
    def _numeric(value) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0
