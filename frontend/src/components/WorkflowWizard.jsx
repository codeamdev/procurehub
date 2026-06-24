/**
 * WorkflowWizard — drives a Request through its workflow.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  GitBranch, CheckCircle2, XCircle, AlertCircle,
  History, ChevronDown, ChevronUp, Settings, User, Layers
} from 'lucide-react'
import { workflowAPI } from '../services/api'
import DynamicForm from './DynamicForm'
import { extractError } from '../utils/errors'

const BRANCH_STYLE_CLASSES = {
  primary:   'bg-violet-600 hover:bg-violet-700 text-white',
  secondary: 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600',
  danger:    'bg-red-500 hover:bg-red-600 text-white',
  warning:   'bg-amber-500 hover:bg-amber-600 text-white',
}

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepProgress({ steps = [], currentStepId }) {
  if (steps.length === 0) return null
  const sorted = [...steps].sort((a, b) => a.order - b.order)
  const currentIdx = sorted.findIndex(s => s.id === currentStepId)

  return (
    <div className="flex items-start justify-between w-full overflow-x-auto">
      {sorted.map((step, idx) => {
        const isDone    = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isLast    = idx === sorted.length - 1
        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isDone    ? 'bg-emerald-500 text-white' :
                isCurrent ? 'bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-900/30' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                {isDone ? '✓' : idx + 1}
              </div>
              <span className={`text-[11px] font-medium text-center leading-tight max-w-20 ${
                isCurrent ? 'text-violet-600 dark:text-violet-400' :
                isDone    ? 'text-slate-500 dark:text-slate-400' :
                            'text-slate-300 dark:text-slate-600'
              }`}>
                {step.name}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-18px] transition-colors ${isDone ? 'bg-emerald-400' : 'bg-slate-100 dark:bg-slate-700'}`} />
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
    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
            <p className="text-slate-400 dark:text-slate-500 mt-0.5">
              {entry.executed_by_email} · {new Date(entry.executed_at).toLocaleString()}
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
  const [request, setRequest]         = useState(null)
  const [schema, setSchema]           = useState(null)
  const [branches, setBranches]       = useState([])
  const [canExecute, setCanExecute]   = useState(false)
  const [permissions, setPermissions] = useState({})
  const [formData, setFormData]       = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(null)
  const [error, setError]             = useState(null)
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
      setCanExecute(branchRes.data?.can_execute ?? false)
      setBranches(branchRes.data?.branches ?? [])
      const existingData = {}
      for (const fd of req.field_data ?? []) existingData[fd.field_key] = fd.value
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
        const [schemaRes, branchRes] = await Promise.all([
          workflowAPI.formSchema(requestId),
          workflowAPI.availableBranches(requestId),
        ])
        setSchema(schemaRes.data)
        setCanExecute(branchRes.data?.can_execute ?? false)
        setBranches(branchRes.data?.branches ?? [])
        const existingData = {}
        for (const fd of data.field_data ?? []) existingData[fd.field_key] = fd.value
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-400 dark:text-slate-500 text-sm animate-pulse">
        Cargando solicitud…
      </div>
    )
  }
  if (!request) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-100 dark:border-red-900/30 p-12 text-center text-red-500 text-sm">
        {error || 'No se pudo cargar la solicitud.'}
      </div>
    )
  }

  const isActive = request.status === 'active'
  const canEdit  = permissions?.can_edit ?? true
  const canAct   = permissions?.can_act ?? true
  const wfDef    = request.workflow_definition ?? {}
  const steps    = request.workflow_steps ?? []

  const currentStepDisplay = isActive
    ? (request.current_step?.name ?? '—')
    : request.status === 'completed' ? 'Completada' : 'Cancelada'

  const stepValueClass = isActive
    ? 'text-violet-600 dark:text-violet-400'
    : request.status === 'completed'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-500 dark:text-red-400'

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

      {/* ── Header: icono + metadata en 3 columnas uniformes ─────────────────── */}
      <div className="px-8 pt-6 pb-0 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
            <GitBranch size={17} className="text-violet-500 dark:text-violet-400" />
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
            Solicitud
          </span>
        </div>

        {/* Metadata: 3 columnas separadas por divisores, ancho completo */}
        <div className="grid grid-cols-3 border-t border-slate-100 dark:border-slate-800">
          {[
            { icon: Layers,    label: 'Tipo de solicitud', value: wfDef.name ?? '—',                  cls: '' },
            { icon: User,      label: 'Solicitante',       value: request.created_by_email ?? '—',    cls: '' },
            { icon: GitBranch, label: 'Estado (paso)',     value: currentStepDisplay,                 cls: stepValueClass },
          ].map(({ icon: Icon, label, value, cls }, i) => (
            <div
              key={label}
              className={`flex flex-col gap-1 py-4 ${i > 0 ? 'border-l border-slate-100 dark:border-slate-800 pl-6' : ''} ${i < 2 ? 'pr-6' : ''}`}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <Icon size={10} />
                {label}
              </span>
              <span className={`text-sm font-semibold truncate text-slate-800 dark:text-slate-100 ${cls}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Step progress (deshabilitado temporalmente) ────────────────────────
      {steps.length > 0 && (
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
          <StepProgress steps={steps} currentStepId={request.current_step?.id} />
        </div>
      )}
      ────────────────────────────────────────────────────────────────────── */}

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 space-y-5">

        {/* Terminal state */}
        {!isActive ? (
          <div className="flex flex-col items-center py-14 text-center">
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
            {/* ── Sección de formulario ──────────────────────────────────────────── */}
            {schema?.fields?.length > 0 && (
              <section className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/30 px-6 py-5">
                <DynamicForm
                  fields={schema.fields}
                  values={formData}
                  onChange={setFormData}
                  errors={fieldErrors}
                  disabled={!canEdit}
                />
              </section>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Branch buttons */}
            {!canAct ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                No tienes permisos para actuar en este paso.
              </p>
            ) : branches.length > 0 ? (
              <div className="flex flex-wrap gap-3 pt-1">
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => canExecute && handleTransition(branch)}
                    disabled={!!submitting || !canExecute}
                    title={!canExecute ? 'No tienes permiso para ejecutar acciones en este paso' : undefined}
                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
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
                    El paso <strong>{request.current_step?.name}</strong> no tiene acciones definidas.
                    Configúralas en el Builder para poder avanzar.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer: historial ─────────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 px-8 py-4">
        <button
          onClick={() => setShowHistory(h => !h)}
          className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <History size={13} />
          Historial de transiciones
          {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showHistory && (
          <div className="mt-4">
            <HistoryPanel requestId={requestId} />
          </div>
        )}
      </div>
    </div>
  )
}
