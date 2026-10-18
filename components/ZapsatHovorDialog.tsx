'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { TECHNOLOGIE_LABEL, addDaysStr } from '@/lib/calendarEvents'
import type { HovorShody } from '@/lib/zapisHovoru'
import ZdrojPoptavkyPole, { PRAZDNY_ZDROJ, zdrojPayload } from '@/components/ZdrojPoptavkyPole'

/**
 * „Zapsat hovor" — telefon → kdo volá (klient s OP / lead) → kam hovor zapsat
 * (k OP, k leadu, nový lead, rovnou nový OP) + poznámka a další krok.
 * Hovor se uloží jako hotová aktivita, další krok jako naplánovaná.
 */

type Cil =
  | { cil: 'OP'; dealId: string; label: string }
  | { cil: 'LEAD'; leadId?: string; label: string }
  | { cil: 'NOVY_OP'; clientId?: string; leadId?: string; label: string }

type DalsiTyp = '' | 'HOVOR' | 'EMAIL' | 'SCHUZKA'

const DALSI_LABEL: Record<Exclude<DalsiTyp, ''>, string> = {
  HOVOR: 'Zavolat znovu',
  EMAIL: 'Poslat e-mail',
  SCHUZKA: 'Schůzka / zaměření',
}

// eslint-disable-next-line no-restricted-syntax -- dnešní den YYYY-MM-DD (Praha) pro <input type=date>, ne formátování pro UI
const dnes = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })

export interface ZapsatHovorPredvyplneni {
  telefon?: string
}

