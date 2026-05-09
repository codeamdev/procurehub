import { useContext } from 'react'
import { OTPInput, OTPInputContext } from 'input-otp'
import { Minus } from 'lucide-react'
import { cn } from './utils'

function InputOTP({ className, containerClassName, ...props }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn('flex items-center gap-2 has-disabled:opacity-50', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn('flex items-center gap-1', className)}
      {...props}
    />
  )
}

function InputOTPSlot({ index, className, ...props }) {
  const inputOTPContext = useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        'data-[active=true]:border-blue-400 dark:data-[active=true]:border-blue-500 data-[active=true]:ring-2 data-[active=true]:ring-blue-500/30 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 relative flex h-9 w-9 items-center justify-center border-y border-r text-sm transition-all outline-none first:rounded-l-lg first:border-l last:rounded-r-lg data-[active=true]:z-10',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-slate-800 dark:bg-slate-100 h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ ...props }) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <Minus />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
