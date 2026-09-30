'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import ClientSelectWithCreate from '@/components/ClientSelectWithCreate'

const techOptions = [
  { value: 'KLIMA', label: 'Klimatizace' },
  { value: 'TEPELNE_CERPADLO', label: 'Tepelné čerpadlo' },
  { value: 'REKUPERACE', label: 'Rekuperace' },
  { value: 'PODLAHOVE_TOPENI', label: 'Podlahové topení' },
  { value: 'VZDUCHOTECHNIKA', label: 'Vzduchotechnika' },
  { value: 'JINE', label: 'Jiné' },
]

interface Props {
  clients: { id: string; jmeno: string; prijmeni: string }[]
  defaultClientId: string
}

export default function NewDealForm({ clients, defaultClientId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clientError, setClientError] = useState('')
  const [form, setForm] = useState({ clientId: defaultClientId, technologie: 'KLIMA', predmet: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Klient se vybírá přes skrytý input, který prohlížeč nevaliduje
    if (!form.clientId) {
      setClientError('Vyberte klienta, nebo založte nového.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.error === 'PLAN_LIMIT_REACHED' || data.code === 'PLAN_LIMIT_REACHED') {
          toast.error(data.message || 'Dosáhli jste limitu vašeho plánu.', {
            action: { label: 'Zobrazit plány', onClick: () => router.push(data.upgradeUrl || '/settings/billing') },
          })
        } else {
          setError(data.message || data.error || 'Chyba při ukládání')
        }
        return
      }
      const deal = await res.json()
      toast.success('Obchodní případ vytvořen')
      router.push(`/deals/${deal.id}`)
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 sm:p-6 space-y-4">
      {error && <div role="alert" className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>}

      {/* Výběr klienta je vlastní komponenta (skrytý input) — popisek a chyba ručně */}
      <div role="group" aria-labelledby="deal-klient-label">
        <p id="deal-klient-label" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Klient<span className="text-red-500 ml-0.5" aria-hidden>*</span>
        </p>
        <ClientSelectWithCreate
          clients={clients}
          value={form.clientId}
          onChange={(clientId) => { setForm((f) => ({ ...f, clientId })); if (clientId) setClientError('') }}
        />
        {clientError && <p role="alert" className="text-xs mt-1 text-red-600 dark:text-red-400">{clientError}</p>}
      </div>

      <Field label="Technologie" required>
        <Select value={form.technologie} onChange={(e) => setForm((f) => ({ ...f, technologie: e.target.value }))}>
          {techOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
      </Field>

      <Field label="Předmět">
        <Input
          placeholder="Stručný popis zakázky…"
          value={form.predmet}
          onChange={(e) => setForm((f) => ({ ...f, predmet: e.target.value }))}
        />
      </Field>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={saving}>Vytvořit případ</Button>
        <ButtonLink href="/deals" variant="ghost">Zrušit</ButtonLink>
      </div>
    </form>
  )
}
