'use client'

import Link from 'next/link'

interface Props {
  used: number
  limit: number
  label: string // e.g. "obchodních případů"
}

export default function UpgradeBanner({ used, limit, label }: Props) {
  if (limit === Infinity || limit === 0) return null
  const pct = used / limit
  if (pct < 0.75) return null

  const atLimit = used >= limit
  const bg = atLimit
    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
  const text = atLimit
    ? 'text-red-800 dark:text-red-300'
    : 'text-yellow-800 dark:text-yellow-300'
  const link = atLimit
    ? 'text-red-900 dark:text-red-200'
    : 'text-yellow-900 dark:text-yellow-200'

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${bg} ${text}`}>
      <span>
        {atLimit ? (
          <>Dosáhli jste limitu <strong>{used}/{limit}</strong> {label}. Nelze přidávat další.</>
        ) : (
          <>Využíváte <strong>{used}/{limit}</strong> {label}. Brzy dosáhnete limitu Starter plánu.</>
        )}
      </span>
      <Link
        href="/settings/billing"
        className={`ml-4 shrink-0 font-semibold underline hover:no-underline ${link}`}
      >
        Upgradovat →
      </Link>
    </div>
  )
}
