'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const TYP_LABELS: Record<string, string> = {
  TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  KLIMATIZACE: 'Klimatizace',
  REKUPERACE: 'Rekuperace',
  PODLAHOVE_VYTAPENI: 'Podlahové vytápění',
  VZDUCHOTECHNIKA: 'Vzduchotechnika',
  OHREV_TV: 'Ohřev TUV',
  JINE: 'Jiné',
}

const TYP_COLORS: Record<string, string> = {
  TEPELNE_CERPADLO: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  KLIMATIZACE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  REKUPERACE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  PODLAHOVE_VYTAPENI: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  VZDUCHOTECHNIKA: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  OHREV_TV: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  JINE: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
}

interface Zarizeni {
  id: string
  nazev: string
  typ: string
  vyrobniCislo: string | null
  datumInstalace: string | null
  zarukaDo: string | null
  aktivni: boolean
  vytvoreno: string
  qrToken: string | null
  klient: { id: string; jmeno: string; prijmeni: string }
  deal: { id: string; kod: string | null; predmet: string | null } | null
  servisniKontrakty: { id: string; nazev: string; typ: string; konec: string | null; cisloKontraktu: string | null }[]
  servisniZakazky: { planovanyTermin: string }[]
}

interface Client {
  id: string
  jmeno: string
  prijmeni: string
}

interface Props {
  zarizeni: Zarizeni[]
  clients: Client[]
}

interface NewZarizeniForm {
  klientId: string
  nazev: string
  typ: string
  vyrobniCislo: string
  datumInstalace: string
  zarukaDo: string
  poznamka: string
}

