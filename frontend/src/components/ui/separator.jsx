import { cn } from './utils'

function Separator({ className, orientation = 'horizontal', decorative = true, ...props }) {
  return (
    <div
      data-slot="separator-root"
      role={decorative ? 'none' : 'separator'}
      aria-orientation={!decorative ? orientation : undefined}
      className={cn(
        'bg-slate-100 dark:bg-slate-800 shrink-0',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
