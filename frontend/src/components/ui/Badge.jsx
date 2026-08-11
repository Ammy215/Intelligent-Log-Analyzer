import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Severity/status are semantic-only variants — none of them reuse the
// brand accent (cyan), so a badge never gets mistaken for an interactive
// element. `neutral` is the only variant allowed to use cyan, for
// non-severity tags (e.g. counts, labels) that intentionally want the
// brand color.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        critical: 'bg-accent-red/10 text-accent-red border-accent-red/25',
        high: 'bg-accent-amber/10 text-accent-amber border-accent-amber/25',
        medium: 'bg-accent-info/10 text-accent-info border-accent-info/25',
        low: 'bg-text-secondary/10 text-text-secondary border-text-secondary/25',
        safe: 'bg-accent-green/10 text-accent-green border-accent-green/25',
        neutral: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/25',
        muted: 'bg-bg-tertiary text-text-secondary border-bg-border',
      },
      pulse: {
        true: 'pulse-critical',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'muted',
      pulse: false,
    },
  }
)

export default function Badge({ variant, pulse, className, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant, pulse }), className)} {...props}>
      {children}
    </span>
  )
}

export { badgeVariants }
