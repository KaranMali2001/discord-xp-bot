import { cn } from '@/lib/utils'

/** Shimmering placeholder block. Size it with className to match the real content. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}
