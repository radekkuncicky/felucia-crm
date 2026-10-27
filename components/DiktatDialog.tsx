'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { addDaysStr } from '@/lib/calendarEvents'
import { getPlanLimits } from '@/lib/planLimits'
import { zpracujDiktatSDasou } from '@/lib/diktatDasa'
import { DIKTAT_MAX } from '@/lib/diktat'
import { useOrgSettings } from '@/context/OrgSettingsContext'

/**
 * „Nadiktovat“ — hovor / poznámka hlasem (nebo psaním) se uloží jako úkol
 * na zítřek. Zpracovat ho jde hned nebo později s Dášou (lib/diktat.ts).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any

// eslint-disable-next-line no-restricted-syntax -- dnešní den YYYY-MM-DD (Praha) pro <input type=date>, ne formátování pro UI
const dnes = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })

/** Hlasový vstup cs-CZ — průběžně připisuje do textu, dokud se nezastaví */
export function useDiktovani(pripsat: (t: string) => void) {
  const [podpora, setPodpora] = useState(false)
  const [nahravam, setNahravam] = useState(false)
  const recRef = useRef<AnySpeechRecognition | null>(null)
  const pripsatRef = useRef(pripsat)
  pripsatRef.current = pripsat

  useEffect(() => {
    const w = window as AnySpeechRecognition
    setPodpora(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => recRef.current?.stop()
  }, [])

  function start() {
    const w = window as AnySpeechRecognition
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'cs-CZ'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e: AnySpeechRecognition) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) pripsatRef.current(String(e.results[i][0].transcript).trim())
      }
    }
    rec.onend = () => setNahravam(false)
    rec.onerror = () => setNahravam(false)
    recRef.current = rec
    rec.start()
    setNahravam(true)
  }

  function stop() {
    recRef.current?.stop()
    setNahravam(false)
  }

  return { podpora, nahravam, start, stop }
}

export function MikrofonButton({ nahravam, onClick }: { nahravam: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant={nahravam ? 'danger' : 'secondary'} onClick={onClick} aria-pressed={nahravam}>
      <svg className={cn('w-4 h-4', nahravam && 'animate-pulse')} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      {nahravam ? 'Zastavit' : 'Diktovat'}
    </Button>
  )
}

export default function DiktatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { data: session } = useSession()
  const orgSettings = useOrgSettings()
  const maDasu = getPlanLimits(session?.user?.plan ?? 'STARTER').canUseAI && orgSettings.modulDasa
  const [text, setText] = useState('')
  const [datum, setDatum] = useState(() => addDaysStr(dnes(), 1))
  const [ukladam, setUkladam] = useState(false)
  const mic = useDiktovani(t => setText(prev => (prev ? `${prev} ${t}` : t).slice(0, DIKTAT_MAX)))

  useEffect(() => {
    if (!open) return
    setText('')
    setDatum(addDaysStr(dnes(), 1))
  }, [open])

  function zavrit() {
    mic.stop()
    onClose()
  }

  async function ulozit(sDasou: boolean) {
    if (!text.trim()) return
    mic.stop()
    setUkladam(true)
    const res = await api.post<{ id: string }>('/api/diktat', { text, datum }, { errorMessage: 'Diktát se nepodařilo uložit.' })
    setUkladam(false)
    if (!res.ok || !res.data) return
    const id = res.data.id
    onClose()
    router.refresh()
    if (sDasou) {
      zpracujDiktatSDasou(id)
    } else {
      toast.success('Diktát uložen jako úkol', {
        action: maDasu ? { label: 'Zpracovat s Dášou', onClick: () => zpracujDiktatSDasou(id) } : undefined,
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={zavrit}
      title="Nadiktovat"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={zavrit}>Zrušit</Button>
          {maDasu && (
            <Button variant="secondary" onClick={() => ulozit(true)} disabled={!text.trim()} loading={ukladam}>
              Uložit a zpracovat s Dášou
            </Button>
          )}
          <Button onClick={() => ulozit(false)} disabled={!text.trim()} loading={ukladam}>Uložit úkol</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Co se stalo / co je potřeba"
          hint={`Kdo volal, telefon, co chce, kde. Uloží se jako úkol${maDasu ? ' a Dáša z něj pak založí lead, klienta nebo OP' : ''}.`}
        >
          <Textarea
            rows={7}
            value={text}
            maxLength={DIKTAT_MAX}
            onChange={e => setText(e.target.value)}
            placeholder="Např. Volal pan Novák z Opavy, 777 123 456, chce klimatizaci do dvou ložnic, ozvat se zítra odpoledne."
            autoFocus
          />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          {mic.podpora && <MikrofonButton nahravam={mic.nahravam} onClick={mic.nahravam ? mic.stop : mic.start} />}
          <Field label="Úkol na den" className="w-44">
            <Input type="date" value={datum} min={dnes()} onChange={e => setDatum(e.target.value)} />
          </Field>
        </div>
        {!mic.podpora && (
          <p className="text-xs text-muted">Hlasové zadávání tento prohlížeč neumí — použijte diktování na klávesnici telefonu.</p>
        )}
      </div>
    </Dialog>
  )
}

export function DiktatButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className={className}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        Nadiktovat
      </Button>
      <DiktatDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
