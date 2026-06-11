'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Count {
  opBezAktivity: number
  nesplneneUkoly: number
  noveOP: number
  unreadNotifications: number
}

interface NotifData {
  opBezAktivity: { id: string; kod: string | null; klient: string; dniBezAktivity: number | null }[]
  nesplneneUkoly: { id: string; popis: string; datum: string; dealId: string; dealKod: string | null; dealPredmet: string | null }[]
  noveOP: { id: string; kod: string | null; klient: string; technologie: string; stav: string }[]
}

interface DbNotification {
  id: string
  typ: string
  zprava: string
  precteno: boolean
  dealId: string | null
  klientId: string | null
  url: string | null
  createdAt: string
}

const techLabels: Record<string, string> = {
  KLIMA: 'Klimatizace', TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  REKUPERACE: 'Rekuperace', PODLAHOVE_TOPENI: 'Podlahové topení',
  VZDUCHOTECHNIKA: 'Vzduchotechnika', JINE: 'Jiné',
}

function isReminderDay() {
  const d = new Date().getDay()
  return d === 1 || d === 3 || d === 5
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'právě teď'
  if (mins < 60) return `před ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `před ${hours} hod`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'včera'
  return `před ${days} dny`
}

function typIcon(typ: string): string {
  if (typ.includes('OP') || typ.includes('DEAL')) return '📋'
  if (typ.includes('NABIDKA') || typ.includes('QUOTE')) return '📄'
  if (typ.includes('SERVIS')) return '🔧'
  if (typ.includes('UKOL') || typ.includes('TASK')) return '✅'
  return '🔔'
}

export default function NotificationBell() {
  const router = useRouter()
  const [count, setCount] = useState<Count | null>(null)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<NotifData | null>(null)
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchCount = useCallback(() => {
    fetch('/api/notifications/count')
      .then(r => r.json())
      .then(setCount)
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCount()
  }, [fetchCount])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    setOpen(o => !o)
    if (!data && !loadingList) {
      setLoadingList(true)
      Promise.all([
        fetch('/api/notifications/list').then(r => r.json()),
        fetch('/api/notifications/db').then(r => r.json()),
      ])
        .then(([listData, dbData]) => {
          setData(listData)
          setDbNotifications(Array.isArray(dbData) ? dbData : [])
        })
        .finally(() => setLoadingList(false))
    }
  }

  async function handleMarkAllRead() {
    if (markingAll) return
    setMarkingAll(true)
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' })
      setDbNotifications(prev => prev.map(n => ({ ...n, precteno: true })))
      setCount(prev => prev ? { ...prev, unreadNotifications: 0 } : prev)
    } finally {
      setMarkingAll(false)
    }
  }

  async function handleNotificationClick(notification: DbNotification) {
    if (!notification.precteno) {
      await fetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' })
      setDbNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, precteno: true } : n)
      )
      setCount(prev => prev
        ? { ...prev, unreadNotifications: Math.max(0, prev.unreadNotifications - 1) }
        : prev
      )
    }

    if (notification.dealId) {
      router.push(`/deals/${notification.dealId}`)
    } else if (notification.klientId) {
      router.push(`/clients/${notification.klientId}`)
    } else if (notification.url) {
      router.push(notification.url)
    }

    setOpen(false)
  }

  const computedTotal = (count?.opBezAktivity ?? 0) + (count?.nesplneneUkoly ?? 0)
  const unreadCount = count?.unreadNotifications ?? 0
  const badgeCount = computedTotal + unreadCount
  const isActive = isReminderDay()
  const badgeClass = isActive && badgeCount > 0
    ? 'bg-[#4CAF50] text-white'
    : badgeCount > 0
      ? 'bg-gray-400 text-white'
      : 'bg-gray-300 text-gray-600'

  const hasUnreadDbNotifs = dbNotifications.some(n => !n.precteno)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-green-300/60 hover:bg-[#E8F5E9] dark:hover:bg-green-900/30 transition-colors"
        title="Notifikace"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {badgeCount > 0 && (
          <span className={`absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${badgeClass}`}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-[#0D1A0E] rounded-xl border border-[#C8E6C9] dark:border-green-900/50 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#C8E6C9] dark:border-green-900/50 flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              Notifikace{unreadCount > 0 && <span className="ml-1 text-[#4CAF50]">({unreadCount})</span>}
            </span>
            <div className="flex items-center gap-3">
              {hasUnreadDbNotifs && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-xs transition-colors disabled:opacity-50"
                  style={{ color: '#6B8C6B' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#4CAF50')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6B8C6B')}
                >
                  {markingAll ? 'Označuji…' : 'Označit vše ✓'}
                </button>
              )}
              <div className="flex gap-3 text-xs text-gray-500 dark:text-slate-400">
                <span>OP: <strong className="text-gray-900 dark:text-white">{count?.opBezAktivity ?? '…'}</strong></span>
                <span>Úkoly: <strong className="text-gray-900 dark:text-white">{count?.nesplneneUkoly ?? '…'}</strong></span>
              </div>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loadingList && (
              <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">Načítám…</div>
            )}

            {!loadingList && (
              <>
                {/* DB Notifications */}
                {dbNotifications.length > 0 && (
                  <div>
                    {dbNotifications.map(n => {
                      const isClickable = !!(n.dealId || n.klientId || n.url)
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className="px-4 py-3 transition-colors border-b border-gray-50 dark:border-green-900/20"
                          style={{
                            cursor: isClickable ? 'pointer' : 'default',
                            borderLeft: n.precteno ? 'none' : '3px solid #4CAF50',
                            background: n.precteno ? 'transparent' : 'rgba(76,175,80,0.05)',
                            opacity: n.precteno ? 0.7 : 1,
                          }}
                          onMouseEnter={e => {
                            if (isClickable) (e.currentTarget as HTMLDivElement).style.background = 'rgba(76,175,80,0.08)'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLDivElement).style.background = n.precteno ? 'transparent' : 'rgba(76,175,80,0.05)'
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="flex-shrink-0 mt-1">
                                {n.precteno
                                  ? <span className="text-sm">{typIcon(n.typ)}</span>
                                  : <span className="inline-block w-2 h-2 rounded-full bg-[#4CAF50]" />
                                }
                              </span>
                              <div className="min-w-0">
                                <p className={`text-sm leading-snug ${n.precteno ? 'font-normal text-gray-600 dark:text-slate-400' : 'font-semibold text-gray-900 dark:text-white'}`}>
                                  {n.zprava}
                                </p>
                                {n.dealId && (
                                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">OP · {n.dealId.slice(-8)}</p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0 whitespace-nowrap">
                              {relativeTime(n.createdAt)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {data && (
                  <>
                    {/* OP bez aktivity */}
                    {data.opBezAktivity.length > 0 && (
                      <div>
                        <p className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-green-300/50 uppercase tracking-wide bg-[#F4FAF4] dark:bg-[#1A2E1B]/50">
                          OP bez aktivity ({data.opBezAktivity.length})
                        </p>
                        {data.opBezAktivity.map(d => (
                          <Link
                            key={d.id}
                            href={`/deals/${d.id}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {d.kod && <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 px-1.5 py-0.5 rounded flex-shrink-0">{d.kod}</span>}
                              <span className="text-sm text-gray-800 dark:text-slate-200 truncate">{d.klient}</span>
                            </div>
                            <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0 ml-2">
                              {d.dniBezAktivity != null ? `${d.dniBezAktivity} dní` : 'nikdy'}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Nesplněné úkoly */}
                    {data.nesplneneUkoly.length > 0 && (
                      <div>
                        <p className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-green-300/50 uppercase tracking-wide bg-[#F4FAF4] dark:bg-[#1A2E1B]/50">
                          Nesplněné úkoly ({data.nesplneneUkoly.length})
                        </p>
                        {data.nesplneneUkoly.map(u => (
                          <Link
                            key={u.id}
                            href={`/deals/${u.dealId}?tab=aktivity`}
                            onClick={() => setOpen(false)}
                            className="flex items-start justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 dark:text-slate-200 line-clamp-1">{u.popis}</p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {u.dealKod ? `${u.dealKod} · ` : ''}{u.dealPredmet ?? 'OP'}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0 ml-2 mt-0.5">
                              {new Date(u.datum).toLocaleDateString('cs-CZ')}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Nové OP */}
                    {data.noveOP.length > 0 && (
                      <div>
                        <p className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-green-300/50 uppercase tracking-wide bg-[#F4FAF4] dark:bg-[#1A2E1B]/50">
                          Nové OP za 24h ({data.noveOP.length})
                        </p>
                        {data.noveOP.map(d => (
                          <Link
                            key={d.id}
                            href={`/deals/${d.id}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {d.kod && <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 px-1.5 py-0.5 rounded flex-shrink-0">{d.kod}</span>}
                              <span className="text-sm text-gray-800 dark:text-slate-200 truncate">{d.klient}</span>
                              <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">{techLabels[d.technologie] ?? d.technologie}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {dbNotifications.length === 0 && data.opBezAktivity.length === 0 && data.nesplneneUkoly.length === 0 && data.noveOP.length === 0 && (
                      <div className="px-4 py-8 text-center">
                        <svg className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <p className="text-sm text-gray-400 dark:text-slate-500">Žádné nové notifikace</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
