import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { negotiationAPI, suppliersAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Handshake, Plus, Search, Calendar, Users, ChevronRight,
  Package, Clock, CheckCircle2, XCircle, Loader2, X,
} from 'lucide-react'

const STATUS_CONFIG = {
  draft:      { label: 'Borrador',   color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
  open:       { label: 'Abierto',    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  evaluating: { label: 'Evaluando',  color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  closed:     { label: 'Cerrado',    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function CreateModal({ onClose, onCreated }) {
  const [form, setForm]     = useState({ title: '', description: '', deadline: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleCreate = async () => {
    if (!form.title.trim()) { setError('El título es requerido'); return }
    setSaving(true)
    setError('')
    try {
      const payload = { title: form.title, description: form.description }
      if (form.deadline) payload.deadline = form.deadline
      const { data } = await negotiationAPI.createProcess(payload)
      onCreated(data)
    } catch (e) {
      setError(e.response?.data?.detail ?? JSON.stringify(e.response?.data) ?? 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Nuevo proceso</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Título *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ej: Compra de equipos de cómputo"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Fecha límite</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? 'Creando…' : 'Crear proceso'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NegotiationsPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const isAdmin    = user?.role === 'admin'
  const isBuyer    = user?.role === 'buyer' || isAdmin
  const isSupplier = user?.role === 'supplier'

  const [processes, setProcesses] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const fetchProcesses = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const { data } = await negotiationAPI.listProcesses(params)
      setProcesses(Array.isArray(data) ? data : (data?.results ?? []))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchProcesses() }, [fetchProcesses])

  const filtered = processes.filter(p => {
    const q = search.toLowerCase()
    return p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
  })

  const counts = {
    draft:      processes.filter(p => p.status === 'draft').length,
    open:       processes.filter(p => p.status === 'open').length,
    evaluating: processes.filter(p => p.status === 'evaluating').length,
    closed:     processes.filter(p => p.status === 'closed').length,
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(proc) => { setShowCreate(false); navigate(`/negotiations/${proc.id}`) }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Handshake size={24} className="text-violet-500" />
            Negociaciones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isBuyer ? 'Gestión de procesos de negociación' : 'Procesos de negociación disponibles'}
          </p>
        </div>
        {isBuyer && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors flex-shrink-0"
          >
            <Plus size={16} /> Nuevo proceso
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Borradores', count: counts.draft,      icon: Clock,         color: 'text-slate-500' },
          { label: 'Abiertos',   count: counts.open,       icon: Package,       color: 'text-blue-500' },
          { label: 'Evaluando',  count: counts.evaluating, icon: Users,         color: 'text-amber-500' },
          { label: 'Cerrados',   count: counts.closed,     icon: CheckCircle2,  color: 'text-emerald-500' },
        ].map(({ label, count, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} className={color} />
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proceso…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* Process list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <Handshake size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay procesos de negociación</p>
          {isBuyer && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
            >
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(proc => (
            <button
              key={proc.id}
              onClick={() => navigate(`/negotiations/${proc.id}`)}
              className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-4 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                <Handshake size={18} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{proc.title}</p>
                  <StatusBadge status={proc.status} />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  {proc.deadline && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(proc.deadline).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Package size={11} />
                    {proc.item_count ?? 0} ítems
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={11} />
                    {proc.invite_count ?? 0} invitados
                  </span>
                  {(proc.offer_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Handshake size={11} />
                      {proc.offer_count} ofertas
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight
                size={18}
                className="text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors flex-shrink-0"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
