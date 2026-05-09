import { useState, useEffect, useCallback } from 'react'
import { suppliersAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Users, Search, Building2, Phone, Briefcase, Edit2, X, Check } from 'lucide-react'

function ProfileModal({ buyer, onClose, onSaved }) {
  const [form, setForm] = useState({
    company_name: buyer.buyer_profile?.company_name ?? '',
    department:   buyer.buyer_profile?.department ?? '',
    phone:        buyer.buyer_profile?.phone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await suppliersAPI.updateBuyerProfile(buyer.id, form)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Editar perfil</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}
          {[
            { key: 'company_name', label: 'Empresa' },
            { key: 'department',   label: 'Departamento' },
            { key: 'phone',        label: 'Teléfono' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
              <input
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BuyersPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [buyers, setBuyers]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [editing, setEditing]       = useState(null)

  const fetchBuyers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await suppliersAPI.listBuyers()
      setBuyers(Array.isArray(data) ? data : (data?.results ?? []))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBuyers() }, [fetchBuyers])

  const filtered = buyers.filter(b => {
    const q = search.toLowerCase()
    return (
      b.email?.toLowerCase().includes(q) ||
      b.buyer_profile?.company_name?.toLowerCase().includes(q) ||
      b.buyer_profile?.department?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      {editing && (
        <ProfileModal
          buyer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchBuyers() }}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Users size={24} className="text-blue-500" />
          Compradores
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gestión de usuarios compradores y sus perfiles
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{buyers.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">Con perfil</p>
          <p className="text-2xl font-bold text-blue-600">
            {buyers.filter(b => b.buyer_profile?.company_name).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">Sin perfil completo</p>
          <p className="text-2xl font-bold text-amber-600">
            {buyers.filter(b => !b.buyer_profile?.company_name).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar comprador…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay compradores</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(b => {
            const prof = b.buyer_profile
            return (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                      {b.email?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{b.email}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}>
                        {b.role === 'admin' ? 'Admin' : 'Comprador'}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setEditing(b)}
                      className="text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0"
                      title="Editar perfil"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>

                {/* Profile data */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {prof?.company_name && (
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{prof.company_name}</span>
                    </div>
                  )}
                  {prof?.department && (
                    <div className="flex items-center gap-2">
                      <Briefcase size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{prof.department}</span>
                    </div>
                  )}
                  {prof?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400 flex-shrink-0" />
                      <span>{prof.phone}</span>
                    </div>
                  )}
                  {!prof?.company_name && !prof?.department && !prof?.phone && (
                    <p className="text-slate-400 dark:text-slate-600 italic">Sin perfil completo</p>
                  )}
                </div>

                {/* Verified badge */}
                {b.is_active && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check size={13} />
                    <span>Cuenta activa</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
