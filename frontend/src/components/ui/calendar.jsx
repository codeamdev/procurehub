import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { cn } from './utils'
import { buttonVariants } from './button'

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium text-slate-800 dark:text-white',
        nav: 'flex items-center gap-1',
        nav_button: cn(buttonVariants({ variant: 'outline' }), 'size-7 bg-transparent p-0 opacity-50 hover:opacity-100'),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-x-1',
        head_row: 'flex',
        head_cell: 'text-slate-400 dark:text-slate-500 rounded-md w-8 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-blue-50 dark:[&:has([aria-selected])]:bg-blue-900/20',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
        ),
        day: cn(buttonVariants({ variant: 'ghost' }), 'size-8 p-0 font-normal aria-selected:opacity-100'),
        day_range_start: 'day-range-start aria-selected:bg-blue-600 aria-selected:text-white',
        day_range_end: 'day-range-end aria-selected:bg-blue-600 aria-selected:text-white',
        day_selected: 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white',
        day_today: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
        day_outside: 'day-outside text-slate-300 dark:text-slate-600 aria-selected:text-slate-300',
        day_disabled: 'text-slate-300 dark:text-slate-600 opacity-50',
        day_range_middle: 'aria-selected:bg-blue-50 dark:aria-selected:bg-blue-900/20 aria-selected:text-blue-700 dark:aria-selected:text-blue-300',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: cls, ...rest }) => <ChevronLeft className={cn('size-4', cls)} {...rest} />,
        IconRight: ({ className: cls, ...rest }) => <ChevronRight className={cn('size-4', cls)} {...rest} />,
      }}
      {...props}
    />
  )
}

export { Calendar }
