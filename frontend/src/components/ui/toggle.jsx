import * as TogglePrimitive from '@radix-ui/react-toggle'
import { cva } from 'class-variance-authority'
import { cn } from './utils'

const toggleVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-slate-100 dark:data-[state=on]:bg-slate-800 data-[state=on]:text-slate-900 dark:data-[state=on]:text-slate-100 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900',
      },
      size: {
        default: 'h-9 px-2 min-w-9',
        sm: 'h-8 px-1.5 min-w-8',
        lg: 'h-10 px-2.5 min-w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Toggle({ className, variant, size, ...props }) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