export default function ZapsatHovorDialog({ open, onClose, predvyplneni }: {
  open: boolean
  onClose: () => void
  predvyplneni?: ZapsatHovorPredvyplneni
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const maLeady = session?.user?.plan !== 'STARTER'

  const [telefon, setTelefon] = useState(predvyplneni?.telefon ?? '')
  const [shody, setShody] = useState<HovorShody | null>(null)
  const [hledam, setHledam] = useState(false)
  const [vybrano, setVybrano] = useState(0)
  const [jmeno, setJmeno] = useState('')
  const [firma, setFirma] = useState('')
  const [smer, setSmer] = useState<'PRICHOZI' | 'ODCHOZI'>('PRICHOZI')
  const [poznamka, setPoznamka] = useState('')
  const [technologie, setTechnologie] = useState('')
  const [predmet, setPredmet] = useState('')
  const [zdroj, setZdroj] = useState(PRAZDNY_ZDROJ)
  const [dalsiTyp, setDalsiTyp] = useState<DalsiTyp>('')
  const [dalsiDatum, setDalsiDatum] = useState(addDaysStr(dnes(), 1))
  const [dalsiPopis, setDalsiPopis] = useState('')
  const [ukladam, setUkladam] = useState(false)

  useEffect(() => {
    if (open) setTelefon(predvyplneni?.telefon ?? '')
  }, [open, predvyplneni?.telefon])

  // Hledání volajícího podle čísla (s malou prodlevou při psaní)
  useEffect(() => {
    const cislic = telefon.replace(/\D/g, '').length
    if (!open || cislic < 6) { setShody(null); return }
    let zruseno = false
    setHledam(true)
    const t = setTimeout(async () => {
      const res = await api.get<HovorShody>(`/api/hovor/najit?tel=${encodeURIComponent(telefon)}`, { silent: true })
      if (zruseno) return
      setShody(res.ok && res.data ? res.data : { klienti: [], leady: [] })
      setVybrano(0)
      setHledam(false)
    }, 350)
    return () => { zruseno = true; clearTimeout(t) }
  }, [telefon, open])

  const moznosti = useMemo<Cil[]>(() => {
    const m: Cil[] = []
    for (const k of shody?.klienti ?? []) {
      for (const op of k.otevreneOp) {
        m.push({ cil: 'OP', dealId: op.id, label: `K OP ${[op.kod, op.predmet].filter(Boolean).join(' · ')} (${k.nazev})` })
      }
    }
    if (maLeady) for (const l of shody?.leady ?? []) m.push({ cil: 'LEAD', leadId: l.id, label: `K leadu ${l.jmeno}${l.firma ? ` (${l.firma})` : ''}` })
    for (const k of shody?.klienti ?? []) m.push({ cil: 'NOVY_OP', clientId: k.id, label: `Nový OP pro ${k.nazev}` })
    if (maLeady) for (const l of shody?.leady ?? []) m.push({ cil: 'NOVY_OP', leadId: l.id, label: `Převést lead ${l.jmeno} na OP` })
    if (maLeady) m.push({ cil: 'LEAD', label: 'Nový lead — ještě nevím, jestli se pojede' })
    m.push({ cil: 'NOVY_OP', label: 'Rovnou nový OP — vím, že se tam pojede' })
    return m
  }, [shody, maLeady])

  const cil = moznosti[Math.min(vybrano, moznosti.length - 1)]
  const novyKontakt = (cil.cil === 'LEAD' && !cil.leadId) || (cil.cil === 'NOVY_OP' && !cil.clientId && !cil.leadId)
  const naLeadu = cil.cil === 'LEAD'
  // Zdroj poptávky jen u nově vznikajícího leadu / OP (převod leadu převezme jeho zdroj)
  const zadatZdroj = (cil.cil === 'LEAD' || cil.cil === 'NOVY_OP') && !cil.leadId
  const dalsiTypy = (Object.keys(DALSI_LABEL) as Exclude<DalsiTyp, ''>[]).filter(t => !naLeadu || t !== 'SCHUZKA')
  const shodaCelkem = (shody?.klienti.length ?? 0) + (maLeady ? shody?.leady.length ?? 0 : 0)

  useEffect(() => {
    if (naLeadu && dalsiTyp === 'SCHUZKA') setDalsiTyp('HOVOR')
  }, [naLeadu, dalsiTyp])

  function reset() {
    setTelefon(''); setShody(null); setVybrano(0); setJmeno(''); setFirma(''); setSmer('PRICHOZI')
    setPoznamka(''); setTechnologie(''); setPredmet(''); setZdroj(PRAZDNY_ZDROJ); setDalsiTyp(''); setDalsiDatum(addDaysStr(dnes(), 1)); setDalsiPopis('')
  }

  function zavrit() {
    reset()
    onClose()
  }

  async function ulozit(e: React.FormEvent) {
    e.preventDefault()
    setUkladam(true)
    try {
      const res = await api.post<{ cil: string; dealId?: string; leadId?: string }>('/api/hovor', {
        cil: cil.cil,
        dealId: cil.cil === 'OP' ? cil.dealId : undefined,
        leadId: cil.cil !== 'OP' ? cil.leadId : undefined,
        clientId: cil.cil === 'NOVY_OP' ? cil.clientId : undefined,
        smer,
        telefon: telefon || null,
        jmeno: jmeno || null,
        firma: firma || null,
        poznamka: poznamka || null,
        technologie: cil.cil === 'NOVY_OP' ? technologie : undefined,
        predmet: cil.cil === 'NOVY_OP' ? predmet || null : undefined,
        ...(zadatZdroj ? zdrojPayload(zdroj) : {}),
        dalsiKrok: dalsiTyp ? { typ: dalsiTyp, datum: new Date(`${dalsiDatum}T08:00:00`).toISOString(), popis: dalsiPopis || null } : null,
      })
      if (!res.ok || !res.data) return
      const href = res.data.dealId ? `/deals/${res.data.dealId}?tab=aktivity` : `/leady/${res.data.leadId}`
      toast.success(res.data.dealId ? 'Hovor zapsán k obchodnímu případu' : 'Hovor zapsán k leadu', {
        action: { label: 'Otevřít', onClick: () => router.push(href) },
      })
      zavrit()
      router.refresh()
    } finally {
      setUkladam(false)
    }
  }

  const chybiJmeno = novyKontakt && !jmeno.trim() && !firma.trim()
  const chybiTechnologie = cil.cil === 'NOVY_OP' && !technologie

  return (
    <Dialog
      open={open}
      onClose={zavrit}
      title="Zapsat hovor"
      size="lg"
      footer={<>
        <Button variant="secondary" onClick={zavrit}>Zrušit</Button>
        <Button type="submit" form="zapsat-hovor" loading={ukladam} disabled={chybiJmeno || chybiTechnologie}>Zapsat hovor</Button>
      </>}
    >
      <form id="zapsat-hovor" onSubmit={ulozit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Telefon" hint={hledam ? 'Hledám…' : shody ? (shodaCelkem ? `Nalezeno: ${shodaCelkem}` : 'Číslo zatím neznáme') : 'Najde klienta nebo lead'}>
            <Input kind="tel" value={telefon} onChange={e => setTelefon(e.target.value)} data-autofocus placeholder="777 123 456" />
          </Field>
          <Field label="Směr">
            <div className="flex gap-1.5" role="radiogroup" aria-label="Směr hovoru">
              {(['PRICHOZI', 'ODCHOZI'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={smer === s}
                  onClick={() => setSmer(s)}
                  className={cn(
                    'flex-1 h-10 rounded-lg border text-sm font-medium',
                    smer === s ? 'border-primary bg-primary/10 text-primary dark:text-primary-light' : 'border-line text-muted',
                  )}
                >
                  {s === 'PRICHOZI' ? 'Příchozí' : 'Odchozí'}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-fg mb-1.5">Kam hovor zapsat</legend>
          <div className="space-y-1.5">
            {moznosti.map((m, i) => (
              <label
                key={`${m.cil}-${'dealId' in m ? m.dealId : ''}-${'leadId' in m ? m.leadId ?? '' : ''}-${'clientId' in m ? m.clientId ?? '' : ''}`}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm',
                  i === vybrano ? 'border-primary bg-primary/5' : 'border-line hover:bg-surface-2',
                )}
              >
                <input type="radio" name="cil-hovoru" checked={i === vybrano} onChange={() => setVybrano(i)} className="text-primary" />
                <span className="text-fg">{m.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {novyKontakt && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Jméno" required={!firma.trim()}>
              <Input value={jmeno} onChange={e => setJmeno(e.target.value)} placeholder="Jan Novák" />
            </Field>
            <Field label="Firma" hint="Jen u firemního zákazníka">
              <Input value={firma} onChange={e => setFirma(e.target.value)} />
            </Field>
          </div>
        )}

        {cil.cil === 'NOVY_OP' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Technologie" required>
              <Select value={technologie} onChange={e => setTechnologie(e.target.value)}>
                <option value="">— vyberte —</option>
                {Object.entries(TECHNOLOGIE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Předmět">
              <Input value={predmet} onChange={e => setPredmet(e.target.value)} placeholder="Např. klimatizace do ložnice" />
            </Field>
          </div>
        )}

        {zadatZdroj && <ZdrojPoptavkyPole value={zdroj} onChange={setZdroj} />}

        <Field label="Poznámka k hovoru" hint="Co chtěl, na čem jste se domluvili">
          <Textarea rows={3} value={poznamka} onChange={e => setPoznamka(e.target.value)} />
        </Field>

        <div className="rounded-xl border border-line p-3 space-y-3">
          <Field label="Další krok">
            <Select value={dalsiTyp} onChange={e => setDalsiTyp(e.target.value as DalsiTyp)}>
              <option value="">Nic dalšího</option>
              {dalsiTypy.map(t => <option key={t} value={t}>{DALSI_LABEL[t]}</option>)}
            </Select>
          </Field>
          {dalsiTyp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Kdy">
                <Input type="date" value={dalsiDatum} min={dnes()} onChange={e => setDalsiDatum(e.target.value)} required />
                <div className="flex gap-1.5 mt-1.5">
                  {[['Zítra', 1], ['Za 3 dny', 3], ['Za týden', 7]].map(([l, d]) => (
                    <button key={l} type="button" data-compact onClick={() => setDalsiDatum(addDaysStr(dnes(), Number(d)))} className="hit-area text-xs text-primary dark:text-primary-light hover:underline">
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Poznámka ke kroku">
                <Input value={dalsiPopis} onChange={e => setDalsiPopis(e.target.value)} placeholder={dalsiTyp === 'HOVOR' ? 'Ověřit, jestli je to aktuální' : ''} />
              </Field>
            </div>
          )}
        </div>
      </form>
    </Dialog>
  )
}

/** Tlačítko + dialog (pro serverové stránky, např. Nástěnka). */
export function ZapsatHovorButton({ className, variant = 'secondary' }: { className?: string; variant?: 'secondary' | 'primary' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className={className}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        Zapsat hovor
      </Button>
      <ZapsatHovorDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
