'use client'

import { useEffect, useId, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { DUVODY_PROHRY, DUVOD_PROHRY_LABEL, jeDuvodProhry, type DuvodProhryKod } from '@/lib/duvodProhry'

export interface DuvodProhry {
  duvodProhryKod: DuvodProhryKod
  duvodProhry: string | null
}

type Trigger = () => Promise<DuvodProhry | null>
let trigger: Trigger | null = null

/**
 * Důvod prohry OP — povinný při přechodu do „Prohráno“ (API vrací 400 bez něj).
 * Vrací null, když uživatel dialog zavře. Host je v app/providers.tsx.
 */
export function zeptatSeNaDuvodProhry(): Promise<DuvodProhry | null> {
  if (!trigger) return Promise.resolve(null)
  return trigger()
}

export function DuvodProhryHost() {
  const formId = useId()
  const [resolve, setResolve] = useState<((v: DuvodProhry | null) => void) | null>(null)
  const [kod, setKod] = useState('')
  const [text, setText] = useState('')

  useEffect(() => {
    trigger = () => new Promise(r => {
      setKod('')
      setText('')
      setResolve(() => r)
    })
    return () => { trigger = null }
  }, [])

  const close = (v: DuvodProhry | null) => {
    resolve?.(v)
    setResolve(null)
  }
  // „Jiné“ bez popisu nic neříká
  const ok = jeDuvodProhry(kod) && (kod !== 'JINE' || text.trim() !== '')

  return (
    <Dialog
      open={resolve !== null}
      onClose={() => close(null)}
      title="Důvod prohry"
      layer="top"
      footer={<>
        <Button variant="secondary" onClick={() => close(null)}>Zrušit</Button>
        <Button variant="danger" type="submit" form={formId} disabled={!ok}>Označit jako Prohráno</Button>
      </>}
    >
      <form
        id={formId}
        className="space-y-3"
        onSubmit={e => {
          e.preventDefault()
          if (ok) close({ duvodProhryKod: kod as DuvodProhryKod, duvodProhry: text.trim() || null })
        }}
      >
        <Field label="Proč byl obchodní případ prohraný?" required>
          <Select autoFocus value={kod} onChange={e => setKod(e.target.value)}>
            <option value="">Vyberte důvod…</option>
            {DUVODY_PROHRY.map(d => <option key={d} value={d}>{DUVOD_PROHRY_LABEL[d]}</option>)}
          </Select>
        </Field>
        <Field label="Podrobnosti" required={kod === 'JINE'} hint={kod === 'JINE' ? undefined : 'Volitelné'}>
          <Textarea
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Např. vybral levnější nabídku od konkurence…"
            className="resize-none"
          />
        </Field>
      </form>
    </Dialog>
  )
}
