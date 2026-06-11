'use client'

import { useState } from 'react'
import Link from 'next/link'

const CHROME_PLACEHOLDERS: [string, string][] = [
  ['{{logo}}', 'logo organizace (obrázek)'],
  ['{{organizace}}', 'název organizace'],
  ['{{org_ico}}', 'IČO'],
  ['{{org_dic}}', 'DIČ'],
  ['{{org_sidlo}}', 'sídlo'],
  ['{{org_email}}', 'e-mail'],
  ['{{org_telefon}}', 'telefon'],
  ['{{org_web}}', 'web'],
  ['{{barva}}', 'brand barva (hex)'],
  ['{{strana}}', 'číslo aktuální stránky'],
  ['{{stran_celkem}}', 'celkový počet stránek'],
  ['{{datum}}', 'dnešní datum'],
]

const STYLY = [
  { value: 'LINKA', label: 'Decentní linka', popis: 'Logo a název firmy nad tenkou linkou v brand barvě. Konzervativní vzhled právního dokumentu.' },
  { value: 'PRUH', label: 'Barevný pruh', popis: 'Výrazný pruh v brand barvě s logem — modernější, výraznější branding.' },
  { value: 'VLASTNI', label: 'Vlastní HTML', popis: 'Plná kontrola — vlastní HTML záhlaví a patičky s placeholdery.', premium: true },
  { value: 'ZADNY', label: 'Bez záhlaví', popis: 'Čistý dokument bez záhlaví a patičky.' },
]

type Values = {
  dokumentyStyl: string
  dokumentyPaticka: string | null
  dokumentyCislovani: boolean
  dokumentyHeaderHtml: string | null
  dokumentyFooterHtml: string | null
}

export default function DokumentySettingsForm({ initial, hasWhiteLabel }: { initial: Values; hasWhiteLabel: boolean }) {
  const [v, setV] = useState<Values>(initial)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      showToast(res.ok ? 'Uloženo' : 'Uložení se nepodařilo')
    } catch {
      showToast('Uložení se nepodařilo')
    } finally {
      setSaving(false)
    }
  }

  async function preview() {
    setPreviewing(true)
    try {
      const res = await fetch('/api/settings/dokumenty/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      if (!res.ok) { showToast('Náhled se nepodařilo vygenerovat'); return }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch {
      showToast('Náhled se nepodařilo vygenerovat')
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">← Nastavení</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Vzhled dokumentů</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Záhlaví, patička a číslování stránek na PDF smlouvách. Logo a brand barvu nastavíš v{' '}
          <Link href="/settings/company" className="text-primary dark:text-primary-light hover:underline">Nastavení firmy</Link>.
        </p>
      </div>

      {/* Styl */}
      <div className="space-y-3 mb-8">
        {STYLY.map(s => {
          const locked = s.premium && !hasWhiteLabel
          const active = v.dokumentyStyl === s.value
          return (
            <label
              key={s.value}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                active
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
              } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="styl"
                checked={active}
                disabled={locked}
                onChange={() => setV({ ...v, dokumentyStyl: s.value })}
                className="mt-1 accent-primary"
              />
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {s.label}
                  {s.premium && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-1.5 py-0.5 rounded">
                      Professional
                    </span>
                  )}
                </span>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{s.popis}</p>
                {locked && <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Dostupné v plánu PROFESSIONAL — <Link href="/settings/billing" className="underline">upgradovat</Link></p>}
              </div>
            </label>
          )
        })}
      </div>

      {/* Patička + číslování (mimo VLASTNI/ZADNY) */}
      {v.dokumentyStyl !== 'VLASTNI' && v.dokumentyStyl !== 'ZADNY' && (
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Text patičky</label>
            <input
              type="text"
              value={v.dokumentyPaticka ?? ''}
              onChange={e => setV({ ...v, dokumentyPaticka: e.target.value || null })}
              placeholder="Prázdné = automaticky: název firmy · IČ · sídlo · e-mail"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={v.dokumentyCislovani}
              onChange={e => setV({ ...v, dokumentyCislovani: e.target.checked })}
              className="accent-primary"
            />
            Číslování stránek („Strana X z Y“)
          </label>
        </div>
      )}

      {/* Vlastní HTML */}
      {v.dokumentyStyl === 'VLASTNI' && hasWhiteLabel && (
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">HTML záhlaví</label>
            <textarea
              value={v.dokumentyHeaderHtml ?? ''}
              onChange={e => setV({ ...v, dokumentyHeaderHtml: e.target.value || null })}
              rows={5}
              spellCheck={false}
              placeholder={'<div style="display:flex;justify-content:space-between">\n  {{logo}} <strong>{{organizace}}</strong>\n</div>'}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">HTML patičky</label>
            <textarea
              value={v.dokumentyFooterHtml ?? ''}
              onChange={e => setV({ ...v, dokumentyFooterHtml: e.target.value || null })}
              rows={4}
              spellCheck={false}
              placeholder={'<div style="text-align:center">{{organizace}} · IČ {{org_ico}} · Strana {{strana}} z {{stran_celkem}}</div>'}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-gray-900 dark:text-white"
            />
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Dostupné placeholdery
            </div>
            <table className="w-full text-sm">
              <tbody>
                {CHROME_PLACEHOLDERS.map(([ph, popis]) => (
                  <tr key={ph} className="border-t border-gray-100 dark:border-slate-700/60">
                    <td className="px-4 py-1.5 font-mono text-xs text-primary dark:text-primary-light whitespace-nowrap">{ph}</td>
                    <td className="px-4 py-1.5 text-gray-600 dark:text-slate-400">{popis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-gray-400 dark:text-slate-500 border-t border-gray-100 dark:border-slate-700/60">
              Pouze inline CSS styly. Externí obrázky a skripty nejsou v záhlaví/patičce podporovány — pro logo použij {'{{logo}}'}.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        <button
          onClick={preview}
          disabled={previewing}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {previewing ? 'Generuji…' : 'Náhled PDF'}
        </button>
        {toast && <span className="text-sm text-gray-500 dark:text-slate-400">{toast}</span>}
      </div>
    </div>
  )
}
