'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import ConfirmModal from '@/components/ConfirmModal'

interface Props {
  dealId: string
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

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {message}
    </div>
  )
}

export default function DealActions({ dealId, dealData }: Props) {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.isSuperAdmin === true
  const [loading, setLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  async function handleDuplicate() {
    setDuplicateModal(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/duplicate`, { method: 'POST' })
      if (res.ok) {
        const newDeal = await res.json()
        router.push(`/deals/${newDeal.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteModal(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/deals')
      } else {
        setToast({ message: 'Chyba při mazání obchodního případu.', type: 'error' })
      }
    } catch {
      setToast({ message: 'Chyba při mazání obchodního případu.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateZakazka() {
    setConfirmModal(false)
    setLoading(true)
    try {
      const res = await fetch('/api/zakazky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opId: dealId,
          klientId: dealData?.clientId,
          nazev: dealData?.predmet ?? dealData?.clientJmeno ?? '',
          technologie: dealData?.technologie ?? null,
        }),
      })
      if (res.ok) {
        const zakazka = await res.json()
        router.push(`/zakazky/${zakazka.id}`)
      } else {
        const d = await res.json().catch(() => ({}))
        setToast({ message: d.error ?? 'Chyba při vytváření zakázky.', type: 'error' })
      }
    } catch {
      setToast({ message: 'Chyba při odesílání požadavku.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <ConfirmModal
        isOpen={duplicateModal}
        title="Duplikovat obchodní případ"
        message="Opravdu chcete duplikovat tento obchodní případ?"
        confirmLabel="Duplikovat"
        onConfirm={handleDuplicate}
        onCancel={() => setDuplicateModal(false)}
      />

      {/* Delete confirm modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Smazat obchodní případ</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">
              Opravdu chcete smazat tento OP? Tato akce je nevratná.
            </p>
            {dealData?.kod && (
              <p className="text-sm font-mono font-semibold text-gray-800 dark:text-slate-200 mb-6">{dealData.kod} — {dealData.predmet ?? dealData.clientJmeno}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handleDelete} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                {loading ? 'Mažu…' : 'Smazat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Vytvořit zakázku</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
              Opravdu chcete vytvořit zakázku v FELUCIA Workspace pro tento obchodní případ?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handleCreateZakazka} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
                {loading ? 'Odesílám…' : 'Vytvořit zakázku'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Duplicate */}
        <button
          onClick={() => setDuplicateModal(true)}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-slate-600 hover:border-gray-400 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Duplikovat
        </button>

        {/* Custom actions dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover px-3 py-2 rounded-lg transition-colors"
          >
            Vlastní akce
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-20 min-w-[180px]">
              <button
                onClick={() => { setDropdownOpen(false); setConfirmModal(true) }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Vytvořit zakázku
              </button>
              {isAdmin && (
                <>
                  <div className="border-t border-gray-100 dark:border-slate-700" />
                  <button
                    onClick={() => { setDropdownOpen(false); setDeleteModal(true) }}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Smazat OP
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
