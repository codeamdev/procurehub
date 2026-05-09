import { createContext, useContext, useState } from 'react'
import { cn } from './utils'

const TabsContext = createContext(null)

function Tabs({ defaultValue, value: controlledValue, onValueChange, className, children, ...props }) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const onChange = (v) => {
    if (!isControlled) setInternalValue(v)
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div data-slot="tabs" className={cn('flex flex-col gap-2', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }) {
  return (
    <div
      data-slot="tabs-list"
      className={cn(
        'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 inline-flex h-9 w-fit items-center justify-center rounded-xl p-[3px]',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ value, className, children, ...props }) {
  const ctx = useContext(TabsContext)
  const isActive = ctx?.value === value

  return (
    <button
      data-slot="tabs-trigger"
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => ctx?.onChange(value)}
      className={cn(
        'inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors',
        isActive
          ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm border-slate-200 dark:border-slate-700'
          : 'hover:text-slate-700 dark:hover:text-slate-200',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({ value, className, ...props }) {
  const ctx = useContext(TabsContext)
  if (ctx?.value !== value) return null

  return (
    <div
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
