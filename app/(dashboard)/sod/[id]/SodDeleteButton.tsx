'use client'

import { confirmDialog } from '@/components/ui/confirm'
import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SodDeleteButton({ sodId, dealId }: { sodId: string; dealId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!(await confirmDialog('Smazat tuto smlouvu o dílo? Akce je nevratná.', { confirmLabel: 'Smazat' }))) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sod/${sodId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push(`/deals/${dealId}?tab=smlouvy`)
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Chyba při mazání')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      {loading ? '…' : 'Smazat'}
    </button>
  )
}