// QR Code Modal
function QrModal({ zarizeni, onClose }: { zarizeni: Zarizeni; onClose: () => void }) {
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        let token = zarizeni.qrToken
        if (!token) {
          const res = await fetch(`/api/servis/zarizeni/${zarizeni.id}/qr-token`)
          const data = await res.json()
          token = data.qrToken
        }
        const url = `https://felucia.io/zarizeni/${token}`
        setQrUrl(url)

        const QRCode = (await import('qrcode')).default
        const svg = await QRCode.toString(url, { type: 'svg', margin: 2, width: 240 })
        setQrSvg(svg)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [zarizeni.id, zarizeni.qrToken])

  async function downloadPng() {
    if (!qrUrl) return
    const QRCode = (await import('qrcode')).default
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, qrUrl, { width: 400, margin: 2 })
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-${zarizeni.nazev.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  function printQr() {
    const win = window.open('', '_blank')
    if (!win || !qrSvg) return
    win.document.write(`<html><head><title>QR - ${zarizeni.nazev}</title>
    <style>
      body { font-family: 'Inter', sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#fff; }
      .qr-print { display:flex; flex-direction:column; align-items:center; gap:12px; }
      h2 { font-size:18px; font-weight:700; color:#1a1a2e; text-align:center; }
      p { font-size:11px; color:#6b7280; text-align:center; word-break:break-all; max-width:280px; }
    </style>
    </head><body>
    <div class="qr-print">
      ${qrSvg}
      <h2>${zarizeni.nazev}</h2>
      <p>${qrUrl ?? ''}</p>
    </div>
    </body></html>`)
    win.document.close()
    win.print()
  }

  function copyUrl() {
    if (!qrUrl) return
    navigator.clipboard.writeText(qrUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">QR kód</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          <p className="text-sm text-gray-600 dark:text-slate-400 text-center font-medium">{zarizeni.nazev}</p>

          <div className="w-60 h-60 flex items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="text-gray-400 text-sm">Načítám…</div>
            ) : qrSvg ? (
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : (
              <div className="text-red-500 text-sm text-center px-4">Chyba generování</div>
            )}
          </div>

          {qrUrl && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center break-all max-w-full">{qrUrl}</p>
          )}

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={downloadPng}
              disabled={!qrSvg}
              className="w-full py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              ⬇ Stáhnout PNG
            </button>
            <button
              onClick={printQr}
              disabled={!qrSvg}
              className="w-full py-2 text-sm font-medium bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              🖨 Tisknout
            </button>
            <button
              onClick={copyUrl}
              disabled={!qrUrl}
              className="w-full py-2 text-sm font-medium border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg disabled:opacity-40 transition-colors"
            >
              {copied ? '✓ Zkopírováno!' : '📋 Kopírovat URL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ZarizeniClient({ zarizeni: initial, clients }: Props) {
  const router = useRouter()
  const [zarizeni] = useState(initial)
  const [search, setSearch] = useState('')
  const [typFilter, setTypFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qrZarizeni, setQrZarizeni] = useState<Zarizeni | null>(null)
  const [form, setForm] = useState<NewZarizeniForm>({
    klientId: '',
    nazev: '',
    typ: 'JINE',
    vyrobniCislo: '',
    datumInstalace: '',
    zarukaDo: '',
    poznamka: '',
  })

  const filtered = zarizeni.filter(z => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      z.nazev.toLowerCase().includes(q) ||
      `${z.klient.jmeno} ${z.klient.prijmeni}`.toLowerCase().includes(q) ||
      (z.vyrobniCislo ?? '').toLowerCase().includes(q)
    const matchTyp = !typFilter || z.typ === typFilter
    return matchSearch && matchTyp
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.klientId || !form.nazev) return
    setSaving(true)
    try {
      const res = await fetch('/api/servis/zarizeni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          klientId: form.klientId,
          nazev: form.nazev,
          typ: form.typ,
          vyrobniCislo: form.vyrobniCislo || null,
          datumInstalace: form.datumInstalace || null,
          zarukaDo: form.zarukaDo || null,
          poznamka: form.poznamka || null,
        }),
      })
      if (res.ok) {
        setShowAdd(false)
        setForm({ klientId: '', nazev: '', typ: 'JINE', vyrobniCislo: '', datumInstalace: '', zarukaDo: '', poznamka: '' })
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  function isZarukaExpiring(zarukaDo: string | null): boolean {
    if (!zarukaDo) return false
    const days = (new Date(zarukaDo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days < 90 && days > 0
  }

  function isZarukaExpired(zarukaDo: string | null): boolean {
    if (!zarukaDo) return false
    return new Date(zarukaDo) < new Date()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hledat zařízení nebo klienta…"
          className="flex-1 min-w-48 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          value={typFilter}
          onChange={e => setTypFilter(e.target.value)}
          className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">Všechny typy</option>
          {Object.entries(TYP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto bg-primary hover:bg-primary-hover text-white text-sm px-4 py-1.5 rounded-lg font-medium"
        >
          + Přidat zařízení
        </button>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-slate-400 text-sm">
            {zarizeni.length === 0 ? 'Zatím žádná zařízení. Přidejte první.' : 'Žádné výsledky.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map(z => {
              const nextNavsteva = z.servisniZakazky[0]
              const zarukaStatus = isZarukaExpired(z.zarukaDo) ? 'expired' : isZarukaExpiring(z.zarukaDo) ? 'expiring' : 'ok'
              return (
                <div key={z.id} className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${!z.aktivni ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYP_COLORS[z.typ]}`}>
                        {TYP_LABELS[z.typ] ?? z.typ}
                      </span>
                      {!z.aktivni && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400">Neaktivní</span>}
                      {zarukaStatus === 'expired' && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Záruka vypršela</span>}
                      {zarukaStatus === 'expiring' && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">Záruka expiruje</span>}
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white mt-1">{z.nazev}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                      <Link href={`/clients/${z.klient.id}`} className="hover:underline">
                        {z.klient.jmeno} {z.klient.prijmeni}
                      </Link>
                      {z.vyrobniCislo && <span className="text-gray-400 dark:text-slate-500"> · SN: {z.vyrobniCislo}</span>}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {z.datumInstalace && <span>Instalace: {new Date(z.datumInstalace).toLocaleDateString('cs-CZ')}</span>}
                      {z.zarukaDo && <span>Záruka do: {new Date(z.zarukaDo).toLocaleDateString('cs-CZ')}</span>}
                      {z.servisniKontrakty.length > 0 && <span className="text-green-600 dark:text-green-400">{z.servisniKontrakty.length} kontrakt{z.servisniKontrakty.length > 1 ? 'y' : ''}</span>}
                      {nextNavsteva && <span className="text-primary dark:text-primary-light">Příští servis: {new Date(nextNavsteva.planovanyTermin).toLocaleDateString('cs-CZ')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {z.deal && (
                      <Link href={`/deals/${z.deal.id}`} className="text-xs text-primary dark:text-primary-light hover:underline">
                        {z.deal.kod ?? 'OP'}
                      </Link>
                    )}
                    {/* QR button */}
                    <button
                      onClick={() => setQrZarizeni(z)}
                      title="Zobrazit QR kód"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrZarizeni && (
        <QrModal zarizeni={qrZarizeni} onClose={() => setQrZarizeni(null)} />
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Nové zařízení</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Klient *</label>
                <select
                  required
                  value={form.klientId}
                  onChange={e => setForm(f => ({ ...f, klientId: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Vyberte klienta…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.jmeno} {c.prijmeni}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Název zařízení *</label>
                <input
                  required
                  type="text"
                  value={form.nazev}
                  onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))}
                  placeholder="např. Tepelné čerpadlo Daikin Altherma"
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Typ</label>
                  <select
                    value={form.typ}
                    onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    {Object.entries(TYP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Výrobní číslo</label>
                  <input
                    type="text"
                    value={form.vyrobniCislo}
                    onChange={e => setForm(f => ({ ...f, vyrobniCislo: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Datum instalace</label>
                  <input
                    type="date"
                    value={form.datumInstalace}
                    onChange={e => setForm(f => ({ ...f, datumInstalace: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Záruka do</label>
                  <input
                    type="date"
                    value={form.zarukaDo}
                    onChange={e => setForm(f => ({ ...f, zarukaDo: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Poznámka</label>
                <textarea
                  value={form.poznamka}
                  onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                  Zrušit
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg font-medium disabled:opacity-50">
                  {saving ? 'Ukládám…' : 'Uložit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
