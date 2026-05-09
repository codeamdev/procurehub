/**
 * BranchManager — CRUD for step branches.
 * Props:
 *   workflowId   — UUID
 *   step         — {id, name}
 *   steps        — [{id, name}] — all steps (for target selection)
 *   branches     — [{id, label, style, order, target_step_id, terminal_status,
 *                    condition, validations, effects, condition_routes}]
 *   conditions   — [{id, name, label}] — workflow-level Python conditions
 *   fields       — [{key, label}] — for condition builder
 *   readOnly     — bool
 *   onRefresh    — () => void
 */
import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowRight, GitMerge } from 'lucide-react'
import { workflowDefAPI } from '../../services/api'
import { extractError } from '../../utils/errors'
import ConditionBuilder from './ConditionBuilder'

const STYLES = [
  { value: 'primary',   label: 'Primario',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'secondary', label: 'Secundario',  cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  { value: 'danger',    label: 'Peligro',     cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'warning',   label: 'Advertencia', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
]
const STYLE_MAP = Object.fromEntries(STYLES.map(s => [s.value, s]))

// ── Routes tab (BranchConditionRoute CRUD) ────────────────────────────────────

function RoutesTab({ branchId, routes, conditions, steps, workflowId, stepId, onRefresh, readOnly }) {
  const [adding, setAdding] = useState(false)
  const [newRoute, setNewRoute] = useState({ condition_id: '', target_step_id: '', terminal_status: '', order: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const setNR = (k, v) => setNewRoute(r => ({ ...r, [k]: v }))

  const destinationLabel = (route) => {
    if (route.target_step_name) return route.target_step_name
    if (route.terminal_status) return `[Finalizar: ${route.terminal_status}]`
    return '[Quedarse en paso actual]'
  }

  const conditionLabel = (route) =>
    route.condition_label ? `${route.condition_label} (${route.condition_name})` : 'Por defecto (siempre)'

  const handleAddRoute = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        order: parseInt(newRoute.order, 10) || 0,
        condition_id: newRoute.condition_id || null,
        target_step_id: newRoute.target_step_id || null,
        terminal_status: newRoute.terminal_status || null,
      }
      await workflowDefAPI.createRoute(workflowId, stepId, branchId, payload)
      setAdding(false)
      setNewRoute({ condition_id: '', target_step_id: '', terminal_status: '', order: 0 })
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (routeId) => {
    if (!confirm('¿Eliminar esta ruta?')) return
    try {
      await workflowDefAPI.deleteRoute(workflowId, stepId, branchId, routeId)
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    }
  }

  const isTerminalNew = !newRoute.target_step_id

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
        <GitMerge size={14} className="shrink-0 mt-0.5" />
        <span>
          Las rutas se evalúan <strong>en orden</strong>. La primera cuya condición devuelva <code className="font-mono">True</code> determina el destino.
          Si ninguna coincide, la solicitud <strong>se queda en el paso actual</strong>.
          Si no hay rutas, se usa el destino directo del branch.
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {routes.length > 0 && (
        <div className="space-y-2">
          {[...routes].sort((a, b) => a.order - b.order).map((route, idx) => (
            <div
              key={route.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs"
            >
              <span className="w-5 h-5 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-300 font-semibold shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {conditionLabel(route)}
                  </span>
                  <ArrowRight size={11} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">{destinationLabel(route)}</span>
                </div>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(route.id)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {routes.length === 0 && !adding && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">
          No hay rutas configuradas — se usa el destino directo del branch.
        </p>
      )}

      {!readOnly && adding && (
        <div className="border border-violet-200 dark:border-violet-700 rounded-lg p-3 space-y-3 bg-violet-50/30 dark:bg-violet-900/10">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Nueva ruta</p>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Condición</label>
            <select
              value={newRoute.condition_id}
              onChange={e => setNR('condition_id', e.target.value)}
              className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Por defecto / siempre (else)</option>
              {conditions.map(c => (
                <option key={c.id} value={c.id}>{c.label} ({c.name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Destino</label>
            <select
              value={newRoute.target_step_id}
              onChange={e => { setNR('target_step_id', e.target.value); if (e.target.value) setNR('terminal_status', '') }}
              className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— Quedarse en paso actual / Finalizar —</option>
              {steps.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {isTerminalNew && (
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                Estado final (opcional — vacío = quedarse en paso)
              </label>
              <select
                value={newRoute.terminal_status}
                onChange={e => setNR('terminal_status', e.target.value)}
                className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">— Quedarse en paso actual —</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Orden</label>
            <input
              type="number"
              value={newRoute.order}
              onChange={e => setNR('order', e.target.value)}
              className="w-24 text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddRoute}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? 'Guardando…' : 'Agregar ruta'}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!readOnly && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 border border-dashed border-violet-300 dark:border-violet-700 rounded-lg px-3 py-2 w-full justify-center transition-colors"
        >
          <Plus size={13} /> Agregar ruta condicional
        </button>
      )}
    </div>
  )
}

// ── BranchForm ────────────────────────────────────────────────────────────────

function BranchForm({
  initial, steps, currentStepId, fields, conditions,
  workflowId, onSubmit, onCancel, loading, onRefresh
}) {
  const [form, setForm] = useState(initial ?? {
    label: '', style: 'primary', order: 0,
    target_step_id: '', terminal_status: '',
    condition: null, validations: null, effects: [],
  })
  const [tab, setTab] = useState('basic')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isTerminal = !form.target_step_id

  const availableSteps = steps.filter(s => s.id !== currentStepId)

  const TABS = [
    ['basic',       'Básico'],
    ['condition',   'Condición de visibilidad'],
    ['validations', 'Validaciones'],
    ...(initial?.id ? [['routes', 'Rutas condicionales']] : []),
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-100 dark:border-slate-700 flex-wrap">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-xs px-3 py-2 font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {label}
            {key === 'routes' && initial?.condition_routes?.length > 0 && (
              <span className="ml-1.5 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1.5 rounded-full font-semibold">
                {initial.condition_routes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'basic' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Etiqueta del botón *</label>
              <input
                value={form.label}
                onChange={e => set('label', e.target.value)}
                placeholder="Aprobar"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Estilo</label>
              <select
                value={form.style}
                onChange={e => set('style', e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
              Paso destino
              {initial?.condition_routes?.length > 0 && (
                <span className="ml-2 text-violet-500 dark:text-violet-400 font-normal">
                  (las rutas condicionales tienen prioridad sobre este valor)
                </span>
              )}
            </label>
            <select
              value={form.target_step_id}
              onChange={e => { set('target_step_id', e.target.value); if (e.target.value) set('terminal_status', '') }}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— Finalizar solicitud / Usar rutas —</option>
              {availableSteps.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {isTerminal && (
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                Estado final (opcional si usas rutas)
              </label>
              <select
                value={form.terminal_status}
                onChange={e => set('terminal_status', e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">— Sin estado terminal (usar rutas) —</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Orden</label>
            <input
              type="number"
              value={form.order}
              onChange={e => set('order', parseInt(e.target.value, 10))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
      )}

      {tab === 'condition' && (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Cuándo <strong>mostrar</strong> este botón. Si no hay condición, siempre se muestra.
          </p>
          <ConditionBuilder
            condition={form.condition}
            onChange={v => set('condition', v)}
            fields={fields}
          />
        </div>
      )}

      {tab === 'validations' && (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Qué debe ser verdadero para poder <strong>ejecutar</strong> esta acción.
          </p>
          <ConditionBuilder
            condition={form.validations}
            onChange={v => set('validations', v)}
            fields={fields}
          />
        </div>
      )}

      {tab === 'routes' && initial?.id && (
        <RoutesTab
          branchId={initial.id}
          routes={initial.condition_routes ?? []}
          conditions={conditions}
          steps={availableSteps}
          workflowId={workflowId}
          stepId={currentStepId}
          onRefresh={onRefresh}
          readOnly={false}
        />
      )}

      {tab !== 'routes' && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onSubmit(form)}
            disabled={loading || !form.label.trim()}
            className="px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? 'Guardando…' : 'Guardar branch'}
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// ── BranchManager ─────────────────────────────────────────────────────────────

export default function BranchManager({
  workflowId, step, steps = [], branches = [],
  conditions = [], fields = [], readOnly, onRefresh
}) {
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async (form) => {
    setLoading(true)
    setError(null)
    try {
      if (editing === 'new') {
        await workflowDefAPI.createBranch(workflowId, step.id, form)
      } else {
        await workflowDefAPI.updateBranch(workflowId, step.id, editing.id, form)
      }
      setEditing(null)
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (branch) => {
    if (!confirm(`¿Eliminar branch "${branch.label}"?`)) return
    setError(null)
    try {
      await workflowDefAPI.deleteBranch(workflowId, step.id, branch.id)
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    }
  }

  const sorted = [...branches].sort((a, b) => a.order - b.order)
  const stepMap = Object.fromEntries(steps.map(s => [s.id, s]))

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {sorted.map(branch => (
          <div key={branch.id}>
            {editing?.id === branch.id ? (
              <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/30 dark:bg-violet-900/10">
                <BranchForm
                  initial={{ ...branch, target_step_id: branch.target_step_id ?? '' }}
                  steps={steps}
                  currentStepId={step.id}
                  fields={fields}
                  conditions={conditions}
                  workflowId={workflowId}
                  onSubmit={handleSave}
                  onCancel={() => setEditing(null)}
                  loading={loading}
                  onRefresh={() => { setEditing(null); onRefresh() }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STYLE_MAP[branch.style]?.cls ?? ''}`}>
                  {branch.label}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                  <ArrowRight size={12} />
                  {branch.condition_routes?.length > 0 ? (
                    <span className="text-violet-600 dark:text-violet-400 font-medium">
                      {branch.condition_routes.length} ruta{branch.condition_routes.length !== 1 ? 's' : ''} condicional{branch.condition_routes.length !== 1 ? 'es' : ''}
                    </span>
                  ) : branch.target_step_id ? (
                    <span className="text-slate-600 dark:text-slate-300">{stepMap[branch.target_step_id]?.name ?? 'Paso desconocido'}</span>
                  ) : (
                    <span className="capitalize">[{branch.terminal_status || 'fin'}]</span>
                  )}
                </div>
                {(branch.condition || branch.validations) && (
                  <span className="text-xs text-violet-500 dark:text-violet-400">⬡ condicional</span>
                )}
                {!readOnly && (
                  <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(branch)} className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(branch)} className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
            No hay branches configurados para este paso.
          </div>
        )}
      </div>

      {!readOnly && editing !== 'new' && (
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 border border-dashed border-violet-300 dark:border-violet-700 rounded-xl px-4 py-3 w-full justify-center transition-colors"
        >
          <Plus size={16} /> Agregar branch
        </button>
      )}

      {editing === 'new' && (
        <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/30 dark:bg-violet-900/10">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Nuevo branch</p>
          <BranchForm
            steps={steps}
            currentStepId={step.id}
            fields={fields}
            conditions={conditions}
            workflowId={workflowId}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            loading={loading}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  )
}
