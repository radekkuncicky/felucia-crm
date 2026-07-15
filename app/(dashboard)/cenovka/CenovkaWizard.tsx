'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { techLabels } from '@/lib/constants'
import { formatCislo } from '@/lib/format'

/**
 * Rychlá cenovka — mobilní wizard pro obchodníka u klienta.
 * Klient → vzorová nabídka → produkty z katalogu → množství → OP + nabídka.
 */

export interface TemplateItem {
  product_id?: string
  nazev: string
  mnozstvi: number
  cena_za_kus: number
  jednotka?: string
  poznamky?: string | null
}

export interface WizardTemplate {
  id: string
  nazev: string
  popis: string | null
  technologie: string | null
  polozky: TemplateItem[]
}

interface ClientOption {
  id: string
  jmeno: string
  prijmeni: string
  email: string | null
  telefon: string | null
}

interface CatalogProduct {
  id: string
  kod: string | null
  nazev: string
  standardniCena: number
  jednotka: string
}

interface WizardItem {
  key: string
  productId: string | null
  nazev: string
  mnozstvi: number
  cenaZaKus: number
  jednotka: string
}

type ClientChoice =
  | { mode: 'existing'; id: string; label: string; email: string | null }
  | { mode: 'new'; jmeno: string; prijmeni: string; telefon: string; email: string }

const KROKY = ['Klient', 'Vzor', 'Produkty', 'Souhrn']
const TECHNOLOGIE = Object.keys(techLabels)

