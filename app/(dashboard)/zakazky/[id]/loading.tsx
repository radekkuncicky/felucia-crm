import { SkeletonCard } from '@/components/ui/Skeleton'

// Uvnitř layoutu zakázky (hlavička + taby zůstávají) — jen obsah tabu
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Načítání">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}
