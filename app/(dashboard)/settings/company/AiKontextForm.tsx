'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { AI_CONTEXT_MAX } from '@/lib/ai/kontext'

/** Firemní kontext pro AI asistentku — Dáša ho dostane ke každému dotazu (jen této firmy) */
export default function AiKontextForm({ initial }: { initial: string }) {
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/company/ai-context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiContext: text }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? 'Uložení se nezdařilo')
        return
      }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-fg">Kontext pro AI asistentku</h2>
        <p className="mt-1 text-sm text-muted">
          Jak vaše firma funguje: obory, lidé a role, průběh zakázky, pravidla. Dáša podle toho jedná jako zkušená kolegyně.
          Vidí ho jen vaše firma.
        </p>
      </div>
      <Field
        label="Firemní kontext"
        hint={`${text.length} / ${AI_CONTEXT_MAX} znaků`}
        error={error || null}
      >
        <Textarea
          value={text}
          onChange={e => { setText(e.target.value); setSaved(false) }}
          rows={12}
          maxLength={AI_CONTEXT_MAX}
          placeholder="Např.: Zákazníci jsou domácnosti. Děláme tepelná čerpadla a klimatizace. Po montáži vždy voláme zákazníkovi…"
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={saving}>Uložit kontext</Button>
        {saved && <span className="text-sm text-muted">Uloženo</span>}
      </div>
    </section>
  )
}
