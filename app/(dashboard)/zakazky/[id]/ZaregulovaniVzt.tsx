'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { formatCislo } from '@/lib/format'
import {
  KONTROLY, METODY, VYCHOZI_TOLERANCE, MAX_VYUSTEK, odchylka, vTolerance,
  type KontrolaKey, type TypVyustky,
} from '@/lib/zaregulovaniVztData'

interface Props {
  zakazkaId: string
  /** předvyplněné jméno měřícího (přihlášený uživatel) */
  provedl: string
}

type Pole = Record<string, string>
interface Radek { key: number; mistnost: string; typ: TypVyustky; prvek: string; navrh: string; namereno: string; nastaveni: string }

const dnes = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date())
const cislo = (s: string) => {
  if (s.trim() === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
let dalsiKey = 1
const novyRadek = (typ: TypVyustky): Radek => ({ key: dalsiKey++, mistnost: '', typ, prvek: '', navrh: '', namereno: '', nastaveni: '' })

function Num({ label, value, onChange, jednotka }: { label: string; value: string; onChange: (v: string) => void; jednotka: string }) {
  return (
    <Field label={`${label} [${jednotka}]`}>
      <Input kind="castka" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function Odchylka({ navrh, namereno, tolerance }: { navrh: string; namereno: string; tolerance: number }) {
  const o = odchylka(cislo(navrh), cislo(namereno))
  if (o == null) return <span className="text-muted">—</span>
  const ok = vTolerance(o, tolerance)
  return <span className={cn('font-semibold tabular-nums', ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>{o > 0 ? '+' : ''}{formatCislo(o)} %</span>
}

/** Volitelný Protokol o zaregulování VZT (ČSN EN 12599 / 14134) — formulář → PDF do Podkladů + stažení. */
export default function ZaregulovaniVzt({ zakazkaId, provedl: vychoziProvedl }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [chyba, setChyba] = useState<string | null>(null)

  const [datum, setDatum] = useState(dnes())
  const [provedl, setProvedl] = useState(vychoziProvedl)
  const [j, setJ] = useState<Pole>({ typ: '', vyrobniCislo: '', umisteni: '', rezim: '' })
  const [p, setP] = useState<Pole>({ typ: '', vyrobniCislo: '', kalibrace: '' })
  const [metoda, setMetoda] = useState<string>(METODY[0])
  const [c, setC] = useState<Pole>({ privodNavrh: '', privodNamereno: '', odvodNavrh: '', odvodNamereno: '' })
  const [t, setT] = useState<Pole>({ venkovni: '', privod: '', odvod: '', odpadni: '' })
  const [tolerance, setTolerance] = useState(String(VYCHOZI_TOLERANCE))
  const [radky, setRadky] = useState<Radek[]>(() => [novyRadek('PRIVOD'), novyRadek('ODVOD')])
  const [kontroly, setKontroly] = useState<Record<KontrolaKey, boolean>>(
    () => Object.fromEntries(KONTROLY.map(({ key }) => [key, false])) as Record<KontrolaKey, boolean>,
  )
  const [vysledek, setVysledek] = useState<'VYHOVEL' | 'NEVYHOVEL'>('VYHOVEL')
  const [poznamka, setPoznamka] = useState('')

  const tol = cislo(tolerance) ?? VYCHOZI_TOLERANCE
  const setPole = (set: React.Dispatch<React.SetStateAction<Pole>>, k: string) => (v: string) => set((o) => ({ ...o, [k]: v }))
  const upravRadek = (key: number, zmena: Partial<Radek>) => setRadky((rs) => rs.map((r) => (r.key === key ? { ...r, ...zmena } : r)))
  const mimoTol = radky.filter((r) => vTolerance(odchylka(cislo(r.navrh), cislo(r.namereno)), tol) === false).length

  async function odeslat() {
    setChyba(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/zaregulovani-vzt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datum, provedl, jednotka: j, pristroj: p, metoda, celkem: c, teploty: t,
          tolerance, kontroly, vysledek, poznamka,
          vyustky: radky.map((r) => ({ mistnost: r.mistnost, typ: r.typ, prvek: r.prvek, navrh: r.navrh, namereno: r.namereno, nastaveni: r.nastaveni })),
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => null)
        setChyba(e?.error ?? 'Protokol se nepodařilo vytvořit.')
        return
      }
      const blob = await res.blob()
      const nazev = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'Zaregulovani-VZT.pdf'
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

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-fg">Protokol o zaregulování VZT</p>
          <p className="text-xs text-muted">Volitelný — rekuperace / vzduchotechnika, průtoky dle ČSN EN 12599 a ČSN EN 14134. PDF se uloží do Podkladů.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Vytvořit protokol</Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Protokol o zaregulování VZT" size="2xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button loading={saving} onClick={odeslat}>Vytvořit PDF</Button>
          </div>
        }>
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Datum měření" required><Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></Field>
            <Field label="Měření provedl"><Input value={provedl} onChange={(e) => setProvedl(e.target.value)} /></Field>
          </div>

          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-fg">Jednotka</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Výrobce a typ"><Input value={j.typ} placeholder="např. Atrea Duplex 370 EC5" onChange={(e) => setPole(setJ, 'typ')(e.target.value)} /></Field>
              <Field label="Výrobní číslo"><Input value={j.vyrobniCislo} onChange={(e) => setPole(setJ, 'vyrobniCislo')(e.target.value)} /></Field>
              <Field label="Umístění"><Input value={j.umisteni} placeholder="technická místnost, půda…" onChange={(e) => setPole(setJ, 'umisteni')(e.target.value)} /></Field>
              <Field label="Nastavený režim / stupeň" hint="při kterém se měřilo"><Input value={j.rezim} placeholder="např. stupeň 2 / 60 %" onChange={(e) => setPole(setJ, 'rezim')(e.target.value)} /></Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-fg">Měřicí přístroj</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Přístroj"><Input value={p.typ} placeholder="např. Testo 420" onChange={(e) => setPole(setP, 'typ')(e.target.value)} /></Field>
              <Field label="Výrobní číslo"><Input value={p.vyrobniCislo} onChange={(e) => setPole(setP, 'vyrobniCislo')(e.target.value)} /></Field>
              <Field label="Datum kalibrace"><Input type="date" value={p.kalibrace} onChange={(e) => setPole(setP, 'kalibrace')(e.target.value)} /></Field>
              <Field label="Metoda měření">
                <Select value={metoda} onChange={(e) => setMetoda(e.target.value)}>
                  {METODY.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-fg">Celkové průtoky</legend>
            <p className="text-xs text-muted">Když u větve nevyplníte nic, doplní se v protokolu součtem vyústek.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Num label="Přívod — návrh" jednotka="m³/h" value={c.privodNavrh} onChange={setPole(setC, 'privodNavrh')} />
              <Num label="Přívod — naměřeno" jednotka="m³/h" value={c.privodNamereno} onChange={setPole(setC, 'privodNamereno')} />
              <Num label="Odvod — návrh" jednotka="m³/h" value={c.odvodNavrh} onChange={setPole(setC, 'odvodNavrh')} />
              <Num label="Odvod — naměřeno" jednotka="m³/h" value={c.odvodNamereno} onChange={setPole(setC, 'odvodNamereno')} />
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-fg">Průtoky na vyústkách</legend>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Field label="Povolená odchylka [± %]" className="w-44">
                <Input kind="cislo" value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
              </Field>
              {mimoTol > 0 && <p className="text-sm font-medium text-red-600 dark:text-red-400">Mimo toleranci: {mimoTol}</p>}
            </div>
            <ul className="space-y-3">
              {radky.map((r) => (
                <li key={r.key} className="rounded-lg bg-surface-2 p-3 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                  <Field label="Místnost" className="col-span-2"><Input value={r.mistnost} onChange={(e) => upravRadek(r.key, { mistnost: e.target.value })} /></Field>
                  <Field label="Větev">
                    <Select value={r.typ} onChange={(e) => upravRadek(r.key, { typ: e.target.value as TypVyustky })}>
                      <option value="PRIVOD">Přívod</option>
                      <option value="ODVOD">Odvod</option>
                    </Select>
                  </Field>
                  <Field label="Prvek"><Input value={r.prvek} placeholder="ventil DN125" onChange={(e) => upravRadek(r.key, { prvek: e.target.value })} /></Field>
                  <Field label="Nastavení" className="col-span-2 sm:col-span-2"><Input value={r.nastaveni} placeholder="např. 4 otáčky" onChange={(e) => upravRadek(r.key, { nastaveni: e.target.value })} /></Field>
                  <Field label="Návrh [m³/h]"><Input kind="castka" value={r.navrh} onChange={(e) => upravRadek(r.key, { navrh: e.target.value })} /></Field>
                  <Field label="Naměřeno [m³/h]"><Input kind="castka" value={r.namereno} onChange={(e) => upravRadek(r.key, { namereno: e.target.value })} /></Field>
                  <div className="pb-2 text-sm">Odchylka: <Odchylka navrh={r.navrh} namereno={r.namereno} tolerance={tol} /></div>
                  <IconButton label="Odebrat vyústku" tone="danger" className="justify-self-end sm:col-start-6" onClick={() => setRadky((rs) => rs.filter((x) => x.key !== r.key))}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                  </IconButton>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={radky.length >= MAX_VYUSTEK} onClick={() => setRadky((rs) => [...rs, novyRadek('PRIVOD')])}>+ Přívod</Button>
              <Button variant="secondary" size="sm" disabled={radky.length >= MAX_VYUSTEK} onClick={() => setRadky((rs) => [...rs, novyRadek('ODVOD')])}>+ Odvod</Button>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-fg">Teploty (nepovinné)</legend>
            <p className="text-xs text-muted">Z venkovní, přívodní a odvodní teploty se v protokolu spočítá orientační účinnost rekuperace.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Num label="Venkovní (sání)" jednotka="°C" value={t.venkovni} onChange={setPole(setT, 'venkovni')} />
              <Num label="Přívod do místností" jednotka="°C" value={t.privod} onChange={setPole(setT, 'privod')} />
              <Num label="Odvod z místností" jednotka="°C" value={t.odvod} onChange={setPole(setT, 'odvod')} />
              <Num label="Odpadní (výfuk)" jednotka="°C" value={t.odpadni} onChange={setPole(setT, 'odpadni')} />
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-fg">Kontrola instalace</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {KONTROLY.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={kontroly[key]} onChange={(e) => setKontroly((k) => ({ ...k, [key]: e.target.checked }))} className="w-5 h-5 rounded accent-green-600" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Výsledek" required>
              <Select value={vysledek} onChange={(e) => setVysledek(e.target.value as 'VYHOVEL' | 'NEVYHOVEL')}>
                <option value="VYHOVEL">Zaregulováno — vyhovuje</option>
                <option value="NEVYHOVEL">Nevyhovuje</option>
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
