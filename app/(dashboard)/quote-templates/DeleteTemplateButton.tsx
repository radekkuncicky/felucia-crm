'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

export default function DeleteTemplateButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleDelete() {
    setConfirmOpen(false)
    setLoading(true)
    try {
      await fetch(`/api/quote-templates/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ConfirmModal
        isOpen={confirmOpen}
        title="Smazat šablonu"
        message="Smazat tuto šablonu?"
        confirmLabel="Smazat"
        danger
        loading={loading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      <button onClick={() => setConfirmOpen(true)} disabled={loading} className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
        Smazat
      </button>
    </>
  )
}
