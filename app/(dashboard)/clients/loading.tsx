import { Skeleton, SkeletonPageHeader, SkeletonTable } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <Skeleton className="h-9 w-64" />
      <SkeletonTable rows={10} />
    </div>
  )
}
