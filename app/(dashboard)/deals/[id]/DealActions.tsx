'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import ConfirmModal from '@/components/ConfirmModal'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'

interface Props {
  dealId: string
  /** Zakázka už k OP existuje → místo „Vytvořit" nabídnout „Otevřít" */
  linkedZakazkaId?: string | null
  dealData?: {
    kod: string | null
    predmet: string | null
    clientJmeno: string
    clientId: string
    adresaDila: string | null
    technologie: string
    hodnotaZalohy: string | null
  }
}

export default function DealActions({ dealId, linkedZakazkaId, dealData }: Props) {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.perms?.obchodMazani === true
  const [loading, setLoading] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(false)
  async function handleDuplicate() {
    setDuplicateModal(false)
    setLoading(true)
    try {
      const res = await api.post<{ id: string }>(`/api/deals/${dealId}/duplicate`, undefined,
        { errorMessage: 'Obchodní případ se nepodařilo duplikovat.' })
      if (res.ok && res.data) {
        toast.success('Obchodní případ zduplikován')
        router.push(`/deals/${res.data.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteModal(false)
    setLoading(true)
    try {
      const res = await api.delete(`/api/deals/${dealId}`,
        { errorMessage: 'Obchodní případ se nepodařilo smazat.' })
      if (res.ok) {
        toast.success('Obchodní případ smazán')
        router.push('/deals')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateZakazka() {
    setConfirmModal(false)
    setLoading(true)
    try {
      const res = await api.post<{ id: string }>('/api/zakazky', {
        opId: dealId,
        klientId: dealData?.clientId,
        nazev: dealData?.predmet ?? dealData?.clientJmeno ?? '',
        technologie: dealData?.technologie ?? null,
      }, { errorMessage: 'Zakázku se nepodařilo vytvořit.' })
      if (res.ok && res.data) {
        toast.success('Zakázka vytvořena')
        router.push(`/zakazky/${res.data.id}`)
      } else if (res.status === 409 && res.data?.id) {
        // zakázka mezitím vznikla (např. podpisem SOD) — otevřít tu existující
        router.push(`/zakazky/${res.data.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ConfirmModal
        isOpen={duplicateModal}
        title="Duplikovat obchodní případ"
        message="Opravdu chcete duplikovat tento obchodní případ?"
        confirmLabel="Duplikovat"
        onConfirm={handleDuplicate}
        onCancel={() => setDuplicateModal(false)}
      />

      <ConfirmModal
        isOpen={deleteModal}
        title="Smazat obchodní případ"
        message={`Opravdu chcete smazat ${dealData?.kod ? `${dealData.kod} — ${dealData.predmet ?? dealData.clientJmeno}` : 'tento OP'}? Tato akce je nevratná.`}
        confirmLabel="Smazat"
        danger
        loading={loading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(false)}
      />

      <ConfirmModal
        isOpen={confirmModal}
        title="Vytvořit zakázku"
        message="Vytvořit k tomuto obchodnímu případu zakázku? Položky se převezmou z aktivní nabídky."
        confirmLabel="Vytvořit zakázku"
        loading={loading}
        onConfirm={handleCreateZakazka}
        onCancel={() => setConfirmModal(false)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setDuplicateModal(true)} disabled={loading} className="whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Duplikovat
        </Button>
        {/* Zakázka: existující má odkaz ve štítku hlavičky a v kartě „Další krok“ */}
        {!linkedZakazkaId && (
          <Button onClick={() => setConfirmModal(true)} disabled={loading} className="whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Vytvořit zakázku
          </Button>
        )}
        {isAdmin && (
          <Menu
            label="Další akce obchodního případu"
            items={[{ label: 'Smazat OP', onSelect: () => setDeleteModal(true), danger: true }]}
          />
        )}
      </div>
    </>
  )
}
