'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { getPlanLimits } from '@/lib/planLimits'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'

type StavDealu = 'NOVY' | 'JEDNANI' | 'NABIDKA' | 'PRED_UZAVRENIM' | 'USPECH' | 'PAS' | 'ZNEPLATNENO'

const stavOptions: { value: StavDealu; label: string; color: string; dot: string }[] = [
  { value: 'NOVY',           label: 'Nový',             color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',      dot: 'bg-gray-400' },
  { value: 'JEDNANI',        label: 'Jednání',          color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',    dot: 'bg-blue-500' },
  { value: 'NABIDKA',        label: 'Nabídka',          color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  { value: 'PRED_UZAVRENIM', label: 'Před uzavřením',   color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  { value: 'USPECH',         label: 'Úspěch',           color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  { value: 'PAS',            label: 'Prohráno',           color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',       dot: 'bg-red-500' },
  { value: 'ZNEPLATNENO',    label: 'Zneplatněno',      color: 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400',    dot: 'bg-gray-400' },
]

interface Props {
  dealId: string
  currentStav: StavDealu
  plan?: string
  klientId?: string
  klientJmeno?: string
  povinnaAktivitaUOP?: boolean
  automatickyServis?: boolean
}

export default function DealStatusBadge({ dealId, currentStav, plan, klientId, klientJmeno, automatickyServis = true }: Props) {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.perms?.obchodMazani === true
  const [open, setOpen] = useState(false)
  const [stav, setStav] = useState<StavDealu>(currentStav)
  const [saving, setSaving] = useState(false)
  const [pasModal, setPasModal] = useState(false)
  const [duvodProhry, setDuvodProhry] = useState('')
  const [pendingStav, setPendingStav] = useState<StavDealu | null>(null)
  const [servisModal, setServisModal] = useState(false)
  const [servisForm, setServisForm] = useState({
    nazev: '',
    typ: 'ROCNI',
    intervalMesicu: 12,
    cena: '',
    zacatek: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    poznamka: '',
  })
  const [servisSaving, setServisSaving] = useState(false)
  const [servisError, setServisError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const pasFormId = useId()
  const servisFormId = useId()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function changeStav(newStav: StavDealu, duvod?: string) {
    setSaving(true)
    setOpen(false)
    try {
      const body: Record<string, unknown> = { stav: newStav }
      if (duvod) body.duvodProhry = duvod
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.message || data.error || 'Stav se nepodařilo změnit')
        return
      }
      if (data.chybaPovinnaAktivita) {
        toast.error('Před uzavřením OP je nutná alespoň jedna aktivita typu Hovor nebo Schůzka.')
        return
      }
      setStav(newStav)
      if (data.suggestServiceContract && getPlanLimits(plan ?? 'STARTER').hasServiceModule && automatickyServis) {
        setServisForm(f => ({ ...f, nazev: `Roční servis – ${klientJmeno ?? ''}`.trim() }))
        setServisModal(true)
      } else {
        router.refresh()
      }
    } catch {
      toast.error('Stav se nepodařilo změnit — zkontrolujte připojení')
    } finally {
      setSaving(false)
    }
  }

  async function createServisniKontrakt() {
    setServisSaving(true)
    setServisError('')
    try {
      const intervalMap: Record<string, number> = { ROCNI: 12, POLOLETNI: 6, DVOULETNI: 24, JEDNOURAZOVY: 0 }
      const res = await fetch('/api/servis/kontrakty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          klientId,
          nazev: servisForm.nazev,
          typ: servisForm.typ,
          intervalMesicu: servisForm.typ === 'JEDNOURAZOVY' ? 0 : intervalMap[servisForm.typ],
          // Decimal v DB — česká čárka a mezery z "3 500,50"
          cena: servisForm.cena.replace(/\s/g, '').replace(',', '.') || null,
          zacatek: servisForm.zacatek,
          poznamka: servisForm.poznamka || null,
        }),
      })
      if (res.ok) {
        setServisModal(false)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setServisError(data.error || 'Nepodařilo se vytvořit servisní kontrakt')
      }
    } catch {
      setServisError('Nepodařilo se vytvořit servisní kontrakt')
    } finally {
      setServisSaving(false)
    }
  }

  function selectStav(newStav: StavDealu) {
    if (newStav === 'PAS') {
      setPendingStav(newStav)
      setPasModal(true)
      setOpen(false)
    } else {
      changeStav(newStav)
    }
  }

  function zrusitPas() {
    setPasModal(false)
    setDuvodProhry('')
    setPendingStav(null)
  }

  async function confirmPas(e: React.FormEvent) {
    e.preventDefault()
    if (!duvodProhry.trim() || !pendingStav) return
    setPasModal(false)
    await changeStav(pendingStav, duvodProhry.trim())
    setDuvodProhry('')
    setPendingStav(null)
  }

  const current = stavOptions.find(s => s.value === stav)!

  return (
    <>
      <Dialog
        open={pasModal}
        onClose={zrusitPas}
        title="Důvod prohry"
        footer={<>
          <Button variant="secondary" onClick={zrusitPas}>Zrušit</Button>
          <Button variant="danger" type="submit" form={pasFormId} disabled={!duvodProhry.trim()} loading={saving}>
            Uložit a označit jako Prohráno
          </Button>
        </>}
      >
        <form id={pasFormId} onSubmit={confirmPas}>
          <Field label="Proč byl obchodní případ prohraný?" required>
            <Textarea
              autoFocus
              rows={4}
              value={duvodProhry}
              onChange={e => setDuvodProhry(e.target.value)}
              placeholder="Např. cena, konkurence, zákazník zrušil záměr…"
              className="resize-none"
            />
          </Field>
        </form>
      </Dialog>

      {/* Nabídka servisního kontraktu po úspěšném uzavření OP */}
      <Dialog
        open={servisModal}
        onClose={() => { setServisModal(false); router.refresh() }}
        title="Nastavit pravidelný servis?"
        footer={<>
          <Button variant="secondary" onClick={() => { setServisModal(false); router.refresh() }}>Přeskočit</Button>
          <Button type="submit" form={servisFormId} disabled={!servisForm.nazev.trim()} loading={servisSaving}>Vytvořit kontrakt</Button>
        </>}
      >
        <form id={servisFormId} onSubmit={e => { e.preventDefault(); createServisniKontrakt() }} className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Obchodní případ je uzavřený jako úspěch. Chcete klientovi rovnou založit servisní kontrakt?
          </p>
          <Field label="Název kontraktu" required>
            <Input value={servisForm.nazev} onChange={e => setServisForm(f => ({ ...f, nazev: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Typ servisu">
              <Select
                value={servisForm.typ}
                onChange={e => {
                  const typ = e.target.value
                  const intervals: Record<string, number> = { ROCNI: 12, POLOLETNI: 6, DVOULETNI: 24, JEDNOURAZOVY: 0 }
                  setServisForm(f => ({ ...f, typ, intervalMesicu: intervals[typ] }))
                }}
              >
                <option value="ROCNI">Roční</option>
                <option value="POLOLETNI">Pololetní</option>
                <option value="DVOULETNI">Dvouletní</option>
                <option value="JEDNOURAZOVY">Jednorázový</option>
              </Select>
            </Field>
            <Field label="Začátek servisu">
              <Input type="date" value={servisForm.zacatek} onChange={e => setServisForm(f => ({ ...f, zacatek: e.target.value }))} />
            </Field>
          </div>
          <Field label="Cena (Kč)" hint="Volitelné">
            <Input kind="castka" value={servisForm.cena} onChange={e => setServisForm(f => ({ ...f, cena: e.target.value }))} placeholder="Např. 3500" />
          </Field>
          {servisError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{servisError}</p>}
        </form>
      </Dialog>

      {/* Badge + dropdown */}
      <div ref={ref} className="relative inline-block">
        <button
          onClick={() => setOpen(o => !o)}
          disabled={saving}
          data-compact
          className={`hit-area flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-60 ${current.color}`}
          title="Klikněte pro změnu stavu"
        >
          <span>{current.label}</span>
          <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-30 min-w-[180px] overflow-hidden">
            {stavOptions.filter(opt => opt.value !== 'ZNEPLATNENO' || isAdmin).map(opt => (
              <button
                key={opt.value}
                onClick={() => selectStav(opt.value)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${opt.value === stav ? 'bg-gray-50 dark:bg-slate-700 font-semibold' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                <span className="text-gray-700 dark:text-slate-300">{opt.label}</span>
                {opt.value === stav && <span className="ml-auto text-blue-500">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
