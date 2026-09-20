import { Skeleton, SkeletonPageHeader } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-4 max-w-3xl">
      <SkeletonPageHeader />
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
    </div>
  )
}
