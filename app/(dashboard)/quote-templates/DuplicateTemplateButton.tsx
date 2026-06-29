'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DuplicateTemplateButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDuplicate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quote-templates/${id}/duplicate`, { method: 'POST' })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={loading}
      className="text-sm text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
    >
      {loading ? 'Duplikuji…' : 'Duplikovat'}
    </button>
  )
}
