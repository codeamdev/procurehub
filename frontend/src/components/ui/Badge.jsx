const COLORS = {
  open:        'bg-green-100 text-green-700',
  closed:      'bg-amber-100 text-amber-700',
  awarded:     'bg-blue-100 text-blue-700',
  pending:     'bg-slate-100 text-slate-500',
  accepted:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  admin:       'bg-violet-100 text-violet-700',
  buyer:       'bg-blue-100 text-blue-700',
  supplier:    'bg-amber-100 text-amber-700',
  approved:    'bg-green-100 text-green-700',
  unapproved:  'bg-amber-100 text-amber-700',
}

export default function Badge({ status, label, size = 'sm' }) {
  const colorClass = COLORS[status] || 'bg-slate-100 text-slate-500'
  const sizeClass = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
  return (
    <span className={`inline-block rounded-full font-bold uppercase tracking-wide whitespace-nowrap ${colorClass} ${sizeClass}`}>
      {label ?? status?.replace(/_/g, ' ')}
    </span>
  )
}
