/**
 * WorkflowWizard — drives a Request through its workflow.
 *
 * Uses the Phase 3 engine endpoints:
 *   GET  /requests/{id}/form-schema/        → form schema for current step
 *   GET  /requests/{id}/available-branches/ → visible branch buttons
 *   POST /requests/{id}/transition/         → execute a branch
 *   GET  /requests/{id}/history/            → audit trail
 *
 * Props:
 *   requestId   — UUID of the Request
 *   onDone      — optional callback when request completes/cancels
 */
import { useState, useEffect, useCallback } from 'react'
import {
  GitBranch, CheckCircle2, XCircle, AlertCircle,
  History, RefreshCw, ChevronDown, ChevronUp, Settings
} from 'lucide-react'
import { workflowAPI } from '../services/api'
import DynamicForm from './DynamicForm'
import { extractError } from '../utils/errors'

const STATUS_CLASSES = {
  active:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

const BRANCH_STYLE_CLASSES = {
  primary:   'bg-violet-600 hover:bg-violet-700 text-white',
  secondary: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600',
  danger:    'bg-red-500 hover:bg-red-600 text-white',
  warning:   'bg-amber-500 hover:bg-amber-600 text-white',
}

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepProgress({ steps = [], currentStepId }) {
  if (steps.length === 0) return null
  const sorted = [...steps].sort((a, b) => a.order - b.order)
  const currentIdx = sorted.findIndex(s => s.id === currentStepId)

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {sorted.map((step, idx) => {
        const isDone    = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isLast    = idx === sorted.length - 1
        return (
          <div key={step.id} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isDone    ? 'bg-emerald-500 text-white' :
                isCurrent ? 'bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-900/30' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                {isDone ? '✓' : idx + 1}
              </div>
              <span className={`text-xs font-medium max-w-20 text-center leading-tight ${
                isCurrent ? 'text-violet-600 dark:text-violet-400' :
                isDone    ? 'text-slate-500 dark:text-slate-400' :
                            'text-slate-300 dark:text-slate-600'
              }`}>
                {step.name}
              </span>
            </div>
            {!isLast && (
              <div className={`h-0.5 w-8 mx-1 mt-[-12px] transition-colors ${isDone ? 'bg-emerald-400' : 'bg-slate-100 dark:bg-slate-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── History panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ requestId }) {
  const [entries, setEntries] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    workflowAPI.history(requestId)
      .then(({ data }) => setEntries(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [requestId])

  if (loading) return <p className="text-xs text-slate-400 dark:text-slate-500 animate-pulse">Cargando historial…</p>
  if (!entries?.length) return <p className="text-xs text-slate-400 dark:text-slate-500">Sin historial disponible.</p>

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {[...entries].reverse().map(entry => (
        <div key={entry.id} className="flex items-start gap-3 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-slate-600 dark:text-slate-300">
              <span className="font-medium">{entry.from_step_name ?? '—'}</span>
              {' → '}
              <span className="font-medium">{entry.to_step_name ?? '[fin]'}</span>
              {entry.branch_label && <span className="text-slate-400 dark:text-slate-500"> vía «{entry.branch_label}»</span>}
            </p>
            <p className="text-slate-400 dark:text-slate-500">
              {entry.executed_by_email}
              {' · '}
              {new Date(entry.executed_at).toLocaleString()}
            </p>
            {entry.notes && <p className="text-slate-400 dark:text-slate-500 italic">{entry.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkflowWizard({ requestId, onDone }) {
  const [request, setRequest]     = useState(null)
  const [schema, setSchema]       = useState(null)
  const [branches, setBranches]   = useState([])
  const [permissions, setPermissions] = useState({})
  const [formData, setFormData]   = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(null)
  const [error, setError]         = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const loadRequest = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [reqRes, schemaRes, branchRes] = await Promise.all([
        workflowAPI.getRequest(requestId),
        workflowAPI.formSchema(requestId),
        workflowAPI.availableBranches(requestId),
      ])
      const req = reqRes.data
      setRequest(req)
      setPermissions(req.permissions ?? {})
      setSchema(schemaRes.data)
      setBranches(Array.isArray(branchRes.data) ? branchRes.data : branchRes.data?.results ?? [])
      // Pre-fill form with existing request data
      const existingData = {}
      for (const fd of req.field_data ?? []) {
        existingData[fd.field_key] = fd.value
      }
      setFormData(existingData)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => { loadRequest() }, [loadRequest])

  const handleTransition = async (branch) => {
    setSubmitting(branch.id)
    setFieldErrors({})
    setError(null)
    try {
      const { data } = await workflowAPI.transition(requestId, {
        branch_id: branch.id,
        field_data: formData,
        notes: '',
      })
      setRequest(data)
      setPermissions(data.permissions ?? {})
      setFormData({})
      if (data.status !== 'active') {
        onDone?.(data)
      } else {
        // Reload schema and branches for the new step
        const [schemaRes, branchRes] = await Promise.all([
          workflowAPI.formSchema(requestId),
          workflowAPI.availableBranches(requestId),
        ])
        setSchema(schemaRes.data)
        setBranches(Array.isArray(branchRes.data) ? branchRes.data : branchRes.data?.results ?? [])
        const existingData = {}
        for (const fd of data.field_data ?? []) {
          existingData[fd.field_key] = fd.value
        }
        setFormData(existingData)
      }
    } catch (err) {
      const errData = err.response?.data
      if (errData?.errors) {
        setFieldErrors(errData.errors)
        setError('Corrige los campos marcados.')
      } else {
        setError(extractError(err))
      }
    } finally {
      setSubmitting(null)
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 text-center text-slate-400 dark:text-slate-500 text-sm animate-pulse">
        Cargando solicitud…
      </div>
    )
  }

  if (!request) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-100 dark:border-red-900/30 p-8 text-center text-red-500 text-sm">
        {error || 'No se pudo cargar la solicitud.'}
      </div>
    )
  }

  const isActive    = request.status === 'active'
  const statusClass = STATUS_CLASSES[request.status] ?? STATUS_CLASSES.active
  const canEdit = permissions?.can_edit ?? true
  const canAct  = permissions?.can_act ?? true
  const wfDef   = request.workflow_definition ?? {}
  const steps   = request.workflow_steps ?? []

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
            <GitBranch size={17} className="text-violet-500 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800 dark:text-white leading-tight">
              {request.title || wfDef.name}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {wfDef.name} v{wfDef.version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusClass}`}>
            {request.status === 'active' ? 'En progreso' : request.status}
          </span>
          <button
            onClick={loadRequest}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Step progress ────────────────────────────────────────────────────── */}
        {steps.length > 0 && (
          <StepProgress steps={steps} currentStepId={request.current_step?.id} />
        )}

        {/* ── Terminal state ───────────────────────────────────────────────────── */}
        {!isActive ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              request.status === 'completed'
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {request.status === 'completed'
                ? <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
                : <XCircle size={32} className="text-red-500 dark:text-red-400" />
              }
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-1">
              Solicitud {request.status === 'completed' ? 'completada' : 'cancelada'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Todos los pasos han sido procesados.
            </p>
          </div>

        ) : (
          <>
            {/* ── Current step ──────────────────────────────────────────────────── */}
            {request.current_step && (
              <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 dark:bg-violet-900/10 rounded-xl border border-violet-100 dark:border-violet-900/30">
                <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse shrink-0" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Paso actual: <strong className="text-slate-800 dark:text-white">{request.current_step.name}</strong>
                </span>
              </div>
            )}

            {/* ── Dynamic form ──────────────────────────────────────────────────── */}
            {schema?.fields?.length > 0 && (
              <DynamicForm
                fields={schema.fields}
                values={formData}
                onChange={setFormData}
                errors={fieldErrors}
                disabled={!canEdit}
              />
            )}

            {/* ── Error banner ──────────────────────────────────────────────────── */}
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* ── Branch buttons ────────────────────────────────────────────────── */}
            {!canAct ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                No tienes permisos para actuar en este paso.
              </p>
            ) : branches.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => handleTransition(branch)}
                    disabled={!!submitting}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      BRANCH_STYLE_CLASSES[branch.style] ?? BRANCH_STYLE_CLASSES.primary
                    }`}
                  >
                    {submitting === branch.id ? 'Procesando…' : branch.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                <Settings size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Sin acciones configuradas</p>
                  <p className="text-xs mt-0.5 text-amber-600 dark:text-amber-500">
                    El paso <strong>{request.current_step?.name}</strong> no tiene acciones (ramas) definidas.
                    Configúralas en el Builder del workflow para poder avanzar.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── History toggle ───────────────────────────────────────────────────── */}
        <div className="border-t border-slate-50 dark:border-slate-800 pt-4">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <History size={13} />
            Historial de transiciones
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showHistory && (
            <div className="mt-3">
              <HistoryPanel requestId={requestId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
