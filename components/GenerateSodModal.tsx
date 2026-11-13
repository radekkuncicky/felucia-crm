'use client'

import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SOD_PLACEHOLDER_LABELS } from '@/lib/sodPlaceholders'
import { formatKc } from '@/lib/format'
import DateRangePickerInput from '@/components/DateRangePickerInput'
import SodPrilohyPicker, { defaultSodPrilohy, type SodPrilohy, type SodPrilohyDostupne } from '@/components/SodPrilohyPicker'
import { countWorkingDays, formatIsoCz } from '@/lib/workingDays'
import { ZalohaUpozorneni } from '@/components/ZalohaUpozorneni'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { AresFirma } from '@/lib/ares'
import { adresaKlientaText } from '@/lib/klientAdresa'

// Placeholdery, které mají v modalu vlastní pole (níže). Zbytek prázdných
// se vypíše dynamicky jako „Doplnit do smlouvy".
const DEDICATED = new Set(['klient_adresa', 'adresa_dila', 'klient_ico', 'klient_dic', 'termin_prevzeti', 'termin_realizace', 'pocet_dni_realizace', 'zmena_term', 'hodnota_zalohy', 'zaloha_splatnost', 'kontaktni_osoba', 'kontaktni_telefon'])

interface Template {
  id: string
  nazev: string
}

interface CheckData {
  emptyPlaceholders: string[]
  usedPlaceholders: string[]
  seZalohou: boolean
  prilohy: SodPrilohyDostupne
  objednatel: { typKlienta: string; sidlo: string; ico: string; dic: string; adresaDila: string }
  prefill: {
    realizaceOd: string
    realizaceDo: string
    terminPrevzeti: string
    pocetDniRealizace: string
    zmenaTerm: string
    kontaktniOsoba: string
    kontaktniTelefon: string
    zalohaKc: number
    zalohaSplatnost: number
    cenaBezDph: number
    cenaSDph: number
    dphSazba: number
  }
}

interface Props {
  dealId: string
  templates: Template[]
  onClose: () => void
}

const fmtKc = formatKc

const inputCls = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
const inputEmptyCls = 'w-full border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 text-sm bg-amber-50 dark:bg-amber-900/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40'

function Label({ children, empty }: { children: React.ReactNode; empty?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
      {children}
      {empty && <span className="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">prázdné v šabloně</span>}
    </label>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
      {children}
    </p>
  )
}

