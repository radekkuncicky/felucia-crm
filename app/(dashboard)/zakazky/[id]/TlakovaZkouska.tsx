'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { toast } from 'sonner'
import { pokles } from '@/lib/tlakovaZkouskaData'
import { formatCislo } from '@/lib/format'

interface Props {
  zakazkaId: string
  /** předvolba: podlahovka / TČ podle technologie zakázky */
  technologie: string | null
  /** předvyplněné jméno zkoušejícího (přihlášený uživatel) */
  zkousel: string
}

type Pole = Record<string, string>

const dnes = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date())
const cislo = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

function Num({ label, value, onChange, jednotka }: { label: string; value: string; onChange: (v: string) => void; jednotka: string }) {
  return (
    <Field label={`${label} [${jednotka}]`}>
      <Input kind="castka" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

/** Volitelný Protokol o tlakové zkoušce — formulář → PDF do Podkladů + stažení. */
export default function TlakovaZkouska({ zakazkaId, technologie, zkousel: vychoziZkousel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [chyba, setChyba] = useState<string | null>(null)

  const [datum, setDatum] = useState(dnes())
  const [zkousel, setZkousel] = useState(vychoziZkousel)
  const [sPodlahovka, setSPodlahovka] = useState(technologie !== 'TEPELNE_CERPADLO')
  const [sTc, setSTc] = useState(technologie === 'TEPELNE_CERPADLO')
  const [sDusik, setSDusik] = useState(false)
  const [p, setP] = useState<Pole>({ trubkaTyp: 'PE-Xa', trubkaDimenze: '16×2', pocetOkruhu: '', delkaM: '', rozdelovac: '', medium: 'VODA', zkusebniTlak: '6', provozniTlak: '', dobaH: '24', tlakZacatek: '', tlakKonec: '', teplota: '' })
  const [betonaz, setBetonaz] = useState(false)
  const [t, setT] = useState<Pole>({ zkusebniTlak: '', dobaH: '', tlakZacatek: '', tlakKonec: '' })
  const [d, setD] = useState<Pole>({ tlak: '', dobaH: '', vakuumPa: '', dobaVakuaMin: '' })
  const [vysledek, setVysledek] = useState<'VYHOVEL' | 'NEVYHOVEL'>('VYHOVEL')
  const [poznamka, setPoznamka] = useState('')

  const setPole = (set: React.Dispatch<React.SetStateAction<Pole>>, k: string) => (v: string) => set((o) => ({ ...o, [k]: v }))
  const poklesText = (z: string, k: string) => {
    const v = pokles(cislo(z), cislo(k))
    return v == null || Number.isNaN(v) ? null : `Pokles: ${formatCislo(v)} bar`
  }

  async function odeslat() {
    setChyba(null)
    if (!sPodlahovka && !sTc) { setChyba('Zvolte aspoň jednu zkoušku.'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/tlakova-zkouska`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datum, zkousel, vysledek, poznamka,
          podlahovka: sPodlahovka ? { ...p, podTlakemPriBetonazi: betonaz } : null,
          tc: sTc ? { ...t, dusik: sDusik ? d : null } : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setChyba(j?.error ?? 'Protokol se nepodařilo vytvořit.')
        return
      }
      const blob = await res.blob()
      const nazev = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'Tlakova-zkouska.pdf'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nazev
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      toast.success('Protokol uložen do Podkladů zakázky')
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const zaskrt = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm font-medium text-fg cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 rounded accent-green-600" />
      {label}
    </label>
  )

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-fg">Protokol o tlakové zkoušce</p>
          <p className="text-xs text-muted">Volitelný — podlahové vytápění (ČSN EN 1264-4) a tepelné čerpadlo. PDF se uloží do Podkladů.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Vytvořit protokol</Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Protokol o tlakové zkoušce" size="xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button loading={saving} onClick={odeslat}>Vytvořit PDF</Button>
          </div>
        }>
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Datum zkoušky" required><Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></Field>
            <Field label="Zkoušku provedl"><Input value={zkousel} onChange={(e) => setZkousel(e.target.value)} /></Field>
          </div>

          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            {zaskrt('Podlahové vytápění (ČSN EN 1264-4)', sPodlahovka, setSPodlahovka)}
            {sPodlahovka && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Typ trubky"><Input value={p.trubkaTyp} onChange={(e) => setPole(setP, 'trubkaTyp')(e.target.value)} /></Field>
                <Field label="Dimenze"><Input value={p.trubkaDimenze} onChange={(e) => setPole(setP, 'trubkaDimenze')(e.target.value)} /></Field>
                <Field label="Počet okruhů"><Input kind="cislo" value={p.pocetOkruhu} onChange={(e) => setPole(setP, 'pocetOkruhu')(e.target.value)} /></Field>
                <Num label="Celková délka" jednotka="m" value={p.delkaM} onChange={setPole(setP, 'delkaM')} />
                <Field label="Rozdělovač"><Input value={p.rozdelovac} onChange={(e) => setPole(setP, 'rozdelovac')(e.target.value)} /></Field>
                <Field label="Médium">
                  <Select value={p.medium} onChange={(e) => setPole(setP, 'medium')(e.target.value)}>
                    <option value="VODA">Voda</option>
                    <option value="VZDUCH">Vzduch</option>
                  </Select>
                </Field>
                <Num label="Zkušební tlak" jednotka="bar" value={p.zkusebniTlak} onChange={setPole(setP, 'zkusebniTlak')} />
                <Num label="Provozní tlak" jednotka="bar" value={p.provozniTlak} onChange={setPole(setP, 'provozniTlak')} />
                <Num label="Doba zkoušky" jednotka="h" value={p.dobaH} onChange={setPole(setP, 'dobaH')} />
                <Num label="Teplota média" jednotka="°C" value={p.teplota} onChange={setPole(setP, 'teplota')} />
                <Num label="Tlak na začátku" jednotka="bar" value={p.tlakZacatek} onChange={setPole(setP, 'tlakZacatek')} />
                <Num label="Tlak na konci" jednotka="bar" value={p.tlakKonec} onChange={setPole(setP, 'tlakKonec')} />
                {poklesText(p.tlakZacatek, p.tlakKonec) && <p className="sm:col-span-2 text-sm text-muted">{poklesText(p.tlakZacatek, p.tlakKonec)}</p>}
                <div className="sm:col-span-2">{zaskrt('Potrubí pod tlakem při betonáži', betonaz, setBetonaz)}</div>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            {zaskrt('Tepelné čerpadlo — otopná soustava', sTc, setSTc)}
            {sTc && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Num label="Zkušební tlak" jednotka="bar" value={t.zkusebniTlak} onChange={setPole(setT, 'zkusebniTlak')} />
                  <Num label="Doba zkoušky" jednotka="h" value={t.dobaH} onChange={setPole(setT, 'dobaH')} />
                  <Num label="Tlak na začátku" jednotka="bar" value={t.tlakZacatek} onChange={setPole(setT, 'tlakZacatek')} />
                  <Num label="Tlak na konci" jednotka="bar" value={t.tlakKonec} onChange={setPole(setT, 'tlakKonec')} />
                  {poklesText(t.tlakZacatek, t.tlakKonec) && <p className="sm:col-span-2 text-sm text-muted">{poklesText(t.tlakZacatek, t.tlakKonec)}</p>}
                </div>
                {zaskrt('Split: dusíková zkouška chladivového okruhu', sDusik, setSDusik)}
                {sDusik && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Num label="Tlak dusíku" jednotka="bar" value={d.tlak} onChange={setPole(setD, 'tlak')} />
                    <Num label="Doba zkoušky" jednotka="h" value={d.dobaH} onChange={setPole(setD, 'dobaH')} />
                    <Num label="Dosažené vakuum" jednotka="Pa" value={d.vakuumPa} onChange={setPole(setD, 'vakuumPa')} />
                    <Num label="Doba vakuování" jednotka="min" value={d.dobaVakuaMin} onChange={setPole(setD, 'dobaVakuaMin')} />
                  </div>
                )}
              </>
            )}
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Výsledek" required>
              <Select value={vysledek} onChange={(e) => setVysledek(e.target.value as 'VYHOVEL' | 'NEVYHOVEL')}>
                <option value="VYHOVEL">Vyhověl</option>
                <option value="NEVYHOVEL">Nevyhověl</option>
              </Select>
            </Field>
          </div>
          <Field label="Poznámka"><Textarea rows={3} value={poznamka} onChange={(e) => setPoznamka(e.target.value)} /></Field>
          {chyba && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{chyba}</p>}
        </div>
      </Dialog>
    </>
  )
}
