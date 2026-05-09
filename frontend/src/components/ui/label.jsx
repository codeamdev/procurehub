import { cn } from './utils'

function Label({ className, ...props }) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide select-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
