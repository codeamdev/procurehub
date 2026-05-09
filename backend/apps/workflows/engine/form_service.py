"""
FormService — generates the form schema for a given Step.

Schema resolution for each field attribute:
  1. Static flag (is_visible / is_editable / is_required)
  2. Python condition function override (visibility_condition / editable_condition /
     required_condition) — evaluated against current request data using the sandbox.

The rendered schema is consumed by the frontend to render the form.
"""
import logging
from ..models import Step
from .python_evaluator import evaluate_python_condition

logger = logging.getLogger(__name__)


class FormService:
    def get_form_schema(self, step: Step, current_data: dict | None = None) -> dict:
        """
        Returns the resolved form schema for a step.

        current_data: {field_key: value} — used to evaluate Python conditions.
                      If None, only static flags are used.
        """
        if current_data is None:
            current_data = {}

        schema_fields = []

        rules = (
            step.field_rules
            .select_related('field', 'visibility_condition', 'editable_condition', 'required_condition')
            .order_by('field__order')
        )

        for rule in rules:
            field = rule.field

            # ── Visibility ────────────────────────────────────────────────────
            if rule.visibility_condition_id:
                is_visible = evaluate_python_condition(
                    rule.visibility_condition.code, current_data
                )
            else:
                is_visible = rule.is_visible

            if not is_visible:
                continue

            # ── Editability ───────────────────────────────────────────────────
            if rule.editable_condition_id:
                is_editable = evaluate_python_condition(
                    rule.editable_condition.code, current_data
                )
            else:
                is_editable = rule.is_editable

            # ── Required ──────────────────────────────────────────────────────
            if rule.required_condition_id:
                is_required = evaluate_python_condition(
                    rule.required_condition.code, current_data
                )
            else:
                is_required = rule.is_required

            schema_fields.append({
                'id': str(field.id),
                'key': field.key,
                'label': field.label,
                'type': field.field_type,
                'options': field.options,
                'metadata': field.metadata,
                'required': is_required,
                'editable': is_editable,
            })

        return {
            'step_id': str(step.id),
            'step_name': step.name,
            'is_final': step.is_final,
            'fields': schema_fields,
        }

    def validate_required_fields(
        self,
        step: Step,
        field_data: dict,
    ) -> dict[str, list[str]]:
        """
        Returns {field_key: [error_messages]} for every required field that is
        missing or blank in field_data.
        """
        errors: dict[str, list[str]] = {}

        rules = step.field_rules.select_related(
            'field', 'required_condition'
        ).all()

        for rule in rules:
            if rule.required_condition_id:
                is_required = evaluate_python_condition(
                    rule.required_condition.code, field_data
                )
            else:
                is_required = rule.is_required

            if not is_required:
                continue

            value = field_data.get(rule.field.key)
            is_blank = value is None or value == '' or value == [] or value == {}
            if is_blank:
                errors[rule.field.key] = [f"'{rule.field.label}' is required."]

        return errors
