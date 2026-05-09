import { cn } from './utils'

function Switch({ className, checked, defaultChecked, onCheckedChange, onChange, disabled, id, ...props }) {
  const handleChange = (e) => {
    onCheckedChange?.(e.target.checked)
    onChange?.(e)
  }

  return (
    <label
      data-slot="switch"
      className={cn(
        'relative inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
        'has-[:checked]:bg-blue-600 bg-slate-200 dark:bg-slate-700',
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
      <span
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform',
          'peer-checked:translate-x-[calc(100%-2px)] translate-x-0',
        )}
      />
    </label>
  )
}

export { Switch }
