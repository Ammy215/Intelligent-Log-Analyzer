import { cn } from '@/lib/utils'

export function Card({ className, interactive, padded = true, children, ...props }) {
  return (
    <div
      className={cn(interactive ? 'card-interactive' : 'card', padded && 'p-6', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, icon: Icon, iconClassName, children, ...props }) {
  return (
    <h3 className={cn('label-eyebrow flex items-center gap-2', className)} {...props}>
      {Icon && <Icon className={cn('w-4 h-4 text-accent-cyan', iconClassName)} />}
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p className={cn('text-xs text-text-secondary mt-1', className)} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div className={cn('flex items-center gap-3 mt-5 pt-5 border-t border-bg-border', className)} {...props}>
      {children}
    </div>
  )
}
