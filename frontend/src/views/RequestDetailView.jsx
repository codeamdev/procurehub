import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, Calendar, User, Clock, Package, CheckCircle2 } from 'lucide-react'
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

const PROPOSAL_DEFAULTS = { price: '', delivery_time: '', message: '' }

export default function RequestDetailView({
  request,
  loading,
  error,
  isAdminOrBuyer,
  isSupplier,
  myProposal,
  backPath,
  backLabel,
  onAward,
  onClose,
  onProposalSubmitted,
  requestId,
}) {
  return (
    <div className="max-w-6xl mx-auto">
      <Link
        to={backPath}
        className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-medium mb-6 no-underline transition-colors"
      >
        <ArrowLeft size={15} />
        Volver a {backLabel}
      </Link>

      {error && <Alert message={error} />}

      {loading && <SkeletonDetail />}

      {!loading && request && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-5 min-w-0">
            <RequestHeader request={request} />
            {isAdminOrBuyer && (
              <ProposalList request={request} onAward={onAward} onClose={onClose} />
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            {isSupplier && request.status === 'open' && (
              myProposal
                ? <MyProposalCard proposal={myProposal} />
                : <ProposalForm requestId={requestId} onSubmitted={onProposalSubmitted} />
            )}
            {isSupplier && request.status !== 'open' && (
              <ClosedStatusCard status={request.status} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RequestHeader({ request }) {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-start gap-3 mb-5">
        <div>
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 rounded-full inline-block mb-2">
            {request.category}
          </span>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">{request.title}</h1>
        </div>
        <Badge status={request.status} size="md" />
      </div>

      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
        {request.description}
      </p>

      <div className="flex flex-wrap gap-6">
        <MetaItem icon={DollarSign} label="Presupuesto" value={`$${Number(request.budget).toLocaleString()}`} valueClass="text-emerald-600 dark:text-emerald-400" />
        <MetaItem icon={Calendar}   label="Fecha límite" value={request.deadline} />
        <MetaItem icon={User}       label="Creado por"   value={request.created_by_email} />
      </div>
    </Card>
  )
}

function ProposalList({ request, onAward, onClose }) {
  const [awardingId, setAwardingId] = useState(null)
  const [closing, setClosing] = useState(false)
  const proposals = request.proposals || []

  const handleAward = async (proposalId) => {
    setAwardingId(proposalId)
    await onAward(proposalId)
    setAwardingId(null)
  }

  const handleClose = async () => {
    setClosing(true)
    await onClose()
    setClosing(false)
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-base font-semibold text-slate-800 dark:text-white">
          Propuestas{' '}
          <span className="text-slate-400 dark:text-slate-500 font-normal text-sm">
            ({proposals.length})
          </span>
        </h2>
        {request.status === 'open' && (
          <Button variant="outline" size="sm" onClick={handleClose} disabled={closing} loading={closing}>
            Cerrar Solicitud
          </Button>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {proposals.length === 0 && (
          <EmptyState
            icon="📩"
            title="Sin propuestas"
            description="Los proveedores aún no han enviado propuestas para esta solicitud."
          />
        )}

        {proposals.map((p) => (
          <div key={p.id} className="flex justify-between items-start px-6 py-4 gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {p.supplier_email?.[0]?.toUpperCase() ?? 'S'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {p.supplier_email}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ${Number(p.price).toLocaleString()}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {p.delivery_time} días
                  </span>
                </div>
                {p.message && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                    {p.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <Badge status={p.status} />
              {request.status === 'open' && p.status === 'pending' && (
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={() => handleAward(p.id)}
                  disabled={awardingId === p.id}
                  loading={awardingId === p.id}
                >
                  <CheckCircle2 size={13} />
                  Adjudicar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ProposalForm({ requestId, onSubmitted }) {
  const { values, handleChange, reset } = useForm(PROPOSAL_DEFAULTS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await procurementAPI.submitProposal(requestId, values)
      reset()
      setSuccess(true)
      onSubmitted()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">
        Enviar Propuesta
      </h3>
      <Alert type="success" message={success ? '¡Propuesta enviada exitosamente!' : null} />
      <Alert message={error} onDismiss={() => setError(null)} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FieldRow label="Precio (USD)" required>
          <Input name="price" type="number" required min="0.01" step="0.01" placeholder="Tu precio total" value={values.price} onChange={handleChange} />
        </FieldRow>
        <FieldRow label="Tiempo de entrega (días)" required>
          <Input name="delivery_time" type="number" required min="1" placeholder="Número de días" value={values.delivery_time} onChange={handleChange} />
        </FieldRow>
        <FieldRow label="Mensaje">
          <Textarea name="message" placeholder="¿Por qué elegirnos? Experiencia relevante…" value={values.message} onChange={handleChange} rows={3} />
        </FieldRow>
        <Button type="submit" className="w-full mt-1" loading={submitting}>
          Enviar Propuesta
        </Button>
      </form>
    </Card>
  )
}

function MyProposalCard({ proposal }) {
  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Tu Propuesta</h3>
      <div className="flex flex-col gap-3">
        <MetaItem icon={DollarSign} label="Precio"   value={`$${Number(proposal.price).toLocaleString()}`} valueClass="text-emerald-600 dark:text-emerald-400" />
        <MetaItem icon={Clock}      label="Entrega"  value={`${proposal.delivery_time} días`} />
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Estado</p>
          <Badge status={proposal.status} />
        </div>
        {proposal.message && (
          <div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Mensaje</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{proposal.message}</p>
          </div>
        )}
      </div>
    </Card>
  )
}

function ClosedStatusCard({ status }) {
  return (
    <Card className="p-5 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-3 mb-2">
        <Package size={18} className="text-slate-400 dark:text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Estado</h3>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Esta solicitud está{' '}
        <strong className="text-slate-700 dark:text-slate-200 capitalize">{status}</strong>{' '}
        y ya no acepta propuestas.
      </p>
    </Card>
  )
}

function MetaItem({ icon: Icon, label, value, valueClass = '' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide flex items-center gap-1">
        {Icon && <Icon size={11} />}
        {label}
      </span>
      <span className={`text-sm font-semibold text-slate-800 dark:text-slate-100 ${valueClass}`}>
        {value}
      </span>
    </div>
  )
}

function FieldRow({ label, required, children }) {
  return (
    <div>
      <Label className="mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

function SkeletonDetail() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="flex flex-col gap-5">
        <Card className="p-6">
          <div className="flex justify-between mb-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-6 w-64" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2 mb-6">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className="flex gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <Skeleton className="h-5 w-32" />
          </div>
          {[1, 2].map(i => (
            <div key={i} className="flex items-start gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
              <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </Card>
    </div>
  )
}
