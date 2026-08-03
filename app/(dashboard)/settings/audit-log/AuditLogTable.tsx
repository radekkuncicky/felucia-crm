'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/format'
import FilterDropdown from '@/components/ui/FilterDropdown'

interface LogRow {
  id: string
  typAkce: string
  typZaznamu: string
  zaznamId: string
  zaznamNazev: string
  userJmeno: string
  vytvoreno: string
}

interface Props {
  logs: LogRow[]
  total: number
  page: number
  pageSize: number
  users: { id: string; jmeno: string }[]
}

const akceLabels: Record<string, { label: string; cls: string }> = {
  CREATE: { label: 'Vytvoření', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  UPDATE: { label: 'Úprava', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  DELETE: { label: 'Smazání', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
}

const zaznamLinks: Record<string, (id: string) => string> = {
  Deal: (id) => `/deals/${id}`,
  Client: (id) => `/clients/${id}`,
}

export default function AuditLogTable({ logs, total, page, pageSize, users }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  function filter(key: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.set('page', '1')
    router.push('?' + params.toString())
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const userOptions = [
    { value: '', label: 'Všichni uživatelé' },
    ...users.map(u => ({ value: u.id, label: u.jmeno })),
  ]
  const akceOptions = [
    { value: '', label: 'Všechny akce' },
    { value: 'CREATE', label: 'Vytvoření' },
    { value: 'UPDATE', label: 'Úprava' },
    { value: 'DELETE', label: 'Smazání' },
  ]
  const zaznamOptions = [
    { value: '', label: 'Všechny záznamy' },
    { value: 'Deal', label: 'Obchodní případ' },
    { value: 'Client', label: 'Klient' },
    { value: 'Quote', label: 'Nabídka' },
    { value: 'Activity', label: 'Aktivita' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <FilterDropdown value={sp.get('user') ?? ''} onChange={v => filter('user', v)} options={userOptions} />
        <FilterDropdown value={sp.get('akce') ?? ''} onChange={v => filter('akce', v)} options={akceOptions} />
        <FilterDropdown value={sp.get('zaznam') ?? ''} onChange={v => filter('zaznam', v)} options={zaznamOptions} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 whitespace-nowrap">Provedeno</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 whitespace-nowrap">Uživatel</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 whitespace-nowrap">Typ akce</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 whitespace-nowrap">Typ záznamu</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3">Záznam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">Žádné záznamy</td></tr>
              )}
              {logs.map(log => {
                const akce = akceLabels[log.typAkce] ?? { label: log.typAkce, cls: 'bg-gray-100 text-gray-600' }
                const href = zaznamLinks[log.typZaznamu]?.(log.zaznamId)
                return (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-slate-400">
                      {formatDateTime(log.vytvoreno)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{log.userJmeno}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${akce.cls}`}>{akce.label}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-slate-400">{log.typZaznamu}</td>
                    <td className="px-4 py-3 text-sm">
                      {href ? (
                        <Link href={href} className="text-blue-600 hover:underline dark:text-blue-400 font-medium">{log.zaznamNazev}</Link>
                      ) : (
                        <span className="text-gray-700 dark:text-slate-300">{log.zaznamNazev}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
          <span>Celkem: {total} záznamů</span>
          <div className="flex items-center gap-2">
            <span>Stránka {page} z {totalPages}</span>
            <button onClick={() => filter('page', String(Math.max(1, page - 1)))} disabled={page <= 1} className="w-6 h-6 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40">‹</button>
            <button onClick={() => filter('page', String(Math.min(totalPages, page + 1)))} disabled={page >= totalPages} className="w-6 h-6 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40">›</button>
          </div>
        </div>
      </div>
    </div>
  )
}
