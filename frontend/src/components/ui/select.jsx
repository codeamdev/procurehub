import { ChevronDown } from 'lucide-react'
import { cn } from './utils'

function Select({ className, children, ...props }) {
  return (
    <div data-slot="select" className="relative w-full">
      <select
        data-slot="select-trigger"
        className={cn(
          'w-full appearance-none px-3 py-2 pr-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 transition-colors outline-none',
          'focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-500',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        size={16}
      />
    </div>
  )
}

function SelectItem({ value, children, ...props }) {
  return (
    <option value={value} {...props}>
      {children}
    </option>
  )
}

function SelectGroup({ label, children }) {
  return <optgroup label={label}>{children}</optgroup>
}

export { Select, SelectItem, SelectGroup }
