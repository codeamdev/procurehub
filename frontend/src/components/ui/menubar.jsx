import * as MenubarPrimitive from '@radix-ui/react-menubar'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from './utils'

function Menubar({ className, ...props }) {
  return (
    <MenubarPrimitive.Root
      data-slot="menubar"
      className={cn(
        'bg-white dark:bg-slate-900 flex h-9 items-center gap-1 rounded-lg border border-slate-100 dark:border-slate-800 p-1 shadow-xs',
        className,
      )}
      {...props}
    />
  )
}

function MenubarMenu({ ...props }) {
  return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props} />
}

function MenubarGroup({ ...props }) {
  return <MenubarPrimitive.Group data-slot="menubar-group" {...props} />
}

function MenubarPortal({ ...props }) {
  return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props} />
}

function MenubarRadioGroup({ ...props }) {
  return <MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />
}

function MenubarTrigger({ className, ...props }) {
  return (
    <MenubarPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        'focus:bg-slate-50 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-slate-100 data-[state=open]:bg-slate-50 dark:data-[state=open]:bg-slate-800 flex items-center rounded-md px-2 py-1 text-sm font-medium outline-hidden select-none',
        className,
      )}
      {...props}
    />
  )
}

function MenubarContent({ className, align = 'start', alignOffset = -4, sideOffset = 8, ...props }) {
  return (
    <MenubarPortal>
      <MenubarPrimitive.Content
        data-slot="menubar-content"
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[12rem] overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 p-1 shadow-md',
          className,
        )}
        {...props}
      />
    </MenubarPortal>
  )
}

function MenubarItem({ className, inset, variant = 'default', ...props }) {
  return (
    <MenubarPrimitive.Item
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        'focus:bg-slate-50 dark:focus:bg-slate-800 data-[variant=destructive]:text-red-600 data-[variant=destructive]:focus:bg-red-50 relative flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

function MenubarCheckboxItem({ className, children, checked, ...props }) {
  return (
    <MenubarPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(
        'focus:bg-slate-50 dark:focus:bg-slate-800 relative flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <Check className="size-4" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  )
}

function MenubarRadioItem({ className, children, ...props }) {
  return (
    <MenubarPrimitive.RadioItem
      data-slot="menubar-radio-item"
      className={cn(
        'focus:bg-slate-50 dark:focus:bg-slate-800 relative flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>
  )
}

function MenubarLabel({ className, inset, ...props }) {
  return (
    <MenubarPrimitive.Label
      data-slot="menubar-label"
      data-inset={inset}
      className={cn('px-2 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide data-[inset]:pl-8', className)}
      {...props}
    />
  )
}

function MenubarSeparator({ className, ...props }) {
  return (
    <MenubarPrimitive.Separator
      data-slot="menubar-separator"
      className={cn('bg-slate-100 dark:bg-slate-800 -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function MenubarShortcut({ className, ...props }) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn('text-slate-400 dark:text-slate-500 ml-auto text-xs tracking-widest', className)}
      {...props}
    />
  )
}

function MenubarSub({ ...props }) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />
}

function MenubarSubTrigger({ className, inset, children, ...props }) {
  return (
    <MenubarPrimitive.SubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        'focus:bg-slate-50 dark:focus:bg-slate-800 data-[state=open]:bg-slate-50 dark:data-[state=open]:bg-slate-800 flex cursor-default items-center rounded-lg px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </MenubarPrimitive.SubTrigger>
  )
}

function MenubarSubContent({ className, ...props }) {
  return (
    <MenubarPrimitive.SubContent
      data-slot="menubar-sub-content"
      className={cn(
        'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[8rem] overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 p-1 shadow-lg',
        className,
      )}
      {...props}
    />
  )
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
}
