import { cn } from './utils'

function Avatar({ className, ...props }) {
  return (
    <div
      data-slot="avatar"
      className={cn('relative flex size-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

function AvatarImage({ className, src, alt = '', ...props }) {
  return (
    <img
      data-slot="avatar-image"
      src={src}
      alt={alt}
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  )
}

function AvatarFallback({ className, ...props }) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex size-full items-center justify-center rounded-full text-sm font-semibold',
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
