import { useState, useMemo } from 'react'
import {
  Building2, Search, CheckCircle2, XCircle, Clock,
  ChevronRight, Tag, Phone, Globe, MapPin, Pencil, X, Check, Plus
} from 'lucide-react'
import { suppliersAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { extractError } from '../utils/errors'

const STATUS = {
  approved: { label: 'Aprobado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', Icon: CheckCircle2 },
  pending:  { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', Icon: Clock },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', Icon: XCircle },
}

// ── Profile Edit Modal ─────────────────────────────────────────────────────────
function ProfileModal({ supplier, categories, onClose, onSaved }) {
  const profile = supplier.profile ?? {}
  const [form, setForm] = useState({
    company_name: profile.company_name ?? '',
    tax_id: profile.tax_id ?? '',
    address: profile.address ?? '',
    phone: profile.phone ?? '',
    website: profile.website ?? '',
    description: profile.description ?? '',
    category_ids: (profile.categories ?? []).map(c => c.id),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const toggleCat = (id) =>
    setForm(f => ({
      ...f,
      category_ids: f.category_ids.includes(id)
        ? f.category_ids.filter(c => c !== id)
        : [...f.category_ids, id],
    }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await suppliersAPI.updateProfile(supplier.id, form)
      onSaved()
      onClose()
    } catch (err) {
      setError(extractError(err))
      setSaving(false)
    }
  }

  const field = (label, key, type = 'text') => (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Perfil del proveedor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{supplier.email}</p>

        {error && <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          {field('Empresa', 'company_name')}
          {field('RUC / NIT', 'tax_id')}
          {field('Teléfono', 'phone')}
          {field('Sitio web', 'website', 'url')}
        </div>
        {field('Dirección', 'address')}

        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Descripción</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-2">Categorías</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCat(cat.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  form.category_ids.includes(cat.id)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-violet-400'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Category Manager ───────────────────────────────────────────────────────────
function CategoryManager({ categories, onRefresh }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    try {
      await suppliersAPI.createCategory({ name: newName.trim(), description: '' })
      setNewName('')
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    try {
      await suppliersAPI.deleteCategory(id)
      onRefresh()
    } catch (err) {
      alert(extractError(err))
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
        <Tag size={15} className="text-violet-500" /> Categorías de suministro
      </h2>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-1.5 text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-full px-3 py-1">
            <span>{cat.name}</span>
            <span className="text-violet-400 dark:text-violet-600">({cat.supplier_count})</span>
            <button onClick={() => handleDelete(cat.id)} className="text-violet-300 hover:text-red-500 transition-colors ml-1">
              <X size={11} />
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500">Sin categorías definidas.</span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Nueva categoría..."
          className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editSupplier, setEditSupplier] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const { data: suppliers, loading, refetch } = useApi(() => suppliersAPI.list(), [])
  const { data: categories, refetch: refetchCats } = useApi(() => suppliersAPI.listCategories(), [])

  const list = suppliers ?? []
  const cats = categories ?? []

  const filtered = useMemo(() => {
    return list.filter(s => {
      const name = (s.profile?.company_name ?? s.email).toLowerCase()
      const q = search.toLowerCase()
      if (q && !name.includes(q) && !s.email.includes(q)) return false
      if (statusFilter === 'approved' && !s.is_approved) return false
      if (statusFilter === 'pending' && s.is_approved) return false
      return true
    })
  }, [list, search, statusFilter])

  const handleApprove = async (id) => {
    setActingId(id)
    setActionError(null)
    try {
      await suppliersAPI.approve(id)
      refetch()
    } catch (err) {
      setActionError(extractError(err))
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (id) => {
    if (!confirm('¿Rechazar a este proveedor?')) return
    setActingId(id)
    setActionError(null)
    try {
      await suppliersAPI.reject(id)
      refetch()
    } catch (err) {
      setActionError(extractError(err))
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Proveedores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {list.length} proveedores registrados
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Aprobados', count: list.filter(s => s.is_approved).length, cls: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Pendientes', count: list.filter(s => !s.is_approved).length, cls: 'text-amber-600 dark:text-amber-400' },
            ].map(({ label, count, cls }) => (
              <div key={label} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${cls}`}>{count}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <CategoryManager categories={cats} onRefresh={refetchCats} />
        </div>

        {/* Main table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar proveedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex gap-2">
              {[['', 'Todos'], ['approved', 'Aprobados'], ['pending', 'Pendientes']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStatusFilter(val)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilter === val
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {actionError && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              {actionError}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
              {list.length === 0 ? 'No hay proveedores registrados.' : 'Sin resultados para los filtros.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(supplier => {
                const approved = supplier.is_approved
                const cfg = approved ? STATUS.approved : STATUS.pending
                const CfgIcon = cfg.Icon
                const profile = supplier.profile
                const name = profile?.company_name || supplier.email
                const isBusy = actingId === supplier.id

                return (
                  <div key={supplier.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
                        <Building2 size={18} className="text-violet-500 dark:text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 dark:text-white">{name}</span>
                          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                            <CfgIcon size={10} /> {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{supplier.email}</p>

                        {/* Profile info */}
                        <div className="flex flex-wrap gap-3 mt-2">
                          {profile?.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-400"><Phone size={11} /> {profile.phone}</span>
                          )}
                          {profile?.website && (
                            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-violet-500 hover:underline">
                              <Globe size={11} /> {profile.website}
                            </a>
                          )}
                          {profile?.address && (
                            <span className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={11} /> {profile.address}</span>
                          )}
                        </div>

                        {/* Categories */}
                        {(profile?.categories ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {profile.categories.map(cat => (
                              <span key={cat.id} className="text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800 rounded-full px-2 py-0.5">
                                {cat.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setEditSupplier(supplier)}
                          className="p-2 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                          title="Editar perfil"
                        >
                          <Pencil size={14} />
                        </button>
                        {!approved && (
                          <button
                            onClick={() => handleApprove(supplier.id)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <Check size={12} /> Aprobar
                          </button>
                        )}
                        {approved && (
                          <button
                            onClick={() => handleReject(supplier.id)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <XCircle size={12} /> Rechazar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {editSupplier && (
        <ProfileModal
          supplier={editSupplier}
          categories={cats}
          onClose={() => setEditSupplier(null)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
