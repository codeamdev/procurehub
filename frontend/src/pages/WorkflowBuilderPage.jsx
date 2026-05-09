/**
 * WorkflowBuilderPage — página principal del constructor de workflows.
 *
 * Tabs:
 *   1. Pasos       — StepManager
 *   2. Campos      — FieldManager
 *   3. Matriz      — FieldMatrixEditor (campo × paso → reglas)
 *   4. Branches    — BranchManager (por paso seleccionado)
 */
import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, GitBranch, Layers, Table2, Workflow,
  CheckCircle2, Clock, Ban, Send, Copy, Code2
} from 'lucide-react'
import { workflowDefAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { extractError } from '../utils/errors'
import StepManager from '../components/builder/StepManager'
import FieldManager from '../components/builder/FieldManager'
import FieldMatrixEditor from '../components/builder/FieldMatrixEditor'
import BranchManager from '../components/builder/BranchManager'
import ConditionsManager from '../components/builder/ConditionsManager'

const STATUS_CONFIG = {
  draft:       { label: 'Borrador',   cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', Icon: Clock },
  active:      { label: 'Activo',     cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', Icon: CheckCircle2 },
  deprecated:  { label: 'Obsoleto',   cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', Icon: Ban },
}

const TABS = [
  { key: 'steps',      label: 'Pasos',      Icon: Layers },
  { key: 'fields',     label: 'Campos',     Icon: GitBranch },
  { key: 'matrix',     label: 'Matriz',     Icon: Table2 },
  { key: 'branches',   label: 'Branches',   Icon: Workflow },
  { key: 'conditions', label: 'Condiciones', Icon: Code2 },
]

export default function WorkflowBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('steps')
  const [selectedStep, setSelectedStep] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [actionError, setActionError] = useState(null)

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchWorkflow = useCallback(() => workflowDefAPI.get(id), [id])
  const { data: workflow, loading, error, refetch } = useApi(fetchWorkflow, [id])

  const fetchMatrix = useCallback(
    () => workflowDefAPI.fieldMatrix(id),
    [id]
  )
  const { data: matrix, refetch: refetchMatrix } = useApi(
    tab === 'matrix' ? fetchMatrix : () => Promise.resolve({ data: null }),
    [tab, id]
  )

  const refresh = () => { refetch(); if (tab === 'matrix') refetchMatrix() }

  // ── Derived data ──────────────────────────────────────────────────────────
  const steps = workflow?.steps ?? []
  const fields = workflow?.fields ?? []
  const conditions = workflow?.conditions ?? []
  const readOnly = workflow?.status !== 'draft'
  const statusCfg = STATUS_CONFIG[workflow?.status] ?? STATUS_CONFIG.draft
  const StatusIcon = statusCfg.Icon

  // Branches for selected step
  const activeBranches = selectedStep
    ? (steps.find(s => s.id === selectedStep)?.branches ?? [])
    : []

  // ── Actions ───────────────────────────────────────────────────────────────
  const runAction = async (fn, label) => {
    setActionLoading(label)
    setActionError(null)
    try {
      await fn()
      await refetch()
    } catch (err) {
      setActionError(extractError(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handlePublish   = () => runAction(() => workflowDefAPI.publish(id), 'publish')
  const handleDeprecate = () => runAction(() => workflowDefAPI.deprecate(id), 'deprecate')
  const handleClone     = async () => {
    setActionLoading('clone')
    setActionError(null)
    try {
      const { data } = await workflowDefAPI.clone(id)
      navigate(`/workflows/${data.id}`)
    } catch (err) {
      setActionError(extractError(err))
    } finally {
      setActionLoading(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-60 text-slate-400 dark:text-slate-500 text-sm animate-pulse">
        Cargando workflow…
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="text-center py-20 text-red-500 dark:text-red-400 text-sm">
        {extractError(error) || 'Workflow no encontrado.'}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/workflows"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors mt-0.5"
          >
            <ArrowLeft size={15} /> Volver
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{workflow.name}</h1>
              <span className="text-xs text-slate-400 dark:text-slate-500">v{workflow.version}</span>
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.cls}`}>
                <StatusIcon size={11} />
                {statusCfg.label}
              </span>
            </div>
            {workflow.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{workflow.description}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {actionError && (
            <span className="text-xs text-red-500 dark:text-red-400">{actionError}</span>
          )}

          {workflow.status === 'draft' && (
            <button
              onClick={handlePublish}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
              {actionLoading === 'publish' ? 'Publicando…' : 'Publicar'}
            </button>
          )}

          {workflow.status === 'active' && (
            <>
              <button
                onClick={handleClone}
                disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                <Copy size={14} />
                {actionLoading === 'clone' ? 'Clonando…' : 'Nueva versión'}
              </button>
              <button
                onClick={handleDeprecate}
                disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'deprecate' ? 'Procesando…' : 'Deprecar'}
              </button>
            </>
          )}

          {workflow.status === 'deprecated' && (
            <button
              onClick={handleClone}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <Copy size={14} />
              {actionLoading === 'clone' ? 'Clonando…' : 'Restaurar como borrador'}
            </button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
          <span className="font-semibold">Solo lectura.</span>
          {workflow.status === 'active'
            ? 'Crea una nueva versión para modificar este workflow.'
            : 'Los workflows obsoletos no pueden editarse.'}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 dark:border-slate-700">
        <div className="flex gap-1">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
        {tab === 'steps' && (
          <StepManager
            workflowId={id}
            steps={steps}
            readOnly={readOnly}
            onRefresh={refresh}
          />
        )}

        {tab === 'fields' && (
          <FieldManager
            workflowId={id}
            fields={fields}
            readOnly={readOnly}
            onRefresh={refresh}
          />
        )}

        {tab === 'matrix' && (
          <FieldMatrixEditor
            workflowId={id}
            matrix={matrix}
            conditions={conditions}
            readOnly={readOnly}
            onRefresh={() => { refetch(); refetchMatrix() }}
          />
        )}

        {tab === 'branches' && (
          <div className="space-y-6">
            {/* Step selector */}
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Selecciona un paso para configurar sus branches
              </label>
              <div className="flex flex-wrap gap-2">
                {[...steps].sort((a, b) => a.order - b.order).map(step => (
                  <button
                    key={step.id}
                    onClick={() => setSelectedStep(step.id)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedStep === step.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {step.name}
                    {step.is_initial && <span className="ml-1.5 text-emerald-400">●</span>}
                    {step.is_final && <span className="ml-1.5 text-amber-400">●</span>}
                  </button>
                ))}
                {steps.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Agrega pasos primero en la pestaña Pasos.
                  </p>
                )}
              </div>
            </div>

            {/* Branch manager for selected step */}
            {selectedStep && (
              <BranchManager
                workflowId={id}
                step={steps.find(s => s.id === selectedStep)}
                steps={steps}
                branches={steps.find(s => s.id === selectedStep)?.branches ?? []}
                conditions={conditions}
                fields={fields.map(f => ({ key: f.key, label: f.label }))}
                readOnly={readOnly}
                onRefresh={refresh}
              />
            )}

            {!selectedStep && steps.length > 0 && (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
                Selecciona un paso para ver y editar sus branches.
              </div>
            )}
          </div>
        )}

        {tab === 'conditions' && (
          <ConditionsManager
            workflowId={id}
            readOnly={readOnly}
            onRefresh={refresh}
          />
        )}
      </div>
    </div>
  )
}
