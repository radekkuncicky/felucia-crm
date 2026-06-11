'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SodTyp } from '@prisma/client'

const SE_ZALOHOU: SodTyp[] = ['DPH_12_SE_ZALOHOU', 'DPH_21_SE_ZALOHOU', 'PDP_SE_ZALOHOU']

interface Props {
  dealId: string | null
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100 dark:border-slate-700">
      {children}
    </h3>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
const readonlyCls = "w-full border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 cursor-not-allowed"

export default function SodNewClient({ dealId }: Props) {
  const router = useRouter()
  const [prefillLoading, setPrefillLoading] = useState(!!dealId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sekce 1 — Typ
  const [typ, setTyp] = useState<SodTyp>('DPH_21_SE_ZALOHOU')

  // Sekce 2 — Klient
  const [klientJmeno, setKlientJmeno] = useState('')
  const [klientAdresa, setKlientAdresa] = useState('')
  const [klientEmail, setKlientEmail] = useState('')
  const [klientTelefon, setKlientTelefon] = useState('')
  const [klientIco, setKlientIco] = useState('')
  const [klientDic, setKlientDic] = useState('')

  // Sekce 3 — Kontaktní osoba
  const [kontaktniOsoba, setKontaktniOsoba] = useState('')
  const [kontaktniTelefon, setKontaktniTelefon] = useState('')

  // Sekce 4 — Dílo
  const [predmetDila, setPredmetDila] = useState('')
  const [adresaDila, setAdresaDila] = useState('')

  // Sekce 5 — Termíny
  const [terminPrevzeti, setTerminPrevzeti] = useState('')
  const [pocetDniRealizace, setPocetDniRealizace] = useState('')
  const [zmenaTerm, setZmenaTerm] = useState('')

  // Sekce 6 — Cena (readonly)
  const [cenaBezDph, setCenaBezDph] = useState<number | null>(null)
  const [cenaSDph, setCenaSDph] = useState<number | null>(null)
  const [dphSazba, setDphSazba] = useState<number>(21)

  // Sekce 7 — Záloha
  const [zalohaKc, setZalohaKc] = useState('')
  const [zalohaSplatnost, setZalohaSplatnost] = useState('14')
  const [zalohaKategorie, setZalohaKategorie] = useState('')

  const seZalohou = SE_ZALOHOU.includes(typ)

  useEffect(() => {
    if (!dealId) return
    fetch(`/api/sod/prefill?dealId=${dealId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) return
        setKlientJmeno(d.klientJmeno ?? '')
        setKlientAdresa(d.klientAdresa ?? '')
        setKlientEmail(d.klientEmail ?? '')
        setKlientTelefon(d.klientTelefon ?? '')
        setKlientIco(d.klientIco ?? '')
        setKlientDic(d.klientDic ?? '')
        setKontaktniOsoba(d.kontaktniOsoba ?? d.klientJmeno ?? '')
        setKontaktniTelefon(d.kontaktniTelefon ?? d.klientTelefon ?? '')
        setPredmetDila(d.predmetDila ?? '')
        setAdresaDila(d.adresaDila ?? '')
        setCenaBezDph(d.cenaBezDph ?? null)
        setCenaSDph(d.cenaSDph ?? null)
        setDphSazba(d.dphSazba ?? 21)
        setZalohaKc(d.zalohaKc != null ? String(d.zalohaKc) : '')
        setZalohaSplatnost(d.zalohaSplatnost != null ? String(d.zalohaSplatnost) : '14')
        setZalohaKategorie(d.zalohaKategorie ?? '')
      })
      .finally(() => setPrefillLoading(false))
  }, [dealId])

  function fmtKc(n: number | null) {
    if (n == null) return '—'
    return n.toLocaleString('cs-CZ') + ' Kč'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dealId) { setError('Chybí dealId \u2014 přejděte na tuto stránku z detailu OP.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          typ,
          klientJmeno,
          klientAdresa: klientAdresa || null,
          klientEmail: klientEmail || null,
          klientTelefon: klientTelefon || null,
          klientIco: klientIco || null,
          klientDic: klientDic || null,
          kontaktniOsoba: kontaktniOsoba || null,
          kontaktniTelefon: kontaktniTelefon || null,
          predmetDila,
          adresaDila: adresaDila || null,
          terminPrevzeti: terminPrevzeti || null,
          pocetDniRealizace: pocetDniRealizace ? Number(pocetDniRealizace) : null,
          zmenaTerm: zmenaTerm || null,
          cenaBezDph,
          cenaSDph,
          dphSazba,
          zalohaKc: seZalohou && zalohaKc ? Number(zalohaKc) : null,
          zalohaSplatnost: seZalohou ? Number(zalohaSplatnost) : null,
          zalohaKategorie: seZalohou ? zalohaKategorie || null : null,
        }),
      })
      if (res.ok) {
        const sod = await res.json()
        router.push(`/sod/${sod.id}`)
      } else {
        const d = await res.json()
        setError(d.error ?? 'Chyba při ukládání')
      }
    } finally {
      setSaving(false)
    }
  }

  if (prefillLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-sm text-gray-400 dark:text-slate-500">Načítám data…</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-1">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {dealId ? (
          <Link href={`/deals/${dealId}?tab=smlouvy`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Zpět na OP
          </Link>
        ) : (
          <Link href="/deals" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Obchodní případy
          </Link>
        )}
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Nová smlouva o dílo</h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* SEKCE 1 — Typ smlouvy (2 dimenze: režim DPH × záloha) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
          <SectionTitle>Typ smlouvy</SectionTitle>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Režim DPH</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { rezim: 'DPH_12', label: '12 % DPH' },
                  { rezim: 'DPH_21', label: '21 % DPH' },
                  { rezim: 'PDP', label: 'Přenesená daňová povinnost' },
                ] as const).map(opt => {
                  const active = typ.startsWith(opt.rezim)
                  return (
                    <button
                      key={opt.rezim}
                      type="button"
                      onClick={() => setTyp(`${opt.rezim}_${seZalohou ? 'SE_ZALOHOU' : 'BEZ_ZALOHY'}` as SodTyp)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-primary-light'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Záloha</p>
              <div className="flex gap-2">
                {([
                  { val: true, label: 'Se zálohou' },
                  { val: false, label: 'Bez zálohy' },
                ] as const).map(opt => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => {
                      const rezim = typ.startsWith('DPH_12') ? 'DPH_12' : typ.startsWith('DPH_21') ? 'DPH_21' : 'PDP'
                      setTyp(`${rezim}_${opt.val ? 'SE_ZALOHOU' : 'BEZ_ZALOHY'}` as SodTyp)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      seZalohou === opt.val
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-primary-light'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SEKCE 2 — Klient */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
          <SectionTitle>Klient</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Jméno a příjmení" required>
                <input type="text" value={klientJmeno} onChange={e => setKlientJmeno(e.target.value)} required className={inputCls} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Adresa">
                <input type="text" value={klientAdresa} onChange={e => setKlientAdresa(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="E-mail" required>
              <input type="email" value={klientEmail} onChange={e => setKlientEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Telefon" required>
              <input type="tel" value={klientTelefon} onChange={e => setKlientTelefon(e.target.value)} className={inputCls} />
            </Field>
            <Field label="IČO">
              <input type="text" value={klientIco} onChange={e => setKlientIco(e.target.value)} className={inputCls} />
            </Field>
            <Field label="DIČ">
              <input type="text" value={klientDic} onChange={e => setKlientDic(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* SEKCE 3 — Kontaktní osoba */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
          <SectionTitle>Kontaktní osoba</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Jméno">
              <input type="text" value={kontaktniOsoba} onChange={e => setKontaktniOsoba(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Telefon">
              <input type="tel" value={kontaktniTelefon} onChange={e => setKontaktniTelefon(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* SEKCE 4 — Dílo */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
          <SectionTitle>Dílo</SectionTitle>
          <div className="space-y-4">
            <Field label="Předmět díla" required>
              <input type="text" value={predmetDila} onChange={e => setPredmetDila(e.target.value)} required className={inputCls} />
            </Field>
            <Field label="Adresa díla" required>
              <input type="text" value={adresaDila} onChange={e => setAdresaDila(e.target.value)} required className={inputCls} />
            </Field>
          </div>
        </div>

        {/* SEKCE 5 — Termíny */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
          <SectionTitle>Termíny</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Termín převzetí staveniště">
              <input type="date" value={terminPrevzeti} onChange={e => setTerminPrevzeti(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Počet dní realizace">
              <input type="number" value={pocetDniRealizace} onChange={e => setPocetDniRealizace(e.target.value)} min="1" className={inputCls} />
            </Field>
            <Field label="Nejzazší termín změny">
              <input type="date" value={zmenaTerm} onChange={e => setZmenaTerm(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* SEKCE 6 — Cena */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
          <SectionTitle>Cena</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Cena bez DPH">
              <div className={readonlyCls}>{fmtKc(cenaBezDph)}</div>
            </Field>
            <Field label="DPH sazba">
              <div className={readonlyCls}>{dphSazba} %</div>
            </Field>
            <Field label="Cena s DPH">
              <div className={readonlyCls}>{fmtKc(cenaSDph)}</div>
            </Field>
          </div>
        </div>

        {/* SEKCE 7 — Záloha */}
        {seZalohou && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
            <SectionTitle>Záloha</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Výše zálohy (Kč)">
                <input type="number" value={zalohaKc} onChange={e => setZalohaKc(e.target.value)} min="0" step="1" className={inputCls} />
              </Field>
              <Field label="Splatnost zálohy (dní)">
                <input type="number" value={zalohaSplatnost} onChange={e => setZalohaSplatnost(e.target.value)} min="1" className={inputCls} />
              </Field>
              <Field label="Kategorie zálohy">
                <input type="text" value={zalohaKategorie} onChange={e => setZalohaKategorie(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>
        )}

        {/* Akce */}
        <div className="flex items-center justify-end gap-3 pb-6">
          {dealId && (
            <Link
              href={`/deals/${dealId}?tab=smlouvy`}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Zrušit
            </Link>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
          >
            {saving ? 'Ukládám…' : 'Vytvořit smlouvu'}
          </button>
        </div>
      </form>
    </div>
  )
}
