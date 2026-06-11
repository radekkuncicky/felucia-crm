'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  const [form, setForm] = useState({ clientId: defaultClientId, technologie: 'KLIMA', predmet: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Chyba při ukládání')
        return
      }
      const deal = await res.json()
      router.push(`/deals/${deal.id}`)
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Klient *</label>
        <ClientSelectWithCreate
          clients={clients}
          value={form.clientId}
          onChange={(clientId) => setForm((f) => ({ ...f, clientId }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Technologie *</label>
        <select
          value={form.technologie}
          onChange={(e) => setForm((f) => ({ ...f, technologie: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {techOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Předmět</label>
        <input
          type="text"
          placeholder="Stručný popis zakázky…"
          value={form.predmet}
          onChange={(e) => setForm((f) => ({ ...f, predmet: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
        >
          {saving ? 'Ukládám…' : 'Vytvořit případ'}
        </button>
        <Link href="/deals" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušit</Link>
      </div>
    </form>
  )
}
