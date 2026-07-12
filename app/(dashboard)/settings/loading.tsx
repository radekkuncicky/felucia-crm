import { SkeletonPageHeader, SkeletonCard } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
