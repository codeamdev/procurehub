import { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, GitBranch, CheckCircle2, XCircle, Clock,
  Search, RefreshCw, ChevronUp, ChevronDown, ChevronsLeft,
  ChevronsRight, ChevronLeft, ChevronRight, Filter
} from 'lucide-react'
import { workflowAPI, workflowDefAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { extractError } from '../utils/errors'
import WorkflowWizard from '../components/WorkflowWizard'

const STATUS_CONFIG = {
  active:    { label: 'En progreso', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',           Icon: Clock },
  completed: { label: 'Completada',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', Icon: CheckCircle2 },
  cancelled: { label: 'Cancelada',   cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',               Icon: XCircle },
}

const PAGE_SIZES = [10, 20, 50]

// ── Nueva Solicitud Modal ─────────────────────────────────────────────────────
function NuevaSolicitudModal({ onClose, onCreated, workflowId }) {
  const { data: definitions, loading: loadingDefs } = useApi(
    () => workflowDefAPI.list({ status: 'active' }),
    []
  )
  const [selected, setSelected] = useState(
    workflowId ? { id: workflowId } : null
  )
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async () => {
    if (!selected) return
    setCreating(true)
    setError(null)
    try {
      const { data } = await workflowAPI.createRequest({ workflow_definition_id: selected.id })
      onCreated(data.id)
    } catch (err) {
      setError(extractError(err))
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nueva Solicitud</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">✕</button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona el tipo de workflow para iniciar la solicitud.</p>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
        )}

        {loadingDefs ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
          </div>
        ) : (definitions ?? []).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">No hay workflows activos disponibles.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(definitions ?? []).map(wf => (
              <button
                key={wf.id}
                onClick={() => setSelected(wf)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  selected?.id === wf.id
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 bg-white dark:bg-slate-800'
                }`}
              >
                <GitBranch size={16} className={selected?.id === wf.id ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{wf.name}</p>
                  {wf.description && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{wf.description}</p>}
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">v{wf.version}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleCreate}
            disabled={!selected || creating}
            className="flex-1 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl disabled:opacity-50 transition-colors"
          >
            {creating ? 'Iniciando…' : 'Iniciar solicitud'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Column header filter input ────────────────────────────────────────────────
function ColFilter({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full mt-1 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
      onClick={e => e.stopPropagation()}
    />
  )
}

// ── Sort indicator ────────────────────────────────────────────────────────────
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronUp size={12} className="text-slate-300 dark:text-slate-600" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-violet-500" />
    : <ChevronDown size={12} className="text-violet-500" />
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SolicitudesPage() {
  const { workflowId } = useParams()
  const navigate = useNavigate()
  const [activeRequestId, setActiveRequestId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [creatingDirect, setCreatingDirect] = useState(false)
  const [createError, setCreateError] = useState(null)

  // Table state
  const [globalFilter, setGlobalFilter] = useState('')
  const [colFilters, setColFilters] = useState({ title: '', workflow: '', step: '', status: '' })
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchRequests = useCallback(
    () => workflowAPI.listRequests(workflowId ? { workflow_id: workflowId } : {}),
    [workflowId]
  )
  const { data: requests, loading, error, refetch } = useApi(fetchRequests, [workflowId])

  const fetchWorkflow = useCallback(
    () => workflowId ? workflowDefAPI.get(workflowId) : Promise.resolve({ data: null }),
    [workflowId]
  )
  const { data: workflowDef } = useApi(fetchWorkflow, [workflowId])

  const handleCreated = useCallback((requestId) => {
    setShowModal(false)
    setActiveRequestId(requestId)
  }, [])

  const handleCreateDirect = useCallback(async () => {
    if (!workflowId) return
    setCreatingDirect(true)
    setCreateError(null)
    try {
      const { data } = await workflowAPI.createRequest({ workflow_definition_id: workflowId })
      setActiveRequestId(data.id)
    } catch (err) {
      setCreateError(extractError(err))
    } finally {
      setCreatingDirect(false)
    }
  }, [workflowId])

  const handleWizardDone = useCallback(() => { refetch() }, [refetch])

  const setColFilter = (col, val) => {
    setColFilters(prev => ({ ...prev, [col]: val }))
    setPage(1)
  }

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const all = requests ?? []

  // Filter
  const filtered = useMemo(() => {
    const q = globalFilter.toLowerCase()
    return all.filter(r => {
      if (q) {
        const searchable = [r.title, r.workflow_name, r.current_step_name, r.created_by_email].join(' ').toLowerCase()
        if (!searchable.includes(q)) return false
      }
      if (colFilters.title && !(r.title ?? '').toLowerCase().includes(colFilters.title.toLowerCase())) return false
      if (colFilters.workflow && !(r.workflow_name ?? '').toLowerCase().includes(colFilters.workflow.toLowerCase())) return false
      if (colFilters.step && !(r.current_step_name ?? '').toLowerCase().includes(colFilters.step.toLowerCase())) return false
      if (colFilters.status && r.status !== colFilters.status) return false
      return true
    })
  }, [all, globalFilter, colFilters])

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortCol] ?? ''
      let vb = b[sortCol] ?? ''
      if (sortCol === 'created_at' || sortCol === 'updated_at') {
        va = new Date(va).getTime()
        vb = new Date(vb).getTime()
      } else {
        va = String(va).toLowerCase()
        vb = String(vb).toLowerCase()
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortCol, sortDir])

  // Wizard view
  if (activeRequestId) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => { setActiveRequestId(null); refetch() }}
          className="flex items-center gap-2 mb-4 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Solicitudes
        </button>
        <WorkflowWizard requestId={activeRequestId} onDone={handleWizardDone} />
      </div>
    )
  }

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  const clearFilters = () => {
    setGlobalFilter('')
    setColFilters({ title: '', workflow: '', step: '', status: '' })
    setPage(1)
  }

  const hasFilters = globalFilter || Object.values(colFilters).some(Boolean)

  const thClass = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 cursor-pointer select-none whitespace-nowrap group'
  const tdClass = 'px-3 py-3 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800 align-middle'

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {showModal && (
        <NuevaSolicitudModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
          workflowId={workflowId}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {workflowId && (
            <button
              onClick={() => navigate('/solicitudes')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              <ArrowLeft size={15} /> Todas
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {workflowId && workflowDef ? workflowDef.name : 'Solicitudes'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {sorted.length} solicitud{sorted.length !== 1 ? 'es' : ''}
              {hasFilters && ` (filtradas de ${all.length})`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
            >
              <Filter size={12} /> Limpiar filtros
            </button>
          )}
          <button
            onClick={refetch}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={workflowId ? handleCreateDirect : () => setShowModal(true)}
            disabled={creatingDirect}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            <Plus size={16} /> {creatingDirect ? 'Creando…' : 'Nueva solicitud'}
          </button>
        </div>
      </div>

      {/* Direct creation error */}
      {createError && (
        <div className="flex items-center justify-between px-4 py-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <span>{createError}</span>
          <button onClick={() => setCreateError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}

      {/* Global search + page size */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar en todas las columnas..."
            value={globalFilter}
            onChange={e => { setGlobalFilter(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Mostrar</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span>filas</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 border-b border-slate-50 dark:border-slate-800 animate-pulse bg-slate-50/50 dark:bg-slate-800/30" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 text-sm">{extractError(error)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {/* Title */}
                  <th className={thClass} onClick={() => handleSort('title')}>
                    <div className="flex items-center gap-1">
                      Título <SortIcon col="title" sortCol={sortCol} sortDir={sortDir} />
                    </div>
                    <ColFilter value={colFilters.title} onChange={v => setColFilter('title', v)} placeholder="Filtrar..." />
                  </th>
                  {/* Workflow — only show if not filtered by specific workflow */}
                  {!workflowId && (
                    <th className={thClass} onClick={() => handleSort('workflow_name')}>
                      <div className="flex items-center gap-1">
                        Workflow <SortIcon col="workflow_name" sortCol={sortCol} sortDir={sortDir} />
                      </div>
                      <ColFilter value={colFilters.workflow} onChange={v => setColFilter('workflow', v)} placeholder="Filtrar..." />
                    </th>
                  )}
                  {/* Status */}
                  <th className={`${thClass} w-36`} onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">
                      Estado <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} />
                    </div>
                    <select
                      value={colFilters.status}
                      onChange={e => setColFilter('status', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="">Todos</option>
                      <option value="active">En progreso</option>
                      <option value="completed">Completada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </th>
                  {/* Step */}
                  <th className={`${thClass} w-44`} onClick={() => handleSort('current_step_name')}>
                    <div className="flex items-center gap-1">
                      Paso actual <SortIcon col="current_step_name" sortCol={sortCol} sortDir={sortDir} />
                    </div>
                    <ColFilter value={colFilters.step} onChange={v => setColFilter('step', v)} placeholder="Filtrar..." />
                  </th>
                  {/* Date */}
                  <th className={`${thClass} w-36`} onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-1">
                      Fecha <SortIcon col="created_at" sortCol={sortCol} sortDir={sortDir} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={workflowId ? 4 : 5} className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
                      {all.length === 0
                        ? 'No hay solicitudes todavía.'
                        : 'Sin resultados para los filtros aplicados.'}
                    </td>
                  </tr>
                ) : (
                  paginated.map(req => {
                    const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.active
                    const CfgIcon = cfg.Icon
                    return (
                      <tr
                        key={req.id}
                        onClick={() => setActiveRequestId(req.id)}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                      >
                        <td className={tdClass}>
                          <div className="font-semibold text-slate-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {req.title || req.workflow_name}
                          </div>
                          {req.created_by_email && (
                            <div className="text-xs text-slate-400 mt-0.5">{req.created_by_email}</div>
                          )}
                        </td>
                        {!workflowId && (
                          <td className={tdClass}>
                            <span className="font-medium">{req.workflow_name}</span>
                            <span className="ml-1.5 text-xs text-slate-400">v{req.workflow_version}</span>
                          </td>
                        )}
                        <td className={tdClass}>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${cfg.cls}`}>
                            <CfgIcon size={10} /> {cfg.label}
                          </span>
                        </td>
                        <td className={tdClass}>
                          {req.status === 'active' && req.current_step_name
                            ? <span className="text-slate-600 dark:text-slate-300">{req.current_step_name}</span>
                            : <span className="text-slate-300 dark:text-slate-600">—</span>
                          }
                        </td>
                        <td className={`${tdClass} text-xs text-slate-500`}>
                          {new Date(req.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && sorted.length > 0 && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando {Math.min((page - 1) * pageSize + 1, sorted.length)}–{Math.min(page * pageSize, sorted.length)} de {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
              <ChevronsLeft size={15} />
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
              <ChevronRight size={15} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
              <ChevronsRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
