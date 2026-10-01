'use client'

import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ClientFormFields, { PRAZDNY_KLIENT, clientPayload, najdiDuplicitu, validateClient, type ClientFormData } from '@/components/ClientForm'

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<ClientFormData>(PRAZDNY_KLIENT)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const chyba = validateClient(form)
    if (chyba) { setError(chyba); return }
    setSaving(true)
    setError('')
    try {
      // Shoda s existujícím klientem → otevřít jeho detail (ne zakládání OP)
      const existujici = await najdiDuplicitu(form, 'Ano, otevřít tohoto klienta')
      if (existujici) {
        router.push(`/clients/${existujici.id}`)
        return
      }

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientPayload(form)),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Chyba při ukládání')
        return
      }
      const client = await res.json()
      toast.success('Klient založen')
      router.push(`/clients/${client.id}`)
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/clients" className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">← Klienti</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nový klient</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error && <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>}

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 sm:p-6">
          <ClientFormFields value={form} onChange={setForm} />
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={saving}>Vytvořit klienta</Button>
          <ButtonLink href="/clients" variant="ghost">Zrušit</ButtonLink>
        </div>
      </form>
    </div>
  )
}
