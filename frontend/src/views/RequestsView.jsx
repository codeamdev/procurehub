import { Link } from 'react-router-dom'
import { Search, Plus, X, FileText, Package, Award, Calendar, DollarSign, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { procurementAPI } from '../services/api'
import useForm from '../hooks/useForm'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { extractError } from '../utils/errors'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'

const STATUS_FILTERS = [
  { id: 'all',     label: 'Todas' },
  { id: 'open',    label: 'Abiertas' },
  { id: 'closed',  label: 'Cerradas' },
  { id: 'awarded', label: 'Adjudicadas' },
]

const EMPTY_FORM = { title: '', description: '', budget: '', category: '', deadline: '' }

export default function RequestsView({
  requests = [],
  loading = false,
  error = null,
  isAdminOrBuyer = false,
  showForm = false,
  onToggleForm,
  onFormCreated,
  onFormCancel,
  searchQuery = '',
  onSearchChange,
  filterStatus = 'all',
  onFilterChange,
  totalCount = 0,
  openCount = 0,
  awardedCount = 0,
}) {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Solicitudes de Compra
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Gestiona y da seguimiento a tus solicitudes
          </p>
        </div>
        {isAdminOrBuyer && (
          <Button
            variant={showForm ? 'secondary' : 'default'}
            onClick={onToggleForm}
          >
            {showForm ? <><X size={16} /> Cancelar</> : <><Plus size={16} /> Nueva Solicitud</>}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total"       value={totalCount}   icon={FileText} color="blue" />
        <StatCard label="Abiertas"    value={openCount}    icon={Package}  color="emerald" />
        <StatCard label="Adjudicadas" value={awardedCount} icon={Award}    color="violet" />
      </div>

      {/* Create form panel */}
      {showForm && isAdminOrBuyer && (
        <CreateRequestForm onCreated={onFormCreated} onCancel={onFormCancel} />
      )}

      <Alert message={error} />

      {/* Table card */}
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            <Input
              type="text"
              placeholder="Buscar por título o categoría..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 self-start">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => onFilterChange(f.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  filterStatus === f.id
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && <div className="skeleton-fade"><SkeletonGrid /></div>}

          {!loading && requests.length === 0 && (
            <EmptyState
              icon={searchQuery || filterStatus !== 'all' ? '🔍' : '📄'}
              title={searchQuery || filterStatus !== 'all' ? 'Sin resultados' : 'Sin solicitudes'}
              description={
                searchQuery
                  ? `No se encontraron solicitudes con "${searchQuery}".`
                  : filterStatus !== 'all'
                  ? 'No hay solicitudes con ese estado.'
                  : isAdminOrBuyer
                  ? 'Crea tu primera solicitud de compra para comenzar.'
                  : 'No hay solicitudes disponibles por el momento.'
              }
              action={
                !searchQuery && filterStatus === 'all' && isAdminOrBuyer && (
                  <Button onClick={onToggleForm} className="mt-2">
                    <Plus size={14} /> Nueva Solicitud
                  </Button>
                )
              }
            />
          )}

          {!loading && requests.length > 0 && (
            <>
              <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))' }}>
                {requests.map(req => (
                  <RequestCard key={req.id} request={req} />
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {requests.length} solicitud{requests.length !== 1 ? 'es' : ''}
                  {(searchQuery || filterStatus !== 'all') ? ` (filtrado de ${totalCount})` : ''}
                </span>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20',    icon: 'text-blue-600 dark:text-blue-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400' },
    violet:  { bg: 'bg-violet-50 dark:bg-violet-900/20',  icon: 'text-violet-600 dark:text-violet-400' },
  }
  const c = colors[color]
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={c.icon} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      </div>
    </Card>
  )
}

function RequestCard({ request }) {
  const desc = request.description || ''
  return (
    <Link
      to={`/requests/${request.id}`}
      className="block bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group no-underline"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 rounded-full">
          {request.category}
        </span>
        <Badge status={request.status} />
      </div>

      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
        {request.title}
      </h3>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">
        {desc || 'Sin descripción.'}
      </p>

      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
        <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
          <DollarSign size={12} />
          {Number(request.budget).toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {request.deadline}
        </span>
        <span className="ml-auto flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
          <MessageSquare size={12} />
          {request.proposal_count ?? 0}
        </span>
      </div>
    </Link>
  )
}

function CreateRequestForm({ onCreated, onCancel }) {
  const { values, handleChange, reset } = useForm(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await procurementAPI.createRequest(values)
      reset()
      onCreated()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-6 mb-6 border-blue-200 dark:border-blue-900/70 bg-blue-50/50 dark:bg-slate-900">
      <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">
        Nueva Solicitud de Compra
      </h3>
      <Alert message={error} onDismiss={() => setError(null)} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Título" required>
            <Input name="title" placeholder="ej. Insumos de oficina Q3" required value={values.title} onChange={handleChange} />
          </Field>
          <Field label="Categoría" required>
            <Input name="category" placeholder="ej. Equipos de TI" required value={values.category} onChange={handleChange} />
          </Field>
        </div>

        <Field label="Descripción" required>
          <Textarea
            name="description"
            placeholder="Describe lo que necesitas con detalle…"
            required
            value={values.description}
            onChange={handleChange}
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Presupuesto (USD)" required>
            <Input name="budget" type="number" placeholder="0.00" required min="0.01" step="0.01" value={values.budget} onChange={handleChange} />
          </Field>
          <Field label="Fecha límite" required>
            <Input name="deadline" type="date" required value={values.deadline} onChange={handleChange} />
          </Field>
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={submitting}>
            Crear Solicitud
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/4 mb-2" />
          <div className="space-y-1.5 mb-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </Card>
      ))}
    </div>
  )
}
