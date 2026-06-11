import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="hidden sm:block h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <Skeleton className="h-5 w-5 mb-3" />
            <Skeleton className="h-8 w-16 mb-1.5" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <SkeletonCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
