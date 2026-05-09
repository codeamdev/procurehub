import { Check } from 'lucide-react'
import { cn } from './utils'

function Checkbox({ className, checked, defaultChecked, onCheckedChange, onChange, disabled, id, ...props }) {
  const handleChange = (e) => {
    onCheckedChange?.(e.target.checked)
    onChange?.(e)
  }

  return (
    <label
      data-slot="checkbox"
      className={cn(
        'relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 transition-colors shadow-xs',
        'has-[:checked]:bg-blue-600 has-[:checked]:border-blue-600',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500/30',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={handleChange}
        className="sr-only peer"
        {...props}
      />
      <Check
        size={11}
        strokeWidth={3}
        className="text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
      />
    </label>
  )
}

export { Checkbox }
