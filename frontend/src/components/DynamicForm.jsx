/**
 * DynamicForm — renders a form from a server-side field schema.
 *
 * Schema field shape (from /form-schema/ endpoint):
 *   { key, label, type, options, metadata, required, editable, conditions }
 *
 * Props:
 *   fields      — schema fields array
 *   values      — { field_key: value } current form state
 *   onChange    — (newValues) => void
 *   errors      — { field_key: [error_msg] } validation errors from server
 *   disabled    — bool (overrides all editable flags)
 */
import { useEffect } from 'react'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Checkbox } from './ui/checkbox'

// Evaluate simple NOT_EMPTY-style conditions client-side for reactive forms
function evalCondition(condition, values) {
  if (!condition) return true
  const { type, field, operator, value: expected, rules } = condition
  if (type === 'AND') return (rules ?? []).every(r => evalCondition(r, values))
  if (type === 'OR')  return (rules ?? []).some(r => evalCondition(r, values))
  if (type === 'NOT') return !evalCondition((rules ?? [])[0], values)
  const actual = values[field]
  switch (operator) {
    case 'NOT_EMPTY': return actual !== null && actual !== undefined && actual !== '' && actual !== false
    case 'IS_EMPTY':  return actual === null || actual === undefined || actual === '' || actual === false
    case 'EQ':        return actual == expected
    case 'NEQ':       return actual != expected
    case 'IN':        return Array.isArray(expected) && expected.includes(actual)
    default:          return true
  }
}

// ── Field renderers ────────────────────────────────────────────────────────────

function TextField({ field, value, onChange, disabled }) {
  return (
    <Input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={field.label}
      className="w-full"
    />
  )
}

function TextareaField({ field, value, onChange, disabled }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={field.label}
      rows={3}
      className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}

function NumberField({ field, value, onChange, disabled }) {
  const { min, max } = field.metadata ?? {}
  return (
    <Input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      disabled={disabled}
      placeholder={field.label}
      min={min}
      max={max}
      className="w-full"
    />
  )
}

function CurrencyField({ field, value, onChange, disabled }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <Input
        type="number"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        disabled={disabled}
        placeholder="0.00"
        step="0.01"
        min={0}
        className="w-full pl-7"
      />
    </div>
  )
}

function DateField({ field, value, onChange, disabled }) {
  return (
    <Input
      type={field.type === 'datetime' ? 'datetime-local' : 'date'}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full"
    />
  )
}

function BooleanField({ field, value, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-2.5 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <Checkbox
        checked={!!value}
        onCheckedChange={checked => onChange(checked)}
        disabled={disabled}
      />
      <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
    </label>
  )
}

function SelectField({ field, value, onChange, disabled }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">— Seleccionar —</option>
      {(field.options ?? []).map(opt => {
        const v = typeof opt === 'object' ? opt.value : opt
        const l = typeof opt === 'object' ? opt.label : opt
        return <option key={v} value={v}>{l}</option>
      })}
    </select>
  )
}

function MultiSelectField({ field, value = [], onChange, disabled }) {
  const selected = Array.isArray(value) ? value : []
  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter(v => v !== opt) : [...selected, opt]
    onChange(next)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {(field.options ?? []).map(opt => {
        const v = typeof opt === 'object' ? opt.value : opt
        const l = typeof opt === 'object' ? opt.label : opt
        const active = selected.includes(v)
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => toggle(v)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-violet-400'
            }`}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

function EmailField({ field, value, onChange, disabled }) {
  return (
    <Input type="email" value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={field.label} className="w-full" />
  )
}

function PhoneField({ field, value, onChange, disabled }) {
  return (
    <Input type="tel" value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={field.label} className="w-full" />
  )
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const RENDERERS = {
  text:        TextField,
  textarea:    TextareaField,
  number:      NumberField,
  currency:    CurrencyField,
  date:        DateField,
  datetime:    DateField,
  boolean:     BooleanField,
  select:      SelectField,
  multiselect: MultiSelectField,
  email:       EmailField,
  phone:       PhoneField,
}

function FieldInput({ field, value, onChange, disabled }) {
  const Renderer = RENDERERS[field.type] ?? TextField
  return <Renderer field={field} value={value} onChange={onChange} disabled={disabled} />
}

// ── Main component ────────────────────────────────────────────────────────────

const FULL_WIDTH_TYPES = new Set(['textarea', 'multiselect', 'boolean'])

export default function DynamicForm({ fields = [], values = {}, onChange, errors = {}, disabled = false }) {
  const handleChange = (key, value) => onChange({ ...values, [key]: value })

  if (fields.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
      {fields.map(field => {
        const cond = field.conditions ?? {}
        const isVisible  = cond.visible  ? evalCondition(cond.visible,  values) : true
        const isEditable = cond.editable ? evalCondition(cond.editable, values) : field.editable
        const isRequired = cond.required ? evalCondition(cond.required, values) : field.required

        if (!isVisible) return null

        const fieldErrors = errors[field.key] ?? []
        const isDisabled  = disabled || !isEditable
        const isFullWidth = FULL_WIDTH_TYPES.has(field.type)

        return (
          <div
            key={field.key}
            className={`flex flex-col gap-1.5 ${isFullWidth ? 'col-span-2' : 'col-span-1'}`}
          >
            {field.type !== 'boolean' && (
              <Label htmlFor={field.key} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {field.label}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
            )}

            <FieldInput
              field={{ ...field, required: isRequired }}
              value={values[field.key] ?? (field.type === 'multiselect' ? [] : '')}
              onChange={val => handleChange(field.key, val)}
              disabled={isDisabled}
            />

            {fieldErrors.length > 0 && (
              <p className="text-xs text-red-500 dark:text-red-400">{fieldErrors[0]}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
