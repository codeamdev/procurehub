import { cn } from './utils'

function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-slate-100 dark:[&_tr]:border-slate-800', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }) {
  return (
    <tr
      data-slot="table-row"
      className={cn('hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 transition-colors', className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }) {
  return (
    <th
      data-slot="table-head"
      className={cn('text-slate-500 dark:text-slate-400 h-10 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider whitespace-nowrap', className)}
      {...props}
    />
  )
}

function TableCell({ className, ...props }) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-4 py-3 align-middle', className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-slate-400 dark:text-slate-500 mt-4 text-sm', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
