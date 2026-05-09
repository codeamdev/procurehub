import { createContext, useContext, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from './utils'

const DialogContext = createContext(null)

function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onOpenChange?.(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({ asChild, children, ...props }) {
  const ctx = useContext(DialogContext)
  const child = asChild ? children : <button {...props}>{children}</button>
  return (
    <span onClick={() => ctx?.onOpenChange?.(true)} style={{ display: 'contents' }}>
      {child}
    </span>
  )
}

function DialogPortal({ children }) {
  return <>{children}</>
}

function DialogClose({ asChild, children, className, ...props }) {
  const ctx = useContext(DialogContext)
  if (asChild) {
    return (
      <span onClick={() => ctx?.onOpenChange?.(false)} style={{ display: 'contents' }}>
        {children}
      </span>
    )
  }
  return (
    <button
      onClick={() => ctx?.onOpenChange?.(false)}
      className={cn('', className)}
      {...props}
    >
      {children}
    </button>
  )
}

function DialogOverlay({ className, ...props }) {
  const ctx = useContext(DialogContext)
  if (!ctx?.open) return null
  return (
    <div
      data-slot="dialog-overlay"
      className={cn('fixed inset-0 z-50 bg-black/50 animate-in fade-in-0', className)}
      onClick={() => ctx?.onOpenChange?.(false)}
      {...props}
    />
  )
}

function DialogContent({ className, children, ...props }) {
  const ctx = useContext(DialogContext)
  if (!ctx?.open) return null

  return (
    <>
      <DialogOverlay />
      <div
        data-slot="dialog-content"
        className={cn(
          'bg-white dark:bg-slate-900 fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-slate-100 dark:border-slate-800 p-6 shadow-lg animate-in fade-in-0 zoom-in-95',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        <button
          onClick={() => ctx?.onOpenChange?.(false)}
          className="absolute top-4 right-4 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={16} />
          <span className="sr-only">Cerrar</span>
        </button>
      </div>
    </>
  )
}

function DialogHeader({ className, ...props }) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn('text-lg font-semibold leading-none text-slate-800 dark:text-white', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }) {
  return (
    <p
      data-slot="dialog-description"
      className={cn('text-sm text-slate-500 dark:text-slate-400', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
