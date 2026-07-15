'use client'

import { useState, useEffect } from 'react'
import ConfirmModal from '@/components/ConfirmModal'
import { WEBHOOK_EVENTS } from '@/lib/webhooks'
import { formatDate, formatDateTime } from '@/lib/format'

interface Webhook {
  id: string
  nazev: string
  url: string
  events: string[]
  aktivni: boolean
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastError: string | null
  vytvoreno: string
}

const ENTITY_LABELS: Record<string, string> = {
  client: 'Klienti',
  deal: 'Obchodní případy',
  zakazka: 'Zakázky',
  servisni_zakazka: 'Servisní zakázky',
  lead: 'Leady',
}

const ACTION_LABELS: Record<string, string> = {
  created: 'vytvoření',
  updated: 'změna',
  deleted: 'smazání',
}

export default function WebhooksManager() {
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [nazev, setNazev] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/settings/webhooks')
      .then(r => r.json())
      .then(data => { setHooks(data); setLoading(false) })
  }, [])

  function toggleEvent(ev: string) {
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])
  }

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: nazev.trim() || 'Bez názvu', url: url.trim(), events }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Vytvoření selhalo.')
        return
      }
      setNewSecret(data.secret)
      setHooks(prev => [{ ...data, lastSuccessAt: null, lastErrorAt: null, lastError: null }, ...prev])
      setShowForm(false)
      setNazev('')
      setUrl('')
      setEvents([])
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(hook: Webhook) {
    await fetch(`/api/settings/webhooks/${hook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktivni: !hook.aktivni }),
    })
    setHooks(prev => prev.map(h => h.id === hook.id ? { ...h, aktivni: !h.aktivni } : h))
  }

  async function deleteConfirm() {
    if (!deleteId) return
    await fetch(`/api/settings/webhooks/${deleteId}`, { method: 'DELETE' })
    setHooks(prev => prev.filter(h => h.id !== deleteId))
    setDeleteId(null)
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={deleteId !== null}
        title="Smazat webhook"
        message="Smazat tento webhook? Události se na jeho URL přestanou posílat."
        confirmLabel="Smazat webhook"
        danger
        onConfirm={deleteConfirm}
        onCancel={() => setDeleteId(null)}
      />

      {/* Nově vytvořený secret — jediné zobrazení */}
      {newSecret && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-2">Podpisový secret webhoooku (zobrazí se jen jednou):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700 rounded px-3 py-2 text-gray-900 dark:text-white break-all">
              {newSecret}
            </code>
            <button
              onClick={() => copySecret(newSecret)}
              className="shrink-0 px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              {copied ? 'Zkopírováno!' : 'Kopírovat'}
            </button>
          </div>
          <p className="text-xs text-green-700 dark:text-green-500 mt-2">
            Tímto secretem ověříte hlavičku <code className="font-mono">X-Felucia-Signature</code> (HMAC-SHA256 těla požadavku).
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Webhooky</h2>
          <button
            onClick={() => { setShowForm(true); setNewSecret(null) }}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg"
          >
            + Nový webhook
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
          Při vytvoření, změně nebo smazání záznamu pošleme POST s JSON na vaši URL.
          Doručení je podepsané hlavičkou <code className="font-mono">X-Felucia-Signature</code> a opakuje se až 5× při chybě.
        </p>

        {showForm && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Název</label>
              <input
                type="text"
                value={nazev}
                onChange={e => setNazev(e.target.value)}
                placeholder="např. Synchronizace do účetnictví"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">URL (https)</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://vase-aplikace.cz/webhooky/felucia"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">Události</label>
              <div className="space-y-2">
                {Object.entries(ENTITY_LABELS).map(([entity, label]) => (
                  <div key={entity} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="w-36 text-xs text-gray-600 dark:text-slate-400">{label}</span>
                    {(['created', 'updated', 'deleted'] as const).map(action => {
                      const ev = `${entity}.${action}`
                      if (!(WEBHOOK_EVENTS as readonly string[]).includes(ev)) return null
                      return (
                        <label key={ev} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={events.includes(ev)}
                            onChange={() => toggleEvent(ev)}
                            className="rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary"
                          />
                          {ACTION_LABELS[action]}
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={saving}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {saving ? 'Vytvářím…' : 'Vytvořit webhook'}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null) }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                Zrušit
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 py-4">Načítám…</p>
        ) : hooks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4">Žádné webhooky.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {hooks.map(hook => (
              <div key={hook.id} className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{hook.nazev}</p>
                    <code className="font-mono text-xs text-gray-500 dark:text-slate-400 break-all">{hook.url}</code>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {hook.events.length} událostí · vytvořen {formatDate(hook.vytvoreno)}
                      </span>
                      {hook.lastSuccessAt && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          · doručeno {formatDateTime(hook.lastSuccessAt)}
                        </span>
                      )}
                      {hook.lastError && (
                        <span className="text-xs text-red-500 dark:text-red-400" title={hook.lastErrorAt ? formatDateTime(hook.lastErrorAt) : undefined}>
                          · chyba: {hook.lastError}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hook.aktivni ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                      {hook.aktivni ? 'Aktivní' : 'Neaktivní'}
                    </span>
                    <button
                      onClick={() => toggleActive(hook)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white"
                    >
                      {hook.aktivni ? 'Deaktivovat' : 'Aktivovat'}
                    </button>
                    <button
                      onClick={() => setDeleteId(hook.id)}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
