import { Link } from 'react-router-dom'
import { CheckCircle, Circle, Clock, Store, DollarSign, Calendar } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import Alert from '../components/ui/Alert'
import EmptyState from '../components/ui/EmptyState'

export function PendingApprovalState({ email }) {
  return (
    <div className="flex justify-center pt-12">
      <Card className="p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-5">⏳</div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-3">Esperando Aprobación</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
          Tu cuenta de proveedor (<strong className="text-slate-700 dark:text-slate-300">{email}</strong>) está siendo
          revisada por un administrador. Una vez aprobada podrás ver las solicitudes y enviar propuestas.
        </p>
        <div className="flex flex-col gap-3 text-left">
          <Step done label="Cuenta creada" />
          <Step active label="Revisión del administrador (en proceso)" />
          <Step label="Acceso concedido" />
        </div>
      </Card>
    </div>
  )
}

function Step({ label, done = false, active = false }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
      ) : active ? (
        <Clock size={20} className="text-blue-500 flex-shrink-0" />
      ) : (
        <Circle size={20} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
      )}
      <span className={`text-sm ${done || active ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
        {label}
      </span>
    </div>
  )
}

export function MarketplaceView({ requests, loading, error }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-blue-500 to-violet-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <Store size={20} className="opacity-90" />
          <h1 className="text-xl font-bold">Marketplace de Proveedores</h1>
        </div>
        <p className="text-blue-100 text-sm">Explora solicitudes abiertas y envía tus propuestas.</p>
      </div>

      {/* Error */}
      <Alert type="error" message={error} />

      {/* Skeleton */}
      {loading && (
        <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex justify-between mb-3">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-2/3 mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && requests?.length === 0 && (
        <EmptyState
          icon="🏪"
          title="Sin solicitudes abiertas"
          description="No hay solicitudes de compra disponibles por el momento. Vuelve pronto."
        />
      )}

      {/* Grid */}
      {!loading && !error && requests?.length > 0 && (
        <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))' }}>
          {requests.map((req) => <MarketplaceCard key={req.id} request={req} />)}
        </div>
      )}
    </div>
  )
}

function MarketplaceCard({ request }) {
  const desc = request.description || ''
  return (
    <Link
      to={`/requests/${request.id}`}
      className="block bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700 transition-all group no-underline"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2.5 py-1 rounded-full">
          {request.category}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
          <Calendar size={11} />
          {request.deadline}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-2">
        {request.title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-3">
        {desc.slice(0, 120)}{desc.length > 120 ? '…' : ''}
      </p>
      <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-800">
        <span className="flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
          <DollarSign size={13} />
          {Number(request.budget).toLocaleString()}
        </span>
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 group-hover:underline">
          Enviar propuesta →
        </span>
      </div>
    </Link>
  )
}
