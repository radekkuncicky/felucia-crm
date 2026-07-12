'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/format'

interface HistoryItem {
  date: string
  type: string
  label: string
  sub: string
  href: string
  icon: string
}

export default function ClientHistory({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
        Žádná historie.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-100">
        {history.map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className="flex items-start gap-4 px-6 py-4 hover:bg-blue-50 transition-colors group"
          >
            <div className="text-xl flex-shrink-0 mt-0.5 w-8 text-center">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 line-clamp-2">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
            </div>
            <div className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap mt-0.5">
              {formatDate(item.date)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
