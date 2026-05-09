import { Search, GitBranch, Play } from 'lucide-react'
import Alert from '../components/ui/Alert'
import EmptyState from '../components/ui/EmptyState'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'

export default function WorkflowsView({
  workflows = [],
  loading = false,
  error = null,
  starting = null,
  searchQuery = '',
  onSearchChange,
  onStart,
  totalCount = 0,
}) {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Workflows</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Inicia y gestiona tus flujos de aprobación
        </p>
      </div>

      <Alert message={error} />

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        <Input
          type="text"
          placeholder="Buscar workflow..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && <div className="skeleton-fade"><SkeletonGrid /></div>}

      {!loading && workflows.length === 0 && (
        <EmptyState
          icon={searchQuery ? '🔍' : '⚙️'}
          title={searchQuery ? 'Sin resultados' : 'Sin workflows definidos'}
          description={
            searchQuery
              ? `No hay workflows con "${searchQuery}".`
              : 'Contacta a tu admin para configurar plantillas de workflow.'
          }
        />
      )}

      {!loading && workflows.length > 0 && (
        <>
          <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))' }}>
            {workflows.map(wf => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                isStarting={starting === wf.id}
                onStart={() => onStart(wf.id)}
              />
            ))}
          </div>
          {searchQuery && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {workflows.length} resultado{workflows.length !== 1 ? 's' : ''} (de {totalCount})
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function WorkflowCard({ workflow, isStarting, onStart }) {
  const stepCount = workflow.steps?.length ?? 0
  return (
    <Card className="p-6 hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <GitBranch size={20} className="text-violet-500 dark:text-violet-400" />
        </div>
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 rounded-full">
          {stepCount} paso{stepCount !== 1 ? 's' : ''}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1.5 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-1">
        {workflow.name}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">
        {workflow.description || 'Sin descripción.'}
      </p>

      <div className="flex justify-end">
        <Button variant="violet" size="sm" onClick={onStart} disabled={isStarting}>
          <Play size={12} />
          {isStarting ? 'Iniciando…' : 'Iniciar'}
        </Button>
      </div>
    </Card>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-6">
          <div className="flex items-start justify-between mb-4">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/4 mb-2" />
          <div className="space-y-1.5 mb-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </Card>
      ))}
    </div>
  )
}
