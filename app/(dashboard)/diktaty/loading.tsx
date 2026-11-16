import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-4">
      <Skeleton className="h-8 w-64" />
      {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
    </div>
  )
}