export default function CenovkaWizard({ templates }: { templates: WizardTemplate[] }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  // ── Krok 1: klient ─────────────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<ClientOption[]>([])
  const [clientLoading, setClientLoading] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [novyKlient, setNovyKlient] = useState({ jmeno: '', prijmeni: '', telefon: '', email: '' })
  const [client, setClient] = useState<ClientChoice | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setClientLoading(true)
      fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}`)
        .then(r => (r.ok ? r.json() : []))
        .then(data => setClientResults(Array.isArray(data) ? data : []))
        .catch(() => setClientResults([]))
        .finally(() => setClientLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [clientSearch])

  // ── Krok 2: vzor + technologie ─────────────────────────────────────────────
  const [template, setTemplate] = useState<WizardTemplate | null>(null)
  const [bezVzoru, setBezVzoru] = useState(false)
  const [technologie, setTechnologie] = useState<string>('KLIMA')

  // ── Krok 3: produkty ───────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<CatalogProduct[]>([])
  const [productLoading, setProductLoading] = useState(false)
  const [vybraneProdukty, setVybraneProdukty] = useState<WizardItem[]>([])

  useEffect(() => {
    if (step !== 2) return
    const t = setTimeout(() => {
      setProductLoading(true)
      fetch(`/api/products?search=${encodeURIComponent(productSearch)}&limit=30&page=1`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          const prods = Array.isArray(data) ? data : (data?.products ?? [])
          setProductResults(prods.map((p: CatalogProduct & { standardniCena: number | string }) => ({
            id: p.id, kod: p.kod, nazev: p.nazev,
            standardniCena: Number(p.standardniCena), jednotka: p.jednotka ?? 'ks',
          })))
        })
        .catch(() => setProductResults([]))
        .finally(() => setProductLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [productSearch, step])

  // ── Krok 4: položky ────────────────────────────────────────────────────────
  const [items, setItems] = useState<WizardItem[]>([])

  function buildItems() {
    const tplItems: WizardItem[] = (template?.polozky ?? []).map((p, idx) => ({
      key: `tpl-${idx}`,
      productId: p.product_id ?? null,
      nazev: p.nazev,
      mnozstvi: Number(p.mnozstvi) || 1,
      cenaZaKus: Number(p.cena_za_kus) || 0,
      jednotka: p.jednotka || 'ks',
    }))
    setItems([...vybraneProdukty, ...tplItems])
  }

  const total = useMemo(
    () => items.reduce((s, i) => s + i.mnozstvi * i.cenaZaKus, 0),
    [items]
  )

  // ── Vytvoření ──────────────────────────────────────────────────────────────
  async function vytvorit() {
    if (!client || items.length === 0) return
    setCreating(true)
    setError('')
    try {
      let clientId: string
      if (client.mode === 'existing') {
        clientId = client.id
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            typKlienta: 'FYZICKA_OSOBA',
            jmeno: client.jmeno,
            prijmeni: client.prijmeni,
            telefon: client.telefon || null,
            email: client.email || null,
          }),
        })
        if (!res.ok) throw new Error('Klienta se nepodařilo vytvořit')
        clientId = (await res.json()).id
      }

      const dealRes = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, technologie, predmet: techLabels[technologie as keyof typeof techLabels] }),
      })
      if (!dealRes.ok) {
        const d = await dealRes.json().catch(() => ({}))
        throw new Error(d.message ?? 'Obchodní případ se nepodařilo vytvořit')
      }
      const deal = await dealRes.json()

      const quoteRes = await fetch(`/api/deals/${deal.id}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nazev: template?.nazev ?? 'Cenovka',
          dphSazba: 12,
          items: items.map((it, idx) => ({
            productId: it.productId,
            nazev: it.nazev,
            mnozstvi: it.mnozstvi,
            cenaZaKus: it.cenaZaKus,
            jednotka: it.jednotka,
            poradi: idx,
          })),
        }),
      })
      if (!quoteRes.ok) throw new Error('Nabídku se nepodařilo vytvořit')

      router.push(`/deals/${deal.id}?tab=nabidky`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Něco se nepovedlo, zkuste to znovu')
      setCreating(false)
    }
  }

  // ── UI helpery ─────────────────────────────────────────────────────────────
  const inputCls =
    'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400'
  const cardCls =
    'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'

  const canNext =
    step === 0 ? client !== null :
    step === 1 ? (template !== null || bezVzoru) :
    true

  function next() {
    if (step === 2) buildItems()
    setStep(s => Math.min(s + 1, 3))
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-28">
      {/* Hlavička + kroky */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">⚡ Rychlá cenovka</h1>
        <div className="flex items-center gap-1.5 mt-3">
          {KROKY.map((k, i) => (
            <button
              key={k}
              onClick={() => { if (i < step) setStep(i) }}
              className={`flex-1 text-center py-1.5 rounded-lg text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-primary text-white'
                  : i < step
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500'
              }`}
            >
              {i < step ? '✓ ' : ''}{k}
            </button>
          ))}
        </div>
      </div>

      {/* ── Krok 1: Klient ── */}
      {step === 0 && (
        <div className={`${cardCls} p-4 space-y-3`}>
          {client && (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  {client.mode === 'existing' ? client.label : `${client.jmeno} ${client.prijmeni}`.trim()}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500">
                  {client.mode === 'existing' ? 'Existující klient' : 'Nový klient — vytvoří se s nabídkou'}
                </p>
              </div>
              <button onClick={() => setClient(null)} className="text-xs text-green-700 dark:text-green-400 underline">Změnit</button>
            </div>
          )}

          {!client && !showNewClient && (
            <>
              <input
                autoFocus
                placeholder="Hledat klienta (jméno, telefon, e-mail)…"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className={inputCls}
              />
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50 -mx-1">
                {clientLoading && (
                  <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
                )}
                {!clientLoading && clientResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setClient({ mode: 'existing', id: c.id, label: `${c.jmeno} ${c.prijmeni}`.trim(), email: c.email })}
                    className="w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/40 rounded-lg"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{c.jmeno} {c.prijmeni}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{[c.telefon, c.email].filter(Boolean).join(' · ') || '—'}</p>
                  </button>
                ))}
                {!clientLoading && clientResults.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Žádný klient nenalezen</p>
                )}
              </div>
              <button
                onClick={() => setShowNewClient(true)}
                className="w-full px-4 py-2.5 text-sm font-medium text-primary dark:text-primary-light border border-blue-300 dark:border-blue-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                + Nový klient
              </button>
            </>
          )}

          {!client && showNewClient && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Jméno *" value={novyKlient.jmeno} onChange={e => setNovyKlient(p => ({ ...p, jmeno: e.target.value }))} className={inputCls} />
                <input placeholder="Příjmení" value={novyKlient.prijmeni} onChange={e => setNovyKlient(p => ({ ...p, prijmeni: e.target.value }))} className={inputCls} />
              </div>
              <input placeholder="Telefon" type="tel" value={novyKlient.telefon} onChange={e => setNovyKlient(p => ({ ...p, telefon: e.target.value }))} className={inputCls} />
              <input placeholder="E-mail" type="email" value={novyKlient.email} onChange={e => setNovyKlient(p => ({ ...p, email: e.target.value }))} className={inputCls} />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowNewClient(false)} className="flex-1 px-4 py-2.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-xl">
                  Zpět
                </button>
                <button
                  disabled={!novyKlient.jmeno.trim()}
                  onClick={() => { setClient({ mode: 'new', ...novyKlient, jmeno: novyKlient.jmeno.trim() }); setShowNewClient(false) }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl disabled:opacity-40"
                >
                  Použít
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Krok 2: Vzor ── */}
      {step === 1 && (
        <div className="space-y-3">
          <div className={`${cardCls} p-4 space-y-2`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Technologie</p>
            <div className="flex flex-wrap gap-1.5">
              {TECHNOLOGIE.map(t => (
                <button
                  key={t}
                  onClick={() => setTechnologie(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    technologie === t
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600'
                  }`}
                >
                  {techLabels[t as keyof typeof techLabels]}
                </button>
              ))}
            </div>
          </div>

          <div className={`${cardCls} p-4 space-y-2`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Vzorová nabídka</p>
            {templates.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-slate-500">Žádné vzorové nabídky — pokračujte bez vzoru a přidejte položky z katalogu.</p>
            )}
            {[...templates]
              .sort((a, b) => Number(b.technologie === technologie) - Number(a.technologie === technologie))
              .map(t => {
                const selected = template?.id === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => { setTemplate(selected ? null : t); setBezVzoru(false); if (!selected && t.technologie) setTechnologie(t.technologie) }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      selected
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.nazev}</p>
                      {t.technologie && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 flex-shrink-0">
                          {techLabels[t.technologie as keyof typeof techLabels]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {t.popis || `${t.polozky.length} položek`}
                    </p>
                  </button>
                )
              })}
            <button
              onClick={() => { setBezVzoru(b => !b); setTemplate(null) }}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                bezVzoru
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700'
                  : 'border-dashed border-gray-300 dark:border-slate-600'
              }`}
            >
              <p className="text-sm font-medium text-gray-600 dark:text-slate-300">Bez vzoru</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Jen položky z katalogu</p>
            </button>
          </div>
        </div>
      )}

      {/* ── Krok 3: Produkty ── */}
      {step === 2 && (
        <div className={`${cardCls} p-4 space-y-3`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
            Přidat z katalogu (např. jednotka klimatizace)
          </p>
          <input
            autoFocus
            placeholder="Hledat produkt (např. PULAR 12)…"
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            className={inputCls}
          />

          {vybraneProdukty.length > 0 && (
            <div className="space-y-1.5">
              {vybraneProdukty.map(p => (
                <div key={p.key} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300 truncate">{p.nazev}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">{formatCislo(p.cenaZaKus)} Kč/{p.jednotka}</p>
                  </div>
                  <button
                    onClick={() => setVybraneProdukty(prev => prev.filter(x => x.key !== p.key))}
                    className="text-red-400 hover:text-red-600 px-2 text-lg leading-none"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50 -mx-1">
            {productLoading && (
              <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
            )}
            {!productLoading && productResults
              .filter(p => !vybraneProdukty.some(v => v.productId === p.id))
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => setVybraneProdukty(prev => [...prev, {
                    key: `prod-${p.id}`,
                    productId: p.id,
                    nazev: p.nazev,
                    mnozstvi: 1,
                    cenaZaKus: p.standardniCena,
                    jednotka: p.jednotka,
                  }])}
                  className="w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/40 rounded-lg flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.nazev}</p>
                    {p.kod && <p className="text-xs font-mono text-gray-400 dark:text-slate-500">{p.kod}</p>}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-slate-300 tabular-nums flex-shrink-0">{formatCislo(p.standardniCena)} Kč</span>
                </button>
              ))}
            {!productLoading && productResults.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Nic nenalezeno</p>
            )}
          </div>
        </div>
      )}

      {/* ── Krok 4: Souhrn ── */}
      {step === 3 && (
        <div className="space-y-3">
          <div className={`${cardCls} divide-y divide-gray-50 dark:divide-slate-700/50`}>
            {items.map(it => (
              <div key={it.key} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{it.nazev}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{formatCislo(it.cenaZaKus)} Kč/{it.jednotka}</p>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={it.mnozstvi}
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0
                    setItems(prev => prev.map(x => x.key === it.key ? { ...x, mnozstvi: v } : x))
                  }}
                  className="w-16 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-right bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{ fontSize: 16 }}
                />
                <span className="text-xs text-gray-400 dark:text-slate-500 w-7">{it.jednotka}</span>
                <button
                  onClick={() => setItems(prev => prev.filter(x => x.key !== it.key))}
                  className="text-gray-300 dark:text-slate-600 hover:text-red-500 text-lg leading-none"
                >×</button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">Žádné položky — vraťte se na Vzor nebo Produkty.</p>
            )}
          </div>

          <div className={`${cardCls} p-4`}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500 dark:text-slate-400">Bez DPH</span>
              <span className="text-gray-900 dark:text-white tabular-nums">{formatCislo(total)} Kč</span>
            </div>
            <div className="flex justify-between font-bold border-t border-gray-100 dark:border-slate-700 pt-2 mt-2">
              <span className="text-gray-900 dark:text-white">S DPH 12 %</span>
              <span className="text-primary dark:text-primary-light text-lg tabular-nums">{formatCislo(total * 1.12)} Kč</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              Pro {client?.mode === 'existing' ? client.label : client ? `${client.jmeno} ${client.prijmeni}`.trim() : '?'} · {techLabels[technologie as keyof typeof techLabels]}
              {template ? ` · vzor ${template.nazev}` : ''}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500 px-1">{error}</p>}

      {/* Spodní lišta */}
      <div className="fixed bottom-16 md:bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-lg mx-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 flex gap-2 shadow-xl">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={creating}
              className="px-5 py-3 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-xl disabled:opacity-50"
            >
              Zpět
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={next}
              disabled={!canNext}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-40"
            >
              {step === 2 && vybraneProdukty.length === 0 ? 'Přeskočit' : 'Pokračovat'}
            </button>
          ) : (
            <button
              onClick={vytvorit}
              disabled={creating || items.length === 0 || !client}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {creating ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Vytvářím…</>
              ) : 'Vytvořit nabídku'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
