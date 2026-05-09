/**
 * WorkflowListPage — lista y crea WorkflowDefinitions.
 * Accesible por admin/buyer desde /workflows
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Copy, CheckCircle2, Clock, Ban, ChevronRight, Download, Upload, ClipboardList } from 'lucide-react'
import { workflowDefAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { extractError } from '../utils/errors'

const STATUS_CONFIG = {
  draft:      { label: 'Borrador', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',        Icon: Clock },
  active:     { label: 'Activo',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', Icon: CheckCircle2 },
  deprecated: { label: 'Obsoleto', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',             Icon: Ban },
}

function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await workflowDefAPI.create(form)
      onCreate(data.id)
    } catch (err) {
      setError(extractError(err))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nuevo Workflow</h2>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Nombre *</label>
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Onboarding de Proveedor"
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Descripción</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Describe el propósito del workflow…"
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name.trim()}
            className="flex-1 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creando…' : 'Crear workflow'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WorkflowListPage() {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [importing, setImporting] = useState(false)
  const importRef = useRef(null)

  const { data: workflows, loading, error, refetch } = useApi(
    () => workflowDefAPI.list(statusFilter ? { status: statusFilter } : {}),
    [statusFilter]
  )

  const handleCreated = (newId) => {
    setShowCreate(false)
    navigate(`/workflows/${newId}`)
  }

  const handleClone = async (e, wfId) => {
    e.stopPropagation()
    try {
      const { data } = await workflowDefAPI.clone(wfId)
      navigate(`/workflows/${data.id}`)
    } catch (err) {
      alert(extractError(err))
    }
  }

  const handleToggleMenu = async (e, wfId) => {
    e.stopPropagation()
    try {
      await workflowDefAPI.toggleMenu(wfId)
      refetch()
    } catch (err) {
      alert(extractError(err))
    }
  }

  const handleExport = async (e, wfId, wfName) => {
    e.stopPropagation()
    try {
      const { data } = await workflowDefAPI.export(wfId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${wfName.toLowerCase().replace(/\s+/g, '_')}_v${data.version}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(extractError(err))
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const { data } = await workflowDefAPI.import(json)
      refetch()
      navigate(`/workflows/${data.id}`)
    } catch (err) {
      alert(err.message || extractError(err) || 'Error al importar el archivo.')
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  const list = workflows ?? []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}

      {/* Hidden file input for import */}
      <input
        ref={importRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Workflows</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Define pasos, campos y reglas de transición.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600 rounded-xl transition-colors disabled:opacity-50"
          >
            <Upload size={15} /> {importing ? 'Importando…' : 'Importar JSON'}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
          >
            <Plus size={16} /> Nuevo workflow
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'draft', 'active', 'deprecated'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === s
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {s === '' ? 'Todos' : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm animate-pulse">
          Cargando workflows…
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-500 text-sm">{extractError(error)}</div>
      ) : list.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">No hay workflows configurados.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 mx-auto text-sm font-medium text-violet-600 dark:text-violet-400 border border-dashed border-violet-300 dark:border-violet-700 px-5 py-3 rounded-xl hover:border-violet-500 transition-colors"
          >
            <Plus size={16} /> Crear el primero
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(wf => {
            const cfg = STATUS_CONFIG[wf.status] ?? STATUS_CONFIG.draft
            const CfgIcon = cfg.Icon
            return (
              <div
                key={wf.id}
                onClick={() => navigate(`/workflows/${wf.id}`)}
                className="flex items-center gap-4 px-5 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-violet-200 dark:hover:border-violet-800 hover:shadow-sm transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">{wf.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">v{wf.version}</span>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                      <CfgIcon size={10} /> {cfg.label}
                    </span>
                    {wf.show_in_menu && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        <ClipboardList size={10} /> En menú
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {wf.description || 'Sin descripción'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={e => handleToggleMenu(e, wf.id)}
                    title={wf.show_in_menu ? 'Quitar del menú' : 'Mostrar en menú de solicitudes'}
                    className={`p-2 rounded-lg transition-all ${
                      wf.show_in_menu
                        ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20'
                        : 'text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 opacity-0 group-hover:opacity-100 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                    }`}
                  >
                    <ClipboardList size={15} />
                  </button>
                  <button
                    onClick={e => handleExport(e, wf.id, wf.name)}
                    className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 opacity-0 group-hover:opacity-100 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                    title="Exportar JSON"
                  >
                    <Download size={15} />
                  </button>
                  {wf.status !== 'draft' && (
                    <button
                      onClick={e => handleClone(e, wf.id)}
                      className="p-2 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 opacity-0 group-hover:opacity-100 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all"
                      title="Crear nueva versión"
                    >
                      <Copy size={15} />
                    </button>
                  )}
                  <Pencil
                    size={15}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-violet-400 transition-colors"
                  />
                  <ChevronRight
                    size={16}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
