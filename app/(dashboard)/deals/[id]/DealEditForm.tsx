'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCislo } from '@/lib/format'

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000
}

const stavOptions = [
  { value: 'NOVY', label: 'Nový' },
  { value: 'JEDNANI', label: 'Jednání' },
  { value: 'NABIDKA', label: 'Nabídka' },
  { value: 'PRED_UZAVRENIM', label: 'Před uzavřením' },
  { value: 'USPECH', label: 'Úspěch' },
  { value: 'PAS', label: 'Prohráno' },
]

interface DealData {
  id: string
  stav: string
  predmet: string
  hodnotaZalohy: string
  splatnostZalohy: string
  terminPrevzeti: string
  terminRealizace: string
  cisloSmlouvy: string
  adresaDila: string
  kontaktniOsoba: string
  kontaktniTelefon: string
  poznamky: string
}

export default function DealEditForm({
  deal,
  klientAdresa,
  aktivniNabidkaCena,
}: {
  deal: DealData
  klientAdresa?: string
  aktivniNabidkaCena?: number
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ ...deal })
  const [zalohaMode, setZalohaMode] = useState<'kc' | 'pct'>('kc')
  const [zalohaPct, setZalohaPct] = useState('70')

  const pctComputed = aktivniNabidkaCena && zalohaPct
    ? roundToThousand(aktivniNabidkaCena * (parseFloat(zalohaPct) || 0) / 100)
    : null

  function set(field: keyof DealData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Chyba při ukládání')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500'
  const label = 'block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 dark:text-white">Údaje případu</h2>

      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}
      {saved && <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm px-3 py-2 rounded-lg">Uloženo</div>}

      <div>
        <label className={label}>Stav</label>
        <select value={form.stav} onChange={(e) => set('stav', e.target.value)} className={inp}>
          {stavOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div>
        <label className={label}>Předmět</label>
        <input type="text" value={form.predmet} onChange={(e) => set('predmet', e.target.value)} className={inp} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={label} style={{ marginBottom: 0 }}>Hodnota zálohy</label>
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-slate-600 text-xs">
            <button
              type="button"
              onClick={() => setZalohaMode('kc')}
              className={`px-2.5 py-1 font-medium transition-colors ${
                zalohaMode === 'kc'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
              }`}
            >
              Kč
            </button>
            <button
              type="button"
              onClick={() => setZalohaMode('pct')}
              disabled={!aktivniNabidkaCena}
              className={`px-2.5 py-1 font-medium transition-colors border-l border-gray-300 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed ${
                zalohaMode === 'pct'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
              }`}
              title={!aktivniNabidkaCena ? 'Nejprve nastavte aktivní nabídku' : undefined}
            >
              %
            </button>
          </div>
        </div>

        {zalohaMode === 'kc' ? (
          <input
            type="number"
            min="0"
            step="1"
            value={form.hodnotaZalohy}
            onChange={(e) => set('hodnotaZalohy', e.target.value)}
            className={inp}
            placeholder="0"
          />
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={zalohaPct}
                onChange={(e) => {
                  setZalohaPct(e.target.value)
                  const computed = roundToThousand(
                    (aktivniNabidkaCena ?? 0) * (parseFloat(e.target.value) || 0) / 100
                  )
                  set('hodnotaZalohy', computed > 0 ? String(computed) : '')
                }}
                className={`${inp} w-24`}
                placeholder="70"
              />
              <span className="text-sm text-gray-500 dark:text-slate-400">% z aktivní nabídky</span>
            </div>
            {pctComputed !== null && aktivniNabidkaCena ? (
              <p className="text-sm text-primary dark:text-primary-light font-medium">
                = {formatCislo(pctComputed)} Kč
                <span className="text-xs text-gray-400 dark:text-slate-500 font-normal ml-1.5">
                  (z {formatCislo(Math.round(aktivniNabidkaCena))} Kč s DPH, zaokrouhleno na tisíce)
                </span>
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <label className={label}>Splatnost zálohy</label>
        <input type="date" value={form.splatnostZalohy} onChange={(e) => set('splatnostZalohy', e.target.value)} className={inp} />
      </div>

      <div>
        <label className={label}>Termín realizace</label>
        <input type="date" value={form.terminRealizace} onChange={(e) => set('terminRealizace', e.target.value)} className={inp} />
      </div>

      <div>
        <label className={label}>Termín převzetí</label>
        <input type="date" value={form.terminPrevzeti} onChange={(e) => set('terminPrevzeti', e.target.value)} className={inp} />
      </div>

      <div>
        <label className={label}>Číslo smlouvy</label>
        <input type="text" value={form.cisloSmlouvy} onChange={(e) => set('cisloSmlouvy', e.target.value)} className={inp} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={label}>Adresa díla / místo instalace</label>
          {klientAdresa && (
            <button
              type="button"
              onClick={() => set('adresaDila', klientAdresa)}
              title="Vyplnit adresou klienta"
              className="text-xs px-2 py-0.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Převzít z klienta
            </button>
          )}
        </div>
        <input type="text" value={form.adresaDila} onChange={(e) => set('adresaDila', e.target.value)} className={inp} />
      </div>

      <div>
        <label className={label}>Kontaktní osoba</label>
        <input type="text" value={form.kontaktniOsoba} onChange={(e) => set('kontaktniOsoba', e.target.value)} className={inp} />
      </div>

      <div>
        <label className={label}>Kontaktní telefon</label>
        <input type="tel" value={form.kontaktniTelefon} onChange={(e) => set('kontaktniTelefon', e.target.value)} className={inp} />
      </div>

      <div>
        <label className={label}>Poznámky</label>
        <textarea rows={3} value={form.poznamky} onChange={(e) => set('poznamky', e.target.value)} className={inp} />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
      >
        {saving ? 'Ukládám…' : 'Uložit změny'}
      </button>
    </div>
  )
}
