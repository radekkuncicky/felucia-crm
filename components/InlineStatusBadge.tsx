'use client'

import { toast } from 'sonner'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { StavDealu } from '@prisma/client'
import { stavLabels } from '@/lib/constants'
import ConfirmModal from '@/components/ConfirmModal'
import { api } from '@/lib/api'

const STAV_STYLE: Record<StavDealu, { bg: string; text: string; dot: string }> = {
  NOVY:           { bg: '#E8F5E9', text: '#2E7D32', dot: '#4CAF50' },
  JEDNANI:        { bg: '#E3F2FD', text: '#1565C0', dot: '#1E88E5' },
  NABIDKA:        { bg: '#FFF3E0', text: '#E65100', dot: '#FB8C00' },
  PRED_UZAVRENIM: { bg: '#F3E5F5', text: '#6A1B9A', dot: '#8E24AA' },
  USPECH:         { bg: '#4CAF50', text: '#FFFFFF', dot: '#FFFFFF' },
  PAS:            { bg: '#FFEBEE', text: '#C62828', dot: '#E53935' },
  ZNEPLATNENO:    { bg: 'rgba(100,100,100,0.12)', text: '#888888', dot: '#9E9E9E' },
}

const STAVS: StavDealu[] = ['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM', 'USPECH', 'PAS']

interface Props {
  dealId: string
  stav: StavDealu
  onChange?: (newStav: StavDealu) => void
}

export default function InlineStatusBadge({ dealId, stav: initialStav, onChange }: Props) {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.perms?.obchodMazani === true

  const [stav, setStav] = useState(initialStav)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleSelect(newStav: StavDealu) {
    if (newStav === stav) { setOpen(false); return }
    const prev = stav
    setStav(newStav)
    setOpen(false)
    setSaving(true)
    try {
      const res = await api.patch<{ chybaPovinnaAktivita?: boolean }>(`/api/deals/${dealId}`,
        { stav: newStav },
        { errorMessage: 'Změnu stavu se nepodařilo uložit.' })
      if (res.ok) {
        if (res.data?.chybaPovinnaAktivita) {
          setStav(prev)
          toast.warning('Pro uzavření OP je vyžadována aktivita (Hovor nebo Schůzka).')
        } else {
          onChange?.(newStav)
        }
      } else {
        setStav(prev)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setConfirmDelete(false)
    setDeleting(true)
    try {
      const res = await api.delete(`/api/deals/${dealId}`,
        { errorMessage: 'Obchodní případ se nepodařilo smazat.' })
      if (res.ok) {
        toast.success('Obchodní případ smazán')
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  const style = STAV_STYLE[stav] ?? STAV_STYLE.NOVY

  return (
    <div ref={ref} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <ConfirmModal
        isOpen={confirmDelete}
        title="Smazat obchodní případ"
        message="Opravdu chcete smazat tento OP? Tato akce je nevratná a smaže vše včetně nabídek, aktivit a zařízení."
        confirmLabel="Smazat"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <button
        onClick={() => !saving && setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 active:scale-95 focus:outline-none"
        style={{ background: style.bg, color: style.text }}
        title="Změnit stav"
      >
        {saving ? (
          <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin flex-shrink-0" />
        ) : (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: style.dot }} />
        )}
        {stavLabels[stav]}
        <svg className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[170px] rounded-[10px] border border-[#C8E6C9] bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
          {STAVS.map(s => {
            const st = STAV_STYLE[s]
            const isCurrent = s === stav
            return (
              <button
                key={s}
                onClick={() => handleSelect(s)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-[#F4FAF4] dark:hover:bg-slate-700/60 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: st.dot === '#FFFFFF' ? '#4CAF50' : st.dot }} />
                  <span className="font-medium" style={{ color: s === 'USPECH' ? '#2E7D32' : st.text }}>
                    {stavLabels[s]}
                  </span>
                </div>
                {isCurrent && (
                  <svg className="w-4 h-4 text-[#4CAF50] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}

          {/* Separator + Zneplatnit — jen ADMIN */}
          {isAdmin && (
            <>
              <div className="border-t border-gray-100 dark:border-slate-700 my-0.5" />
              <button
                onClick={() => handleSelect('ZNEPLATNENO')}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#9E9E9E' }} />
                  <span className="font-medium text-gray-500 dark:text-slate-400">Zneplatnit</span>
                </div>
                {stav === 'ZNEPLATNENO' && (
                  <svg className="w-4 h-4 text-[#4CAF50] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </>
          )}

          {/* Smazat OP — jen ADMIN */}
          {isAdmin && (
            <>
              <div className="border-t border-gray-100 dark:border-slate-700 my-0.5" />
              <button
                onClick={() => { setOpen(false); setConfirmDelete(true) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-left"
              >
                <svg className="w-3.5 h-3.5 text-red-700 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="font-medium text-red-700 dark:text-red-400">Smazat OP</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