export default function GenerateSodModal({ dealId, templates, onClose }: Props) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [checkData, setCheckData] = useState<CheckData | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // Termín realizace: výběr dnů v kalendáři (od = předání staveniště, do = předání díla),
  // nebo volný text (např. „Q3/2026") jako dřív.
  const [terminMode, setTerminMode] = useState<'kalendar' | 'text'>('kalendar')
  const [realizaceOd, setRealizaceOd] = useState('')
  const [realizaceDo, setRealizaceDo] = useState('')
  const [terminPrevzeti, setTerminPrevzeti] = useState('')
  const [pocetDniRealizace, setPocetDniRealizace] = useState('')
  const [prilohy, setPrilohy] = useState<SodPrilohy>(defaultSodPrilohy({ hasVop: false, hasVzsp: false, hasCenik: false }))
  const [zmenaTerm, setZmenaTerm] = useState('')
  const [zalohaKc, setZalohaKc] = useState('')
  const [zalohaSplatnost, setZalohaSplatnost] = useState('14')
  // Kontaktní osoba: 'op' = převzít z OP (jméno + telefon klienta), 'jina' = vypsat cizí osobu
  const [kontaktMode, setKontaktMode] = useState<'op' | 'jina'>('op')
  const [kontaktOsobaOp, setKontaktOsobaOp] = useState('')
  const [kontaktTelefonOp, setKontaktTelefonOp] = useState('')
  const [kontaktOsobaJina, setKontaktOsobaJina] = useState('')
  const [kontaktTelefonJina, setKontaktTelefonJina] = useState('')
  // Objednatel a místo instalace — sídlo se nesmí tiše zaměnit s místem instalace
  const [sidlo, setSidlo] = useState('')
  const [sidloCasti, setSidloCasti] = useState<{ ulice: string; mesto: string; psc: string } | null>(null)
  const [ico, setIco] = useState('')
  const [dic, setDic] = useState('')
  const [mistoShodne, setMistoShodne] = useState<boolean | null>(null)
  // chybu u nevybrané volby ukázat až po pokusu o vygenerování
  const [pokus, setPokus] = useState(false)
  const [adresaDila, setAdresaDila] = useState('')
  const [aresLoading, setAresLoading] = useState(false)
  const [aresInfo, setAresInfo] = useState('')
  // Dynamická pole pro ostatní prázdné placeholdery (klient_ico, klient_dic…)
  const [extra, setExtra] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!templateId) return
    setCheckData(null)
    setCheckLoading(true)
    setError('')
    fetch(`/api/sod/check?dealId=${dealId}&templateId=${templateId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setCheckData(data)
        setRealizaceOd(data.prefill.realizaceOd ?? '')
        setRealizaceDo(data.prefill.realizaceDo ?? '')
        setTerminPrevzeti(data.prefill.terminPrevzeti)
        setPocetDniRealizace(
          data.prefill.realizaceOd && data.prefill.realizaceDo
            ? String(countWorkingDays(data.prefill.realizaceOd, data.prefill.realizaceDo) || '')
            : data.prefill.pocetDniRealizace
        )
        setPrilohy(defaultSodPrilohy(data.prilohy ?? { hasVop: false, hasVzsp: false, hasCenik: false }))
        setZmenaTerm(data.prefill.zmenaTerm)
        setZalohaKc(data.prefill.zalohaKc > 0 ? String(data.prefill.zalohaKc) : '')
        setZalohaSplatnost(String(data.prefill.zalohaSplatnost))
        setKontaktOsobaOp(data.prefill.kontaktniOsoba)
        setKontaktTelefonOp(data.prefill.kontaktniTelefon)
        setKontaktMode('op')
        setKontaktOsobaJina('')
        setKontaktTelefonJina('')
        setSidlo(data.objednatel?.sidlo ?? '')
        setSidloCasti(null)
        setIco(data.objednatel?.ico ?? '')
        setDic(data.objednatel?.dic ?? '')
        setAdresaDila(data.objednatel?.adresaDila ?? '')
        setMistoShodne(null)
        setAresInfo('')
        const extraInit: Record<string, string> = {}
        for (const k of data.emptyPlaceholders as string[]) {
          if (!DEDICATED.has(k)) extraInit[k] = ''
        }
        setExtra(extraInit)
      })
      .catch(() => setError('Chyba při načítání dat šablony'))
      .finally(() => setCheckLoading(false))
  }, [dealId, templateId])

  function handleRealizaceChange(range: { from: string; to: string }) {
    setRealizaceOd(range.from)
    setRealizaceDo(range.to)
    setTerminPrevzeti(range.from ? formatIsoCz(range.from) : '')
    if (range.from && range.to) {
      const n = countWorkingDays(range.from, range.to)
      if (n > 0) setPocetDniRealizace(String(n))
    }
  }

  async function nactiZAres() {
    const q = ico.replace(/\s/g, '')
    if (!/^\d{8}$/.test(q)) { setAresInfo('IČO má 8 číslic.'); return }
    setAresLoading(true)
    setAresInfo('')
    try {
      const res = await fetch(`/api/ares?q=${q}`)
      const list: AresFirma[] = res.ok ? await res.json() : []
      const f = list.find(x => x.ico === q) ?? list[0]
      if (!f) { setAresInfo('V ARES nenalezeno — vyplňte sídlo ručně.'); return }
      const text = adresaKlientaText(f)
      setSidlo(text)
      setSidloCasti({ ulice: f.ulice, mesto: f.mesto, psc: f.psc })
      if (!dic && f.dic) setDic(f.dic)
      setAresInfo(`Načteno z ARES: ${f.nazev}`)
    } finally {
      setAresLoading(false)
    }
  }

  async function handleGenerate() {
    setError('')
    setPokus(true)
    if (!sidlo.trim()) { setError('Vyplňte sídlo / trvalé bydliště objednatele.'); return }
    if (mistoShodne === null) { setError('Potvrďte, zda je místo instalace shodné se sídlem / bydlištěm.'); return }
    if (mistoShodne === false && !adresaDila.trim()) { setError('Vyplňte místo instalace.'); return }
    setGenerating(true)
    const kalendar = terminMode === 'kalendar'
    // Cizí kontaktní osoba jde jako override; „z OP" necháme na datech z OP.
    const allOverrides: Record<string, string> = { ...extra }
    if (kontaktMode === 'jina') {
      allOverrides['kontaktni_osoba'] = kontaktOsobaJina
      allOverrides['kontaktni_telefon'] = kontaktTelefonJina
    }
    try {
      const res = await fetch('/api/sod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          templateId,
          klientAdresa: sidlo.trim(),
          mistoShodne,
          adresaDila: mistoShodne ? sidlo.trim() : adresaDila.trim(),
          klientIco: ico.trim() || null,
          klientDic: dic.trim() || null,
          sidloCasti: sidloCasti && adresaKlientaText(sidloCasti) === sidlo.trim() ? sidloCasti : null,
          terminPrevzeti: (kalendar ? (realizaceOd ? formatIsoCz(realizaceOd) : '') : terminPrevzeti) || null,
          // konec realizace → {{termin_realizace}} v šabloně („Termín dokončení a předání díla")
          ...(kalendar && realizaceDo ? { terminRealizace: formatIsoCz(realizaceDo) } : {}),
          // ISO od–do → propíše se do termínů OP (kalendář)
          ...(kalendar ? { terminRealizaceOd: realizaceOd || null, terminRealizaceDo: realizaceDo || null } : {}),
          pocetDniRealizace: pocetDniRealizace ? Number(pocetDniRealizace) : null,
          ...prilohy,
          zmenaTerm: zmenaTerm || null,
          zalohaKc: checkData?.seZalohou && zalohaKc ? Number(zalohaKc) : null,
          zalohaSplatnost: checkData?.seZalohou ? Number(zalohaSplatnost) : null,
          overrides: allOverrides,
        }),
      })
      if (res.ok) {
        const sod = await res.json()
        toast.success('Smlouva vytvořena')
        router.push(`/sod/${sod.id}`)
      } else {
        const d = await res.json()
        setError(d.error ?? 'Chyba při generování')
        setGenerating(false)
      }
    } catch {
      setError('Chyba při generování')
      setGenerating(false)
    }
  }

  const empty = checkData?.emptyPlaceholders ?? []
  const used = checkData?.usedPlaceholders ?? []
  const showZmenaTerm = used.includes('zmena_term')
  const showKontakt = used.includes('kontaktni_osoba') || used.includes('kontaktni_telefon')
  const extraKeys = Object.keys(extra)
  const jeFirma = checkData?.objednatel?.typKlienta === 'FIRMA'

  return (
    <Dialog
      open
      onClose={generating ? () => {} : onClose}
      title="Nová smlouva o dílo"
      size="lg"
      closeOnBackdrop={!generating}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={generating}>Zrušit</Button>
          <Button onClick={handleGenerate} loading={generating} disabled={checkLoading || !checkData}>
            {generating ? 'Generuji…' : 'Generovat smlouvu'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
          {/* Výběr šablony */}
          <div>
            <Label>Šablona smlouvy</Label>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              disabled={generating}
              className={inputCls}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.nazev}</option>
              ))}
            </select>
          </div>

          {checkLoading && (
            <div className="text-sm text-gray-400 dark:text-slate-500 text-center py-3">
              Načítám data šablony…
            </div>
          )}

          {!checkLoading && empty.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                {empty.length === 1
                  ? '1 pole zůstane ve smlouvě prázdné'
                  : empty.length < 5
                    ? `${empty.length} pole zůstanou ve smlouvě prázdná`
                    : `${empty.length} polí zůstane ve smlouvě prázdných`}
                {' '}— vyplňte je níže.
              </span>
            </div>
          )}

          {!checkLoading && checkData && (
            <>
              {/* Cena – informativně */}
              {checkData.prefill.cenaSDph > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Cena bez DPH</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {fmtKc(checkData.prefill.cenaBezDph)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Cena s DPH ({checkData.prefill.dphSazba} %)
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {fmtKc(checkData.prefill.cenaSDph)}
                    </p>
                  </div>
                </div>
              )}

              {/* Objednatel a místo instalace */}
              <div className="space-y-3">
                <SectionHeading>Objednatel a místo instalace</SectionHeading>
                {jeFirma && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>IČO</Label>
                      <div className="flex gap-2">
                        <input type="text" inputMode="numeric" maxLength={8} value={ico} onChange={e => setIco(e.target.value)} disabled={generating} className={inputCls} placeholder="12345678" />
                        <Button type="button" variant="secondary" size="sm" loading={aresLoading} onClick={nactiZAres} disabled={generating}>ARES</Button>
                      </div>
                    </div>
                    <div>
                      <Label>DIČ</Label>
                      <input type="text" value={dic} onChange={e => setDic(e.target.value)} disabled={generating} className={inputCls} placeholder="CZ12345678" />
                    </div>
                    {!ico.trim() && (
                      <p className="sm:col-span-2 text-xs text-amber-700 dark:text-amber-300">U firmy doplňte IČO a sídlo načtěte z ARES — sídlo musí odpovídat obchodnímu rejstříku.</p>
                    )}
                    {aresInfo && <p className="sm:col-span-2 text-xs text-gray-500 dark:text-slate-400">{aresInfo}</p>}
                  </div>
                )}
                <div>
                  <Label>{jeFirma ? 'Sídlo objednatele (dle obchodního rejstříku)' : 'Trvalé bydliště objednatele'}</Label>
                  <input
                    type="text"
                    value={sidlo}
                    onChange={e => setSidlo(e.target.value)}
                    placeholder="Ulice 1, 700 00 Ostrava"
                    disabled={generating}
                    className={sidlo.trim() ? inputCls : inputEmptyCls}
                  />
                </div>
                <div role="radiogroup" aria-label="Místo instalace" className={`rounded-lg border px-3 py-2.5 space-y-2 text-sm ${pokus && mistoShodne === null ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-slate-600'}`}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="mistoShodne" checked={mistoShodne === true} onChange={() => setMistoShodne(true)} disabled={generating} className="accent-primary mt-0.5" />
                    <span className="text-gray-700 dark:text-slate-300">Místo instalace je <strong>shodné</strong> se {jeFirma ? 'sídlem' : 'bydlištěm'}</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="mistoShodne" checked={mistoShodne === false} onChange={() => setMistoShodne(false)} disabled={generating} className="accent-primary mt-0.5" />
                    <span className="text-gray-700 dark:text-slate-300">Místo instalace je <strong>jinde</strong></span>
                  </label>
                  {pokus && mistoShodne === null && <p className="text-xs text-red-600 dark:text-red-400" role="alert">Vyberte jednu možnost.</p>}
                </div>
                {mistoShodne === false && (
                  <div>
                    <Label>Místo instalace (adresa díla)</Label>
                    <input
                      type="text"
                      value={adresaDila}
                      onChange={e => setAdresaDila(e.target.value)}
                      placeholder="Ulice 1, 700 00 Ostrava"
                      disabled={generating}
                      className={adresaDila.trim() ? inputCls : inputEmptyCls}
                    />
                  </div>
                )}
              </div>

              {/* Termíny */}
              <div className="space-y-3">
                <SectionHeading>Termíny</SectionHeading>
                {terminMode === 'kalendar' ? (
                  <div>
                    <Label empty={empty.includes('termin_prevzeti') && !realizaceOd}>Termín realizace (od – do)</Label>
                    <DateRangePickerInput
                      from={realizaceOd}
                      to={realizaceDo}
                      onChange={handleRealizaceChange}
                      disabled={generating}
                      placeholder="Vyberte dny v kalendáři"
                      className={empty.includes('termin_prevzeti') && !realizaceOd ? inputEmptyCls : inputCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      První den = předání staveniště, poslední den = předání díla.{' '}
                      <button type="button" onClick={() => setTerminMode('text')} className="text-primary hover:underline" disabled={generating}>
                        Zadat volným textem
                      </button>
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label empty={empty.includes('termin_prevzeti')}>Termín předání staveniště</Label>
                    <input
                      type="text"
                      value={terminPrevzeti}
                      onChange={e => setTerminPrevzeti(e.target.value)}
                      placeholder="Q3/2026 nebo 30. 9. 2026"
                      disabled={generating}
                      className={empty.includes('termin_prevzeti') ? inputEmptyCls : inputCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      Volný text.{' '}
                      <button type="button" onClick={() => setTerminMode('kalendar')} className="text-primary hover:underline" disabled={generating}>
                        Vybrat dny v kalendáři
                      </button>
                    </p>
                  </div>
                )}
                <div>
                  <Label empty={empty.includes('pocet_dni_realizace') && !pocetDniRealizace}>Počet pracovních dní realizace</Label>
                  <input
                    type="number"
                    value={pocetDniRealizace}
                    onChange={e => setPocetDniRealizace(e.target.value)}
                    min="1"
                    placeholder="14"
                    disabled={generating}
                    className={empty.includes('pocet_dni_realizace') && !pocetDniRealizace ? inputEmptyCls : inputCls}
                  />
                </div>
                {showZmenaTerm && (
                  <div>
                    <Label empty={empty.includes('zmena_term')}>
                      Podmínka změny termínu
                      <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(nepovinné)</span>
                    </Label>
                    <input
                      type="text"
                      value={zmenaTerm}
                      onChange={e => setZmenaTerm(e.target.value)}
                      placeholder="při prodlení dodávky"
                      disabled={generating}
                      className={empty.includes('zmena_term') ? inputEmptyCls : inputCls}
                    />
                  </div>
                )}
              </div>

              {/* Kontaktní osoba */}
              {showKontakt && (
                <div className="space-y-3">
                  <SectionHeading>Kontaktní osoba</SectionHeading>
                  <div className="flex gap-4 text-sm">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={kontaktMode === 'op'}
                        onChange={() => setKontaktMode('op')}
                        disabled={generating}
                        className="accent-primary"
                      />
                      <span className="text-gray-700 dark:text-slate-300">Převzít z OP</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={kontaktMode === 'jina'}
                        onChange={() => setKontaktMode('jina')}
                        disabled={generating}
                        className="accent-primary"
                      />
                      <span className="text-gray-700 dark:text-slate-300">Jiná osoba</span>
                    </label>
                  </div>
                  {kontaktMode === 'op' ? (
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5 text-sm">
                      <p className="text-gray-900 dark:text-white">
                        {kontaktOsobaOp || <span className="text-gray-400 dark:text-slate-500">Jméno klienta z OP</span>}
                      </p>
                      {kontaktTelefonOp && (
                        <p className="text-gray-500 dark:text-slate-400 mt-0.5">{kontaktTelefonOp}</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Jméno</Label>
                        <input
                          type="text"
                          value={kontaktOsobaJina}
                          onChange={e => setKontaktOsobaJina(e.target.value)}
                          placeholder="Jan Novák"
                          disabled={generating}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <Label>Telefon</Label>
                        <input
                          type="text"
                          value={kontaktTelefonJina}
                          onChange={e => setKontaktTelefonJina(e.target.value)}
                          placeholder="+420…"
                          disabled={generating}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Záloha */}
              {checkData.seZalohou && (
                <div className="space-y-3">
                  <SectionHeading>Záloha</SectionHeading>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label empty={empty.includes('hodnota_zalohy')}>Výše zálohy (Kč)</Label>
                      <input
                        type="number"
                        value={zalohaKc}
                        onChange={e => setZalohaKc(e.target.value)}
                        min="0"
                        step="1"
                        placeholder="50000"
                        disabled={generating}
                        className={empty.includes('hodnota_zalohy') ? inputEmptyCls : inputCls}
                      />
                      <ZalohaUpozorneni zaloha={Number(zalohaKc) || 0} cenaSDph={checkData.prefill.cenaSDph} onNastavit={c => setZalohaKc(String(c))} />
                    </div>
                    <div>
                      <Label empty={empty.includes('zaloha_splatnost')}>Splatnost (dní)</Label>
                      <input
                        type="number"
                        value={zalohaSplatnost}
                        onChange={e => setZalohaSplatnost(e.target.value)}
                        min="1"
                        disabled={generating}
                        className={empty.includes('zaloha_splatnost') ? inputEmptyCls : inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Ostatní prázdná pole ze šablony (klient_ico, klient_dic…) */}
              {/* Přílohy PDF */}
              <div className="space-y-3">
                <SectionHeading>Přílohy ke smlouvě</SectionHeading>
                <p className="text-xs text-gray-400 dark:text-slate-500 -mt-1">
                  Zaškrtnuté dokumenty se připojí za smlouvu do výsledného PDF. Lze změnit i později v úpravě smlouvy.
                </p>
                <SodPrilohyPicker
                  value={prilohy}
                  dostupne={checkData.prilohy ?? { hasVop: false, hasVzsp: false, hasCenik: false }}
                  onChange={setPrilohy}
                  disabled={generating}
                />
              </div>

              {extraKeys.length > 0 && (
                <div className="space-y-3">
                  <SectionHeading>Doplnit do smlouvy</SectionHeading>
                  {extraKeys.map(k => (
                    <div key={k}>
                      <Label empty>{SOD_PLACEHOLDER_LABELS[k] ?? k}</Label>
                      <input
                        type="text"
                        value={extra[k]}
                        onChange={e => setExtra(prev => ({ ...prev, [k]: e.target.value }))}
                        disabled={generating}
                        className={extra[k]?.trim() ? inputCls : inputEmptyCls}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
      </div>
    </Dialog>
  )
}
