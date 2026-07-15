import Link from 'next/link'
import { IconLock } from '@/components/ui/Icons'

export default function PlatinumGuard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <IconLock className="w-12 h-12 mb-4 text-gray-300 dark:text-slate-600" />
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Servisní modul je součástí plánu Platinum
      </h2>
      <p className="text-gray-500 dark:text-slate-400 max-w-md mb-6">
        Sledujte servisní kontrakty, plánujte návštěvy a automaticky připomínejte termíny.
      </p>
      <Link
        href="/settings/billing"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-colors"
      >
        Upgradovat na Platinum
      </Link>
    </div>
  )
}
