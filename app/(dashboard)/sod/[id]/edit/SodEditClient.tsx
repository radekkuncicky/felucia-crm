'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SodTemplateEditor from '@/components/SodTemplateEditor'

interface SodFormData {
  klientJmeno: string
  klientAdresa: string
  klientEmail: string
  klientTelefon: string
  klientIco: string
  klientDic: string
  kontaktniOsoba: string
  kontaktniTelefon: string
  predmetDila: string
  adresaDila: string
  terminPrevzeti: string
  pocetDniRealizace: string
  zmenaTerm: string
  cenaBezDph: string
  cenaSDph: string
  dphSazba: string
  zalohaKc: string
  zalohaSplatnost: string
  poznamky: string
}

interface AttachState {
  prilohaVop: boolean
  prilohaVzsp: boolean
  prilohaCenik: boolean
  prilohaNabidka: boolean
  hasVop: boolean
  hasVzsp: boolean
  hasCenik: boolean
}

interface Props {
  sodId: string
  cislo: string
  hasTemplate: boolean
  initialText: string
  initialForm: SodFormData
  cnInfo: { bezDph: number; sDph: number; dphSazba: number } | null
  initialAttach: AttachState
}

function Field({
  label, name, value, onChange, type = 'text', placeholder, hint, span2,
}: {
  label: string
  name: keyof SodFormData
  value: string
  onChange: (name: keyof SodFormData, val: string) => void
  type?: string
  placeholder?: string
  hint?: string
  span2?: boolean
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
      />
      {hint && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{hint}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 pb-2 border-b border-gray-100 dark:border-slate-700">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

const fmtKc = (n: number) => Math.round(n).toLocaleString('cs-CZ') + ' Kč'

export default function SodEditClient({ sodId, cislo, hasTemplate, initialText, initialForm, cnInfo, initialAttach }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'form' | 'html'>('form')
  const [form, setForm] = useState<SodFormData>(initialForm)
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPlaceholders, setShowPlaceholders] = useState(false)
  const [attach, setAttach] = useState({
    prilohaVop: initialAttach.prilohaVop,
    prilohaVzsp: initialAttach.prilohaVzsp,
    prilohaCenik: initialAttach.prilohaCenik,
    prilohaNabidka: initialAttach.prilohaNabidka,
  })

  function setField(name: keyof SodFormData, val: string) {
    setForm(f => ({ ...f, [name]: val }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = tab === 'form'
        ? {
            ...form,
            pocetDniRealizace: form.pocetDniRealizace !== '' ? Number(form.pocetDniRealizace) : null,
            zalohaSplatnost: form.zalohaSplatnost !== '' ? Number(form.zalohaSplatnost) : null,
            cenaBezDph: form.cenaBezDph !== '' ? Number(form.cenaBezDph) : null,
            cenaSDph: form.cenaSDph !== '' ? Number(form.cenaSDph) : null,
            dphSazba: form.dphSazba !== '' ? Number(form.dphSazba) : null,
            zalohaKc: form.zalohaKc !== '' ? Number(form.zalohaKc) : null,
            regenerate: hasTemplate,
            ...attach,
          }
        : { textSmlouvy: text, ...attach }

      const res = await fetch(`/api/sod/${sodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        router.push(`/sod/${sodId}`)
        router.refresh()
      } else {
        const d = await res.json()
        setError(d.error ?? 'Chyba při ukládání')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <Link
              href={`/sod/${sodId}`}
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Zpět na detail
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Upravit smlouvu {cislo}</h1>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'html' && (
              <button
                type="button"
                onClick={() => setShowPlaceholders(p => !p)}
                className={`text-sm border px-3 py-2 rounded-lg transition-colors ${
                  showPlaceholders
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                Symboly
              </button>
            )}
            <Link
              href={`/sod/${sodId}`}
              className="text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Zrušit
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Ukládám…' : tab === 'form' && hasTemplate ? 'Uložit a přegenerovat' : 'Uložit'}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}

        {/* Záložky */}
        <div className="flex gap-1 mt-4 border-b border-gray-200 dark:border-slate-700 -mb-4 pb-0">
          {(['form', 'html'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              {t === 'form' ? 'Údaje smlouvy' : 'HTML obsah'}
            </button>
          ))}
        </div>
      </div>

      {/* Formulář */}
      {tab === 'form' && (
        <div className="space-y-4">
          {hasTemplate && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
              Po uložení se smlouva automaticky přegeneruje ze šablony s novými údaji.
            </div>
          )}

          <Section title="Objednatel">
            <Field label="Jméno / název firmy" name="klientJmeno" value={form.klientJmeno} onChange={setField} placeholder="Jan Novák" />
            <Field label="Sídlo / adresa trvalého pobytu" name="klientAdresa" value={form.klientAdresa} onChange={setField} placeholder="Ulice 1, 700 00 Ostrava" />
            <Field label="E-mail" name="klientEmail" value={form.klientEmail} onChange={setField} type="email" placeholder="jan@firma.cz" />
            <Field label="Telefon" name="klientTelefon" value={form.klientTelefon} onChange={setField} placeholder="+420 123 456 789" />
            <Field label="IČO" name="klientIco" value={form.klientIco} onChange={setField} placeholder="12345678" />
            <Field label="DIČ" name="klientDic" value={form.klientDic} onChange={setField} placeholder="CZ12345678" />
          </Section>

          <Section title="Kontaktní osoba na stavbě">
            <Field label="Jméno" name="kontaktniOsoba" value={form.kontaktniOsoba} onChange={setField} placeholder="Petr Novák" />
            <Field label="Telefon" name="kontaktniTelefon" value={form.kontaktniTelefon} onChange={setField} placeholder="+420 123 456 789" />
          </Section>

          <Section title="Předmět díla">
            <Field label="Předmět díla" name="predmetDila" value={form.predmetDila} onChange={setField} placeholder="Dodávka a montáž tepelného čerpadla…" span2 />
            <Field label="Adresa místa instalace" name="adresaDila" value={form.adresaDila} onChange={setField} placeholder="Ulice 1, 700 00 Ostrava" span2 />
          </Section>

          <Section title="Termíny">
            <Field label="Předpokládaný termín předání" name="terminPrevzeti" value={form.terminPrevzeti} onChange={setField} type="date" />
            <Field label="Počet dní realizace" name="pocetDniRealizace" value={form.pocetDniRealizace} onChange={setField} type="number" placeholder="14" />
            <Field label="Klient může změnit termín do" name="zmenaTerm" value={form.zmenaTerm} onChange={setField} type="date" hint="Volitelné — nejzazší datum, do kdy lze posunout termín" span2 />
          </Section>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 pb-2 border-b border-gray-100 dark:border-slate-700">
              Cena díla
            </h2>
            {cnInfo ? (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Bez DPH', value: fmtKc(cnInfo.bezDph) },
                  { label: `DPH ${cnInfo.dphSazba} %`, value: fmtKc(cnInfo.sDph - cnInfo.bezDph) },
                  { label: 'Celkem s DPH', value: fmtKc(cnInfo.sDph) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-4 py-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                  </div>
                ))}
                <p className="col-span-3 text-xs text-gray-400 dark:text-slate-500">
                  Načteno z aktivní cenové nabídky. Změnu proveďte v CN.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500">Žádná aktivní cenová nabídka není přiřazena k zakázce.</p>
            )}
          </div>

          <Section title="Záloha">
            <Field label="Výše zálohy (Kč)" name="zalohaKc" value={form.zalohaKc} onChange={setField} type="number" placeholder="50000" />
            <Field label="Splatnost zálohy (dní)" name="zalohaSplatnost" value={form.zalohaSplatnost} onChange={setField} type="number" placeholder="14" />
          </Section>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 pb-2 border-b border-gray-100 dark:border-slate-700">
              Přílohy PDF
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
              Zaškrtněte dokumenty, které budou připojeny za smlouvu do výsledného PDF.
            </p>
            <div className="space-y-2">
              {([
                { key: 'prilohaNabidka', label: 'Cenová nabídka', always: true },
                { key: 'prilohaVop',  label: 'VOP — Všeobecné obchodní podmínky', hasFile: initialAttach.hasVop },
                { key: 'prilohaVzsp', label: 'VZSP — Všeobecné záruční a servisní podmínky', hasFile: initialAttach.hasVzsp },
                { key: 'prilohaCenik', label: 'Ceník', hasFile: initialAttach.hasCenik },
              ] as { key: keyof typeof attach; label: string; always?: boolean; hasFile?: boolean }[]).map(({ key, label, always, hasFile }) => {
                const fixedKey = key as keyof typeof attach
                const available = always || hasFile
                return (
                  <label
                    key={fixedKey}
                    className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 border cursor-pointer transition-colors ${
                      available
                        ? 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                        : 'border-gray-100 dark:border-slate-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={attach[fixedKey]}
                      disabled={!available}
                      onChange={e => setAttach(a => ({ ...a, [fixedKey]: e.target.checked }))}
                      className="w-4 h-4 rounded text-primary"
                    />
                    <span className={`flex-1 ${attach[fixedKey] ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-slate-400'}`}>
                      {label}
                    </span>
                    {!available && (
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        <a href="/settings/contract-templates" className="underline hover:no-underline">Nahrát v nastavení</a>
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Interní poznámky</h2>
            <textarea
              value={form.poznamky}
              onChange={e => setField('poznamky', e.target.value)}
              rows={3}
              placeholder="Poznámky k zakázce (nezobrazují se v PDF)…"
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
        </div>
      )}

      {/* HTML editor */}
      {tab === 'html' && (
        <div className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Úprava HTML obsahu přímo — přegenerování ze šablony se neprovede. Změny se projeví v PDF okamžitě.
          </div>
          <SodTemplateEditor
            content={text}
            onChange={setText}
            showPlaceholders={showPlaceholders}
            minHeight="72vh"
          />
        </div>
      )}
    </div>
  )
}
