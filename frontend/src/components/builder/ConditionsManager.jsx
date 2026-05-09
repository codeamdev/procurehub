/**
 * ConditionsManager — CRUD for Python condition functions scoped to a workflow.
 *
 * Each condition is a Python code block that assigns `result = True/False`.
 * Available variables inside the code: data (dict), request.
 *
 * Props:
 *   workflowId — UUID
 *   readOnly   — bool
 *   onRefresh  — () => void  (called after create/update/delete)
 */
import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Code2, ChevronDown, ChevronUp } from 'lucide-react'
import { workflowDefAPI } from '../../services/api'
import useApi from '../../hooks/useApi'
import { extractError } from '../../utils/errors'

const EXAMPLE_CODE = `# Variables disponibles:
#   data    — dict con los valores de los campos de la solicitud
#   request — instancia del modelo Request (puede ser None en pruebas)
#
# Debes asignar: result = True o result = False

monto = data.get('monto', 0)
result = isinstance(monto, (int, float)) and monto > 5000`

function ConditionForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(
    initial ?? { name: '', label: '', description: '', code: EXAMPLE_CODE }
  )
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Nombre (identificador) *
          </label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="monto_aprobado"
            disabled={!!initial}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 font-mono"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Minúsculas, guión_bajo. Inmutable después de crear.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Etiqueta *
          </label>
          <input
            value={form.label}
            onChange={e => set('label', e.target.value)}
            placeholder="¿El monto está aprobado?"
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
          Descripción
        </label>
        <input
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Verifica si el monto de la solicitud supera el umbral de aprobación."
          className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
          Código Python *
        </label>
        <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
            <Code2 size={13} className="text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">condition.py</span>
          </div>
          <textarea
            value={form.code}
            onChange={e => set('code', e.target.value)}
            rows={10}
            spellCheck={false}
            className="w-full text-xs font-mono bg-slate-900 text-slate-100 px-4 py-3 focus:outline-none resize-none leading-relaxed"
          />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          El código debe asignar <code className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">result = True</code> o{' '}
          <code className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">result = False</code>.
          No uses imports — están bloqueados por seguridad.
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={() => onSubmit(form)}
          disabled={loading || !form.name.trim() || !form.label.trim() || !form.code.trim()}
          className="px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando…' : 'Guardar condición'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function ConditionRow({ condition, readOnly, onEdit, onDelete, expanded, onToggle }) {
  return (
    <div className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        onClick={onToggle}
      >
        <Code2 size={15} className="text-violet-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-white font-mono">
              {condition.name}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{condition.label}</span>
          </div>
          {condition.description && (
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {condition.description}
            </p>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={onEdit}
              className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
        <span className="text-slate-400 dark:text-slate-500 shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          <pre className="text-xs font-mono bg-slate-900 text-slate-100 px-4 py-3 leading-relaxed overflow-auto max-h-48">
            {condition.code}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function ConditionsManager({ workflowId, readOnly }) {
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  const fetchConditions = useCallback(
    () => workflowDefAPI.listConditions(workflowId),
    [workflowId]
  )
  const { data: conditionsData, refetch } = useApi(fetchConditions, [workflowId])
  const conditions = conditionsData ?? []

  const handleSave = async (form) => {
    setLoading(true)
    setError(null)
    try {
      if (editing === 'new') {
        await workflowDefAPI.createCondition(workflowId, form)
      } else {
        await workflowDefAPI.updateCondition(workflowId, editing.id, {
          label: form.label,
          description: form.description,
          code: form.code,
        })
      }
      setEditing(null)
      refetch()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (cond) => {
    if (!confirm(`¿Eliminar la condición "${cond.name}"? Los branches que la referencian quedarán sin condición.`)) return
    setError(null)
    try {
      await workflowDefAPI.deleteCondition(workflowId, cond.id)
      refetch()
    } catch (err) {
      setError(extractError(err))
    }
  }

  const toggleExpanded = (id) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex items-start gap-3 px-4 py-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl text-sm text-violet-700 dark:text-violet-400">
        <Code2 size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Condiciones Python</p>
          <p className="text-xs leading-relaxed">
            Define funciones reutilizables que reciben <code className="font-mono">data</code> (campos de la solicitud) y devuelven{' '}
            <code className="font-mono">result = True/False</code>. Se usan en:
          </p>
          <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside">
            <li><strong>Matriz de campos</strong> — controlan si un campo es visible, editable o requerido en cada paso.</li>
            <li><strong>Rutas en branches</strong> — determinan a qué paso avanza el workflow según los datos.</li>
          </ul>
        </div>
      </div>

      <div className="space-y-2">
        {conditions.map(cond => (
          editing?.id === cond.id ? (
            <div key={cond.id} className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/30 dark:bg-violet-900/10">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Editar: <span className="font-mono">{cond.name}</span>
              </p>
              <ConditionForm
                initial={{ ...cond }}
                onSubmit={handleSave}
                onCancel={() => setEditing(null)}
                loading={loading}
              />
            </div>
          ) : (
            <ConditionRow
              key={cond.id}
              condition={cond}
              readOnly={readOnly}
              onEdit={() => setEditing(cond)}
              onDelete={() => handleDelete(cond)}
              expanded={!!expanded[cond.id]}
              onToggle={() => toggleExpanded(cond.id)}
            />
          )
        ))}

        {conditions.length === 0 && editing !== 'new' && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
            No hay condiciones definidas para este workflow.
          </div>
        )}
      </div>

      {!readOnly && editing === 'new' && (
        <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/30 dark:bg-violet-900/10">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Nueva condición</p>
          <ConditionForm
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            loading={loading}
          />
        </div>
      )}

      {!readOnly && editing !== 'new' && (
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 border border-dashed border-violet-300 dark:border-violet-700 rounded-xl px-4 py-3 w-full justify-center transition-colors"
        >
          <Plus size={16} /> Agregar condición
        </button>
      )}
    </div>
  )
}
