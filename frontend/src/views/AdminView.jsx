import { Search, RefreshCw, CheckCircle2, XCircle, Users, Clock, UserCheck } from 'lucide-react'
import Alert from '../components/ui/Alert'
import EmptyState from '../components/ui/EmptyState'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'

export default function AdminView({
  suppliers = [],
  loading = false,
  error = null,
  actionError = null,
  actingId = null,
  searchQuery = '',
  onSearchChange,
  onApprove,
  onReject,
  onRefresh,
  onDismissError,
  totalCount = 0,
  pendingCount = 0,
  approvedCount = 0,
}) {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Aprobación de Proveedores
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Proveedores pendientes de acceso al marketplace.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total"      value={totalCount}    icon={Users}     color="blue" />
        <StatCard label="Pendientes" value={pendingCount}  icon={Clock}     color="amber" />
        <StatCard label="Aprobados"  value={approvedCount} icon={UserCheck} color="emerald" />
      </div>

      <Alert message={actionError} onDismiss={onDismissError} />
      <Alert message={error} />

      {/* Table card */}
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            <Input
              type="text"
              placeholder="Buscar por email..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-6">Proveedor</th>
                <th className="py-3 px-6">Estado</th>
                <th className="py-3 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading && <SkeletonRows />}

              {!loading && suppliers.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <EmptyState
                      icon={searchQuery ? '🔍' : '✅'}
                      title={searchQuery ? 'Sin resultados' : 'Sin aprobaciones pendientes'}
                      description={
                        searchQuery
                          ? `No se encontró ningún proveedor con "${searchQuery}".`
                          : 'Todas las solicitudes han sido procesadas.'
                      }
                    />
                  </td>
                </tr>
              )}

              {!loading && suppliers.map(s => (
                <SupplierRow
                  key={s.id}
                  supplier={s}
                  isActing={actingId === s.id}
                  onApprove={() => onApprove(s.id)}
                  onReject={() => onReject(s.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && suppliers.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''}
              {searchQuery ? ` (filtrado de ${totalCount})` : ''}
            </span>
          </div>
        )}
      </Card>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20',    icon: 'text-blue-600 dark:text-blue-400' },
    amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',  icon: 'text-amber-600 dark:text-amber-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400' },
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

function StatusBadge({ approved }) {
  if (approved) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Aprobado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Pendiente
    </span>
  )
}

function SupplierRow({ supplier, isActing, onApprove, onReject }) {
  return (
    <tr className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="py-3 px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            {supplier.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-200">{supplier.email}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Proveedor · ID #{supplier.id}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-6">
        <StatusBadge approved={supplier.is_approved} />
      </td>
      <td className="py-3 px-6">
        <div className="flex items-center justify-end gap-2">
          {!supplier.is_approved ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onApprove}
                disabled={isActing}
                className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
              >
                <CheckCircle2 size={14} />
                {isActing ? 'Procesando…' : 'Aprobar'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReject}
                disabled={isActing}
                className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40"
              >
                <XCircle size={14} />
                Rechazar
              </Button>
            </>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500 italic">Sin acciones</span>
          )}
        </div>
      </td>
    </tr>
  )
}

function SkeletonRows() {
  return Array.from({ length: 4 }).map((_, i) => (
    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
      <td className="py-3 px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      </td>
      <td className="py-3 px-6">
        <Skeleton className="h-5 w-20 rounded-full" />
      </td>
      <td className="py-3 px-6">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      </td>
    </tr>
  ))
}
