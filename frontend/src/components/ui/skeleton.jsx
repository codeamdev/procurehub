import { cn } from './utils'

function Skeleton({ className, ...props }) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
