'use client'

import { useState, useEffect } from 'react'
import ConfirmModal from '@/components/ConfirmModal'
import { formatDate } from '@/lib/format'

interface ApiKey {
  id: string
  nazev: string
  klic: string
  aktivni: boolean
  allowedOrigins: string | null
  lastUsedAt: string | null
  vytvoreno: string
}

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [newKey, setNewKey] = useState<{ id: string; plain: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [nazev, setNazev] = useState('')
  const [origins, setOrigins] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/api-keys')
      .then(r => r.json())
      .then(data => { setKeys(data); setLoading(false) })
  }, [])

  async function generate() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: nazev.trim() || 'Bez názvu', allowedOrigins: origins.trim() || null }),
      })
      const data = await res.json()
      setNewKey({ id: data.id, plain: data.klicPlain })
      setKeys(prev => [{
        id: data.id,
        nazev: data.nazev,
        klic: data.klic,
        aktivni: data.aktivni,
        allowedOrigins: data.allowedOrigins,
        lastUsedAt: null,
        vytvoreno: data.vytvoreno,
      }, ...prev])
      setShowForm(false)
      setNazev('')
      setOrigins('')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(key: ApiKey) {
    await fetch(`/api/settings/api-keys/${key.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktivni: !key.aktivni }),
    })
    setKeys(prev => prev.map(k => k.id === key.id ? { ...k, aktivni: !k.aktivni } : k))
  }

  async function revokeKeyConfirm() {
    if (!revokeId) return
    await fetch(`/api/settings/api-keys/${revokeId}`, { method: 'DELETE' })
    setKeys(prev => prev.filter(k => k.id !== revokeId))
    if (newKey?.id === revokeId) setNewKey(null)
    setRevokeId(null)
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={revokeId !== null}
        title="Smazat API klíč"
        message="Smazat tento API klíč? Formuláře používající tento klíč přestanou fungovat."
        confirmLabel="Smazat klíč"
        danger
        onConfirm={revokeKeyConfirm}
        onCancel={() => setRevokeId(null)}
      />

      {/* Nově vygenerovaný klíč — jedinou zobrazení */}
      {newKey && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-2">Nový API klíč (zobrazí se jen jednou):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700 rounded px-3 py-2 text-gray-900 dark:text-white break-all">
              {newKey.plain}
            </code>
            <button
              onClick={() => copyToClipboard(newKey.plain, 'new')}
              className="shrink-0 px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              {copiedId === 'new' ? 'Zkopírováno!' : 'Kopírovat'}
            </button>
          </div>
          <p className="text-xs text-green-700 dark:text-green-500 mt-2">Uložte si tento klíč – již ho znovu nezobrazíme.</p>
        </div>
      )}

      {/* Seznam klíčů */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">API klíče organizace</h2>
          <button
            onClick={() => { setShowForm(true); setNewKey(null) }}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg"
          >
            + Nový klíč
          </button>
        </div>

        {/* Formulář nového klíče */}
        {showForm && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Název klíče</label>
              <input
                type="text"
                value={nazev}
                onChange={e => setNazev(e.target.value)}
                placeholder="např. Kontaktní formulář – homepage"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                Povolené origins <span className="text-gray-400 dark:text-slate-500 font-normal">(volitelné)</span>
              </label>
              <input
                type="text"
                value={origins}
                onChange={e => setOrigins(e.target.value)}
                placeholder="https://www.nanto.cz, https://eshop.nanto.cz"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Oddělte čárkou. Prázdné = povoleno vše.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generate}
                disabled={saving}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {saving ? 'Generuji…' : 'Vygenerovat klíč'}
              </button>
              <button
                onClick={() => { setShowForm(false); setNazev(''); setOrigins('') }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                Zrušit
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 py-4">Načítám…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4">Žádné API klíče. Vygenerujte první klíč.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {keys.map(key => (
              <div key={key.id} className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{key.nazev}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="font-mono text-xs text-gray-500 dark:text-slate-400">{key.klic}</code>
                      <span className="text-xs text-gray-300 dark:text-slate-600">·</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        Vytvořen {formatDate(key.vytvoreno)}
                      </span>
                      {key.lastUsedAt && (
                        <>
                          <span className="text-xs text-gray-300 dark:text-slate-600">·</span>
                          <span className="text-xs text-gray-400 dark:text-slate-500">
                            Naposledy použit {formatDate(key.lastUsedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${key.aktivni ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                      {key.aktivni ? 'Aktivní' : 'Neaktivní'}
                    </span>
                    <button
                      onClick={() => toggleActive(key)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white"
                    >
                      {key.aktivni ? 'Deaktivovat' : 'Aktivovat'}
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === key.id ? null : key.id)}
                      className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                    >
                      Ukázka
                    </button>
                    <button
                      onClick={() => setRevokeId(key.id)}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    >
                      Smazat
                    </button>
                  </div>
                </div>

                {/* Code snippet */}
                {expandedId === key.id && (
                  <div className="mt-3">
                    <CodeSnippet apiKey={key.klic.replace('…', '<váš-klíč>')} copiedId={copiedId} onCopy={copyToClipboard} keyId={key.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dokumentace */}
      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-3 text-sm">
        <p className="font-semibold text-gray-900 dark:text-white">Dokumentace — Public Leads API</p>
        <p className="text-gray-600 dark:text-slate-400">
          Endpoint: <code className="font-mono text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-0.5">POST https://app.felucia.io/api/public/leads</code>
        </p>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-700 dark:text-slate-300">Pole požadavku (JSON):</p>
          <ul className="text-xs text-gray-600 dark:text-slate-400 list-disc list-inside space-y-0.5">
            <li><code className="font-mono">jmeno</code> — povinné (nebo <code className="font-mono">firma</code>)</li>
            <li><code className="font-mono">prijmeni</code>, <code className="font-mono">telefon</code>, <code className="font-mono">email</code> — volitelné</li>
            <li><code className="font-mono">firma</code> — vytvoří klienta typu Firma</li>
            <li><code className="font-mono">zprava</code> — uloží se do poznámky klienta</li>
            <li><code className="font-mono">formType</code> — štítek formuláře (uloží se do poznámky), např. <code className="font-mono">&quot;kontakt&quot;</code>, <code className="font-mono">&quot;poptavka&quot;</code></li>
          </ul>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-500">
          Rate limit: 20 req / 10 min per IP, 200 req / hod per klíč.
        </p>
      </div>
    </div>
  )
}

function CodeSnippet({ apiKey, copiedId, onCopy, keyId }: {
  apiKey: string
  copiedId: string | null
  onCopy: (text: string, id: string) => void
  keyId: string
}) {
  const code = `fetch('https://app.felucia.io/api/public/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': '${apiKey}'
  },
  body: JSON.stringify({
    formType: 'kontakt',
    jmeno: jmeno,
    prijmeni: prijmeni,
    email: email,
    telefon: telefon,
    zprava: zprava
  })
})`

  return (
    <div className="relative">
      <pre className="text-xs font-mono bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto leading-relaxed">
        {code}
      </pre>
      <button
        onClick={() => onCopy(code, keyId)}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
      >
        {copiedId === keyId ? 'Zkopírováno!' : 'Kopírovat'}
      </button>
    </div>
  )
}
