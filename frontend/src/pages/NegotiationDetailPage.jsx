import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { negotiationAPI, suppliersAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Handshake, ArrowLeft, Plus, Trash2, Edit2, X, Check, Send,
  Users, Package, BarChart2, ShoppingCart, Loader2, ChevronDown,
  ChevronUp, AlertTriangle, Globe,
} from 'lucide-react'

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft:      { label: 'Borrador',  color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
  open:       { label: 'Abierto',   color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  evaluating: { label: 'Evaluando', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  closed:     { label: 'Cerrado',   color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
}
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
}

function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'items',     label: 'Ítems',      icon: Package },
  { id: 'invites',   label: 'Proveedores',icon: Users },
  { id: 'compare',   label: 'Comparativa',icon: BarChart2 },
  { id: 'orders',    label: 'OC',          icon: ShoppingCart },
]

// ─── Items tab ────────────────────────────────────────────────────────────────

function ItemsTab({ process, items, onRefresh, canEdit }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name: '', description: '', quantity: '', unit: '', order: 1 })
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [error, setError]       = useState('')

  const openEdit = (item) => {
    setForm({ name: item.name, description: item.description ?? '', quantity: item.quantity, unit: item.unit ?? '', order: item.order })
    setEditId(item.id)
    setShowForm(true)
  }

  const reset = () => { setShowForm(false); setEditId(null); setForm({ name: '', description: '', quantity: '', unit: '', order: items.length + 1 }); setError('') }

  const handleSave = async () => {
    if (!form.name.trim() || !form.quantity) { setError('Nombre y cantidad son requeridos'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, quantity: parseFloat(form.quantity), order: parseInt(form.order) || 1 }
      if (editId) await negotiationAPI.updateItem(process.id, editId, payload)
      else await negotiationAPI.createItem(process.id, payload)
      reset(); onRefresh()
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (itemId) => {
    if (!window.confirm('¿Eliminar ítem?')) return
    try { await negotiationAPI.deleteItem(process.id, itemId); onRefresh() } catch {}
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => { reset(); setShowForm(true) }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
          >
            <Plus size={14} /> Agregar ítem
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'name',        label: 'Nombre *',    type: 'text' },
              { key: 'quantity',    label: 'Cantidad *',  type: 'number' },
              { key: 'unit',        label: 'Unidad',      type: 'text' },
              { key: 'order',       label: 'Orden',       type: 'number' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Descripción</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={reset} className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {editId ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
          <Package size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin ítems aún</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="pb-2 pr-4">#</th>
                <th className="pb-2 pr-4">Nombre</th>
                <th className="pb-2 pr-4">Descripción</th>
                <th className="pb-2 pr-4 text-right">Cantidad</th>
                <th className="pb-2 pr-4">Unidad</th>
                {canEdit && <th className="pb-2" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 pr-4 text-slate-400">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-white">{item.name}</td>
                  <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{item.description || '—'}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{fmt(item.quantity)}</td>
                  <td className="py-2.5 pr-4 text-slate-500">{item.unit || '—'}</td>
                  {canEdit && (
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(item)} className="text-slate-400 hover:text-blue-500 transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Invites tab ──────────────────────────────────────────────────────────────

function InvitesTab({ process, invites, onRefresh, canEdit }) {
  const [suppliers, setSuppliers] = useState([])
  const [selected, setSelected]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    suppliersAPI.list({ status: 'approved' })
      .then(({ data }) => setSuppliers(Array.isArray(data) ? data : (data?.results ?? [])))
      .catch(() => {})
  }, [])

  const invited = new Set(invites.map(i => i.supplier))

  const handleInvite = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      await negotiationAPI.invite(process.id, selected)
      setSelected(''); onRefresh()
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error al invitar')
    } finally {
      setSaving(false)
    }
  }

  const handleUninvite = async (inviteId) => {
    try { await negotiationAPI.uninvite(process.id, inviteId); onRefresh() } catch {}
  }

  const available = suppliers.filter(s => !invited.has(s.id))

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Seleccionar proveedor…</option>
            {available.map(s => (
              <option key={s.id} value={s.id}>
                {s.email} {s.supplier_profile?.company_name ? `– ${s.supplier_profile.company_name}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleInvite}
            disabled={!selected || saving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Invitar
          </button>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {invites.length === 0 ? (
        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
          <Users size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin proveedores invitados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map(inv => (
            <div key={inv.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-white">{inv.supplier_email}</p>
                {inv.supplier_name && <p className="text-xs text-slate-500">{inv.supplier_name}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  inv.status === 'accepted'  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                  inv.status === 'declined'  ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' :
                  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {inv.status === 'accepted' ? 'Aceptó' : inv.status === 'declined' ? 'Rechazó' : 'Pendiente'}
                </span>
                {canEdit && (
                  <button onClick={() => handleUninvite(inv.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Compare tab ──────────────────────────────────────────────────────────────

function CompareTab({ process, onRefresh, canAccept }) {
  const [data, setData]     = useState(null)
  const [loading, setLoad]  = useState(true)
  const [accepting, setAcc] = useState(null)
  const [error, setError]   = useState('')

  const fetchCompare = useCallback(async () => {
    setLoad(true)
    try {
      const { data: d } = await negotiationAPI.compare(process.id)
      setData(d)
    } catch { /* may 404 if no offers yet */ }
    finally { setLoad(false) }
  }, [process.id])

  useEffect(() => { fetchCompare() }, [fetchCompare])

  const handleAccept = async (offerId) => {
    if (!window.confirm('¿Aceptar esta oferta? Se generará una orden de compra y el proceso se cerrará.')) return
    setAcc(offerId); setError('')
    try {
      await negotiationAPI.acceptOffer(process.id, offerId)
      onRefresh()
      fetchCompare()
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error al aceptar oferta')
    } finally {
      setAcc(null)
    }
  }

  const handleReject = async (offerId) => {
    if (!window.confirm('¿Rechazar esta oferta?')) return
    try {
      await negotiationAPI.rejectOffer(process.id, offerId)
      fetchCompare()
    } catch {}
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  )

  if (!data || !data.offers?.length) return (
    <div className="text-center py-10 text-slate-400 dark:text-slate-500">
      <BarChart2 size={32} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">Sin ofertas para comparar</p>
    </div>
  )

  const { items, offers } = data

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 rounded-xl">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="pb-2 pr-4 w-48">Ítem</th>
              {offers.map(o => (
                <th key={o.id} className="pb-2 px-3 text-right min-w-[140px]">
                  <div className="text-slate-700 dark:text-slate-200 font-semibold truncate">{o.supplier_name || o.supplier_email}</div>
                  <div className="font-normal text-slate-400 text-xs">{o.supplier_name ? o.supplier_email : ''}</div>
                  <div className="mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      o.status === 'accepted' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                      o.status === 'rejected' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-500' :
                      'bg-amber-100 dark:bg-amber-900/30 text-amber-700'
                    }`}>
                      {o.status === 'accepted' ? 'Aceptada' : o.status === 'rejected' ? 'Rechazada' : 'En revisión'}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-slate-800 dark:text-white">{item.name}</p>
                  <p className="text-xs text-slate-400">{fmt(item.quantity)} {item.unit}</p>
                </td>
                {offers.map(o => {
                  const line = o.lines?.[item.id]
                  return (
                    <td key={o.id} className="py-2.5 px-3 text-right">
                      {line ? (
                        <div>
                          <p className="font-mono font-semibold text-slate-800 dark:text-white">${fmt(line.unit_price)}</p>
                          <p className="text-xs text-slate-400 font-mono">Total: ${fmt(line.total)}</p>
                        </div>
                      ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Totals row */}
            <tr className="font-semibold bg-slate-50 dark:bg-slate-800/50">
              <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">Total oferta</td>
              {offers.map(o => (
                <td key={o.id} className="py-3 px-3 text-right font-mono text-slate-800 dark:text-white">
                  ${fmt(o.total_amount)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Delivery / validity */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map(o => (
          <div key={o.id} className={`rounded-xl p-4 border ${
            o.status === 'accepted'
              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
          }`}>
            <p className="text-sm font-semibold text-slate-800 dark:text-white mb-1 truncate">
              {o.supplier_name || o.supplier_email}
            </p>
            {o.delivery_days && <p className="text-xs text-slate-500">Entrega: {o.delivery_days} días</p>}
            {o.validity_days && <p className="text-xs text-slate-500">Validez: {o.validity_days} días</p>}
            {o.notes && <p className="text-xs text-slate-500 mt-1 italic">"{o.notes}"</p>}
            {canAccept && o.status === 'submitted' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAccept(o.id)}
                  disabled={accepting === o.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {accepting === o.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Aceptar
                </button>
                <button
                  onClick={() => handleReject(o.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                >
                  <X size={12} /> Rechazar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── My Offer tab (supplier) ──────────────────────────────────────────────────

function MyOfferTab({ process }) {
  const [offer, setOffer]   = useState(null)
  const [items, setItems]   = useState([])
  const [lines, setLines]   = useState({}) // itemId -> { unit_price, notes }
  const [saving, setSaving] = useState(false)
  const [submitting, setSub]= useState(false)
  const [error, setError]   = useState('')
  const [saved, setSaved]   = useState(false)
  const [form, setForm]     = useState({ delivery_days: '', validity_days: '', notes: '' })

  const fetchOffer = useCallback(async () => {
    try {
      const [offerRes, itemsRes] = await Promise.all([
        negotiationAPI.getMyOffer(process.id).catch(() => ({ data: null })),
        negotiationAPI.listItems(process.id),
      ])
      const o = offerRes.data
      setOffer(o)
      setItems(itemsRes.data?.results ?? itemsRes.data ?? [])
      if (o) {
        setForm({ delivery_days: o.delivery_days ?? '', validity_days: o.validity_days ?? '', notes: o.notes ?? '' })
        const linesMap = {}
        o.lines?.forEach(l => { linesMap[l.item] = { unit_price: l.unit_price, notes: l.notes ?? '' } })
        setLines(linesMap)
      }
    } catch {}
  }, [process.id])

  useEffect(() => { fetchOffer() }, [fetchOffer])

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const payload = {
        delivery_days: form.delivery_days ? parseInt(form.delivery_days) : null,
        validity_days: form.validity_days ? parseInt(form.validity_days) : null,
        notes: form.notes,
        lines: Object.entries(lines)
          .filter(([, v]) => v.unit_price !== '' && v.unit_price != null)
          .map(([itemId, v]) => ({ item: itemId, unit_price: parseFloat(v.unit_price), notes: v.notes ?? '' })),
      }
      const { data } = await negotiationAPI.saveMyOffer(process.id, payload)
      setOffer(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!window.confirm('¿Enviar tu oferta? Ya no podrás editarla.')) return
    setSub(true); setError('')
    try {
      await negotiationAPI.submitMyOffer(process.id)
      fetchOffer()
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Error al enviar')
    } finally {
      setSub(false)
    }
  }

  const isSubmitted = offer?.status === 'submitted'
  const isAccepted  = offer?.status === 'accepted'
  const isRejected  = offer?.status === 'rejected'

  return (
    <div className="space-y-5">
      {isAccepted && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
          <Check size={16} /> Tu oferta fue <strong>aceptada</strong>. Se generó una orden de compra.
        </div>
      )}
      {isRejected && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 rounded-xl text-sm text-rose-700 dark:text-rose-400">
          <X size={16} /> Tu oferta fue <strong>rechazada</strong>.
        </div>
      )}
      {isSubmitted && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle size={16} /> Oferta enviada — en evaluación.
        </div>
      )}
      {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg">{error}</p>}

      {/* General data */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { key: 'delivery_days', label: 'Días de entrega', type: 'number' },
          { key: 'validity_days', label: 'Días de validez', type: 'number' },
          { key: 'notes',         label: 'Notas',           type: 'text' },
        ].map(({ key, label, type }) => (
          <div key={key} className={key === 'notes' ? 'sm:col-span-1' : ''}>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              disabled={isSubmitted || isAccepted || isRejected}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      {/* Lines per item */}
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Precios por ítem</p>
        <div className="space-y-2">
          {items.map(item => {
            const line = lines[item.id] ?? { unit_price: '', notes: '' }
            return (
              <div key={item.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{item.name}</p>
                  <p className="text-xs text-slate-500">{fmt(item.quantity)} {item.unit}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Precio unitario</label>
                    <input
                      type="number"
                      value={line.unit_price}
                      onChange={e => setLines(l => ({ ...l, [item.id]: { ...line, unit_price: e.target.value } }))}
                      disabled={isSubmitted || isAccepted || isRejected}
                      placeholder="0.00"
                      className="w-28 px-2 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Notas</label>
                    <input
                      value={line.notes}
                      onChange={e => setLines(l => ({ ...l, [item.id]: { ...line, notes: e.target.value } }))}
                      disabled={isSubmitted || isAccepted || isRejected}
                      placeholder="opcional"
                      className="w-32 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                    />
                  </div>
                  {line.unit_price && (
                    <div className="text-xs text-slate-500">
                      <p className="text-slate-400">Total</p>
                      <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        ${fmt(parseFloat(line.unit_price || 0) * parseFloat(item.quantity || 0))}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!isSubmitted && !isAccepted && !isRejected && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? 'Guardado' : 'Guardar borrador'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !offer}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar oferta
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Orders tab ───────────────────────────────────────────────────────────────

function OrdersTab({ processId }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    negotiationAPI.listOrders({ process: processId })
      .then(({ data }) => setOrders(Array.isArray(data) ? data : (data?.results ?? [])))
      .catch(() => {})
      .finally(() => setLoad(false))
  }, [processId])

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /></div>

  if (!orders.length) return (
    <div className="text-center py-10 text-slate-400 dark:text-slate-500">
      <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">Sin órdenes de compra</p>
    </div>
  )

  const STATUS_OC = {
    draft: 'Borrador', sent: 'Enviada', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada',
  }

  return (
    <div className="space-y-3">
      {orders.map(o => (
        <div key={o.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-xs text-slate-400 font-mono">{o.id}</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-white mt-0.5">Proveedor: {o.supplier_email}</p>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              o.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
              o.status === 'cancelled' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600' :
              o.status === 'confirmed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
              'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              {STATUS_OC[o.status] ?? o.status}
            </span>
          </div>
          <p className="text-lg font-bold text-slate-800 dark:text-white">
            Total: ${fmt(o.total_amount)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Creada: {new Date(o.created_at).toLocaleDateString('es')}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NegotiationDetailPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const isAdmin    = user?.role === 'admin'
  const isBuyer    = user?.role === 'buyer' || isAdmin
  const isSupplier = user?.role === 'supplier'

  const [process, setProcess]   = useState(null)
  const [items, setItems]       = useState([])
  const [invites, setInvites]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState(isSupplier ? 'items' : 'items')
  const [transitioning, setTr]  = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [procRes, itemsRes] = await Promise.all([
        negotiationAPI.getProcess(id),
        negotiationAPI.listItems(id),
      ])
      setProcess(procRes.data)
      setInvites(procRes.data?.invites ?? [])
      const iData = itemsRes.data
      setItems(Array.isArray(iData) ? iData : (iData?.results ?? []))
    } catch { navigate('/negotiations') }
    finally { setLoading(false) }
  }, [id, navigate])

  const fetchInvites = useCallback(async () => {
    try {
      const { data } = await negotiationAPI.getProcess(id)
      setInvites(data.invites ?? [])
      setProcess(data)
    } catch {}
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  const transition = async (action) => {
    setTr(true)
    try {
      if (action === 'publish')    await negotiationAPI.publishProcess(id)
      if (action === 'evaluate')   await negotiationAPI.setEvaluating(id)
      if (action === 'close')      await negotiationAPI.closeProcess(id)
      const { data } = await negotiationAPI.getProcess(id)
      setProcess(data)
    } catch {}
    finally { setTr(false) }
  }

  const canEdit    = isBuyer && process?.status === 'draft'
  const canAccept  = isBuyer && process?.status === 'evaluating'
  const canPublish = isBuyer && process?.status === 'draft'
  const canEval    = isBuyer && process?.status === 'open'
  const canClose   = isBuyer && ['open', 'evaluating'].includes(process?.status)

  const visibleTabs = isSupplier
    ? [
        { id: 'items', label: 'Ítems', icon: Package },
        { id: 'my-offer', label: 'Mi Oferta', icon: Handshake },
      ]
    : TABS

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      {/* Back + header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/negotiations')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">{process?.title}</h1>
              <StatusBadge status={process?.status} />
            </div>
            {process?.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{process.description}</p>
            )}
            {process?.deadline && (
              <p className="text-xs text-slate-400 mt-1">
                Fecha límite: {new Date(process.deadline).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Transition buttons */}
          {isBuyer && (
            <div className="flex gap-2 flex-wrap">
              {canPublish && (
                <button
                  onClick={() => transition('publish')}
                  disabled={transitioning || items.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                  title={items.length === 0 ? 'Agrega al menos un ítem' : undefined}
                >
                  {transitioning ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                  Publicar
                </button>
              )}
              {canEval && (
                <button
                  onClick={() => transition('evaluate')}
                  disabled={transitioning}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {transitioning ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
                  Evaluar
                </button>
              )}
              {canClose && (
                <button
                  onClick={() => transition('close')}
                  disabled={transitioning}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cerrar proceso
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {visibleTabs.map(({ id: tId, label, icon: Icon }) => (
          <button
            key={tId}
            onClick={() => setTab(tId)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
              tab === tId
                ? 'border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/10'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        {tab === 'items' && (
          <ItemsTab process={process} items={items} onRefresh={fetchAll} canEdit={canEdit} />
        )}
        {tab === 'invites' && (
          <InvitesTab process={process} invites={invites} onRefresh={fetchInvites} canEdit={canEdit || process?.status === 'open'} />
        )}
        {tab === 'compare' && (
          <CompareTab process={process} onRefresh={fetchAll} canAccept={canAccept} />
        )}
        {tab === 'orders' && (
          <OrdersTab processId={id} />
        )}
        {tab === 'my-offer' && isSupplier && (
          <MyOfferTab process={process} />
        )}
      </div>
    </div>
  )
}
