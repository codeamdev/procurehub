/**
 * StepManager — CRUD for workflow steps.
 * Props:
 *   workflowId    — UUID
 *   steps         — [{id, name, order, is_initial, is_final, allowed_roles_to_view/edit/act}]
 *   readOnly      — bool (workflow is not DRAFT)
 *   onRefresh     — () => void
 */
import { useState } from 'react'
import { Plus, Pencil, Trash2, GripVertical, Flag, FlagOff, CheckCircle2 } from 'lucide-react'
import { workflowDefAPI } from '../../services/api'
import { extractError } from '../../utils/errors'

const ROLES = ['admin', 'buyer', 'supplier']

function RoleCheckboxes({ label, value = [], onChange, disabled }) {
  const toggle = (role) => {
    const next = value.includes(role) ? value.filter(r => r !== role) : [...value, role]
    onChange(next)
  }
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <div className="flex gap-2">
        {ROLES.map(role => (
          <label key={role} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(role)}
              onChange={() => toggle(role)}
              disabled={disabled}
              className="accent-violet-600"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">{role}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function StepForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial ?? {
    name: '',
    order: 0,
    is_initial: false,
    is_final: false,
    allowed_roles_to_view: ['admin', 'buyer'],
    allowed_roles_to_edit: ['admin', 'buyer'],
    allowed_roles_to_act: ['admin', 'buyer'],
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Nombre del paso *
          </label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ej: Revisión Legal"
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Orden
          </label>
          <input
            type="number"
            value={form.order}
            onChange={e => set('order', parseInt(e.target.value, 10))}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_initial} onChange={e => set('is_initial', e.target.checked)} className="accent-violet-600" />
          <span className="text-xs text-slate-600 dark:text-slate-300">Paso inicial</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_final} onChange={e => set('is_final', e.target.checked)} className="accent-violet-600" />
          <span className="text-xs text-slate-600 dark:text-slate-300">Paso final</span>
        </label>
      </div>

      <RoleCheckboxes label="Puede ver" value={form.allowed_roles_to_view} onChange={v => set('allowed_roles_to_view', v)} />
      <RoleCheckboxes label="Puede editar" value={form.allowed_roles_to_edit} onChange={v => set('allowed_roles_to_edit', v)} />
      <RoleCheckboxes label="Puede actuar" value={form.allowed_roles_to_act} onChange={v => set('allowed_roles_to_act', v)} />

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={loading || !form.name.trim()}
          className="px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando…' : 'Guardar paso'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function StepManager({ workflowId, steps = [], readOnly, onRefresh }) {
  const [editing, setEditing] = useState(null) // null | 'new' | step object
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async (form) => {
    setLoading(true)
    setError(null)
    try {
      if (editing === 'new') {
        await workflowDefAPI.createStep(workflowId, form)
      } else {
        await workflowDefAPI.updateStep(workflowId, editing.id, form)
      }
      setEditing(null)
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (step) => {
    if (!confirm(`¿Eliminar paso "${step.name}"?`)) return
    setError(null)
    try {
      await workflowDefAPI.deleteStep(workflowId, step.id)
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    }
  }

  const sorted = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Step list */}
      <div className="space-y-2">
        {sorted.map((step, idx) => (
          <div key={step.id}>
            {editing?.id === step.id ? (
              <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/30 dark:bg-violet-900/10">
                <StepForm
                  initial={step}
                  onSubmit={handleSave}
                  onCancel={() => setEditing(null)}
                  loading={loading}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group">
                <GripVertical size={14} className="text-slate-300 dark:text-slate-600 shrink-0" />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-slate-400 w-5 text-center">{step.order}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">{step.name}</span>
                    {step.is_initial && (
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Inicial</span>
                    )}
                    {step.is_final && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Final</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Ver: {step.allowed_roles_to_view?.join(', ') || '—'} · Editar: {step.allowed_roles_to_edit?.join(', ') || '—'}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setEditing(step)}
                      className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(step)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
            No hay pasos configurados.
          </div>
        )}
      </div>

      {/* Add new step */}
      {!readOnly && editing !== 'new' && (
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 border border-dashed border-violet-300 dark:border-violet-700 rounded-xl px-4 py-3 w-full justify-center transition-colors"
        >
          <Plus size={16} /> Agregar paso
        </button>
      )}

      {editing === 'new' && (
        <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/30 dark:bg-violet-900/10">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Nuevo paso</p>
          <StepForm
            initial={{ name: '', order: sorted.length, is_initial: false, is_final: false, allowed_roles_to_view: ['admin', 'buyer'], allowed_roles_to_edit: ['admin', 'buyer'], allowed_roles_to_act: ['admin', 'buyer'] }}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            loading={loading}
          />
        </div>
      )}
    </div>
  )
}
