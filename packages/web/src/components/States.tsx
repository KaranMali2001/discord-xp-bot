import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

/**
 * Loading placeholder for list/table sections — a stack of shimmer rows that
 * roughly matches the height of a populated row, so the layout doesn't jump.
 */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static placeholder
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

/**
 * Composed empty state — a de-emphasised icon, a short title, and an optional
 * hint on how to populate the section. Replaces bare "Nothing here yet" text.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon?: LucideIcon
  title: string
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Inline error line for a failed section fetch. */
export function ErrorState({ message, className }: { message: string; className?: string }) {
  return <p className={cn('text-sm text-destructive', className)}>{message}</p>
}
