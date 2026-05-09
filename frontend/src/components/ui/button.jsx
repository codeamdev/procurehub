import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from './utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer',
  {
    variants: {
      variant: {
        default:     'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
        primary:     'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
        secondary:   'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
        outline:     'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
        ghost:       'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
        violet:      'bg-violet-600 text-white hover:bg-violet-700 shadow-sm',
        emerald:     'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
        success:     'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
        danger:      'bg-red-600 text-white hover:bg-red-700 shadow-sm',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 px-3 text-xs',
        md:      'h-9 px-4 py-2',
        lg:      'h-10 px-6',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({ className, variant, size, asChild = false, loading = false, children, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? 'Cargando…' : children}
    </Comp>
  )
}

export { Button, buttonVariants }
export default Button
