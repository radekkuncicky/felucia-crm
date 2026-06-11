import { Skeleton, SkeletonPageHeader, SkeletonTable } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
      <SkeletonTable rows={10} />
    </div>
  )
}
