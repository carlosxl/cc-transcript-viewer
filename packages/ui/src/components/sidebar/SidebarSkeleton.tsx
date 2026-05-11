import { Skeleton } from '@/components/ui/skeleton'

/** First-load loading state (D-31): 4 skeleton rows. */
export function SidebarSkeleton() {
  return (
    <div className="p-2" aria-label="Loading sessions" role="status">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[52px] mx-2 my-1 rounded-sm" />
      ))}
    </div>
  )
}
