/**
 * FieldMatrixEditor — field × step rule table.
 *
 * Each cell shows the rule for a (field, step) pair:
 *   V = visible  E = editable  R = required
 *
 * Clicking a cell opens an inline editor with:
 *   - Static boolean flags (default when no condition is set)
 *   - Optional Python condition function per flag (overrides the static flag)
 *
 * Props:
 *   workflowId  — UUID
 *   matrix      — { steps: [], fields: [], matrix: { stepId: { fieldId: rule|null } } }
 *   conditions  — [{ id, name, label }]  — workflow-level Python conditions
 *   readOnly    — bool
 *   onRefresh   — () => void
 */
import { useState } from 'react'
import { Code2 } from 'lucide-react'
import { workflowDefAPI } from '../../services/api'
import { extractError } from '../../utils/errors'

function RuleCell({ rule, onClick, readOnly }) {
  const baseClass = 'w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-colors'

  if (!rule) {
    return (
      <button
        onClick={onClick}
        disabled={readOnly}
        className={`${baseClass} bg-slate-100 dark:bg-slate-700/50 text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-600 ${!readOnly ? 'hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer' : 'cursor-default'}`}
        title="Sin regla configurada"
      >
        —
      </button>
    )
  }

  const hasConds = rule.visibility_condition_id || rule.editable_condition_id || rule.required_condition_id
  return (
    <button
      onClick={onClick}
      disabled={readOnly}
      className={`${baseClass} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 ${!readOnly ? 'hover:border-violet-400 dark:hover:border-violet-500 cursor-pointer' : 'cursor-default'} flex gap-0.5 px-1.5 min-w-max`}
      title={`V:${rule.is_visible ? '✓' : '✗'} E:${rule.is_editable ? '✓' : '✗'} R:${rule.is_required ? '✓' : '✗'}${hasConds ? ' (con condiciones)' : ''}`}
    >
      <span className={rule.is_visible ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}>V</span>
      <span className={rule.is_editable ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'}>E</span>
      <span className={rule.is_required ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'}>R</span>
      {hasConds && <Code2 size={9} className="text-violet-400 ml-0.5" />}
    </button>
  )
}

function ConditionSelect({ label, value, onChange, conditions, disabled }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
        {label}
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        disabled={disabled}
        className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
      >
        <option value="">— Sin condición (usar flag estático) —</option>
        {conditions.map(c => (
          <option key={c.id} value={c.id}>{c.label} ({c.name})</option>
        ))}
      </select>
    </div>
  )
}

function RuleEditor({ rule, fieldId, stepId, workflowId, conditions, onDone }) {
  const isNew = !rule
  const [form, setForm] = useState(rule ?? {
    is_visible: true,
    is_editable: true,
    is_required: false,
    visibility_condition_id: null,
    editable_condition_id: null,
    required_condition_id: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        is_visible: form.is_visible,
        is_editable: form.is_editable,
        is_required: form.is_required,
        visibility_condition_id: form.visibility_condition_id || null,
        editable_condition_id: form.editable_condition_id || null,
        required_condition_id: form.required_condition_id || null,
      }
      if (isNew) {
        await workflowDefAPI.createFieldRule(workflowId, stepId, {
          field_id: fieldId,
          step_id: stepId,
          ...payload,
        })
      } else {
        await workflowDefAPI.updateFieldRule(workflowId, stepId, rule.id, payload)
      }
      onDone()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!rule?.id) return onDone()
    setLoading(true)
    try {
      await workflowDefAPI.deleteFieldRule(workflowId, stepId, rule.id)
      onDone()
    } catch (err) {
      setError(extractError(err))
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Static flags */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Valores por defecto</p>
        <div className="flex gap-4">
          {[
            ['is_visible',  'Visible'],
            ['is_editable', 'Editable'],
            ['is_required', 'Requerido'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={e => set(key, e.target.checked)}
                className="accent-violet-600"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Usados cuando no hay condición Python asignada.
        </p>
      </div>

      {/* Python condition overrides */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Code2 size={13} className="text-violet-500" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Condiciones Python <span className="font-normal">(sobreescriben los flags estáticos)</span>
          </p>
        </div>

        {conditions.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            No hay condiciones definidas. Créalas en la pestaña "Condiciones".
          </p>
        ) : (
          <>
            <ConditionSelect
              label="Condición de visibilidad"
              value={form.visibility_condition_id}
              onChange={v => set('visibility_condition_id', v)}
              conditions={conditions}
            />
            <ConditionSelect
              label="Condición de editable"
              value={form.editable_condition_id}
              onChange={v => set('editable_condition_id', v)}
              conditions={conditions}
            />
            <ConditionSelect
              label="Condición de requerido"
              value={form.required_condition_id}
              onChange={v => set('required_condition_id', v)}
              conditions={conditions}
            />
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : 'Guardar'}
        </button>
        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-600 border border-red-200 dark:border-red-800 rounded-lg disabled:opacity-50 transition-colors"
          >
            Quitar regla
          </button>
        )}
        <button onClick={onDone} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function FieldMatrixEditor({ workflowId, matrix, conditions = [], readOnly, onRefresh }) {
  const [editing, setEditing] = useState(null) // {fieldId, stepId} | null

  if (!matrix) {
    return <div className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Cargando matriz…</div>
  }

  const { steps, fields, matrix: cellMap } = matrix

  if (!steps.length || !fields.length) {
    return (
      <div className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
        Agrega al menos un paso y un campo para configurar la matriz.
      </div>
    )
  }

  const isEditing = (fieldId, stepId) =>
    editing?.fieldId === fieldId && editing?.stepId === stepId

  const handleDone = () => {
    setEditing(null)
    onRefresh()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 p-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 sticky left-0 z-10 min-w-48">
              Campo
            </th>
            {steps.map(step => (
              <th
                key={step.id}
                className="text-center text-xs font-semibold text-slate-700 dark:text-slate-200 p-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-28 whitespace-nowrap"
              >
                {step.name}
                {step.is_initial && <span className="ml-1 text-emerald-500">●</span>}
                {step.is_final && <span className="ml-1 text-amber-500">●</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map(field => (
            <tr key={field.id} className="group">
              <td className="p-3 border-b border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 sticky left-0 z-10">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{field.label}</p>
                  <p className="text-xs font-mono text-slate-400">{field.key}</p>
                </div>
              </td>
              {steps.map(step => {
                const rule = cellMap?.[step.id]?.[field.id] ?? null
                return (
                  <td key={step.id} className="p-2 border-b border-slate-50 dark:border-slate-800 text-center align-top">
                    <div className="flex flex-col items-center gap-1">
                      <RuleCell
                        rule={rule}
                        onClick={() => setEditing({ fieldId: field.id, stepId: step.id })}
                        readOnly={readOnly}
                      />
                      {isEditing(field.id, step.id) && (
                        <div className="absolute z-20 mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-80 text-left">
                          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {field.label} <span className="text-slate-400">en</span> {step.name}
                            </p>
                          </div>
                          <RuleEditor
                            rule={rule}
                            fieldId={field.id}
                            stepId={step.id}
                            workflowId={workflowId}
                            conditions={conditions}
                            onDone={handleDone}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-4 mt-4 text-xs text-slate-400 dark:text-slate-500">
        <span><span className="font-bold text-emerald-500">V</span> = Visible</span>
        <span><span className="font-bold text-blue-500">E</span> = Editable</span>
        <span><span className="font-bold text-red-500">R</span> = Requerido</span>
        <span className="text-violet-400 flex items-center gap-1"><Code2 size={10} /> = Con condición Python</span>
        <span className="text-emerald-500 ml-2">● Inicial</span>
        <span className="text-amber-500">● Final</span>
      </div>
    </div>
  )
}
