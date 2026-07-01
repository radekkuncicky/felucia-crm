'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  zakazkaId: string
  titulniFotoUrl: string | null
  canEdit: boolean
  canTechnikUpload: boolean
}

export default function TitulniFotoUpload({ zakazkaId, titulniFotoUrl, canEdit, canTechnikUpload }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(false)

  const canUpload = canEdit || canTechnikUpload

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const reader = new FileReader()
      const dataUrl: string = await new Promise(resolve => {
        reader.onload = e => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })
      await fetch(`/api/zakazky/${zakazkaId}/titulni-foto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: dataUrl }),
      })
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    await fetch(`/api/zakazky/${zakazkaId}/titulni-foto`, { method: 'DELETE' })
    router.refresh()
  }

  if (titulniFotoUrl) {
    return (
      <>
        {preview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreview(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={titulniFotoUrl} alt="Titulní foto" className="max-w-full max-h-full rounded-lg object-contain" />
          </div>
        )}
        <div className="relative flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={titulniFotoUrl}
            alt="Titulní foto"
            onClick={() => setPreview(true)}
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl object-cover cursor-pointer border border-gray-200 dark:border-slate-600 shadow-sm hover:opacity-90 transition-opacity"
          />
          {canEdit && (
            <button
              onClick={handleRemove}
              title="Odebrat titulní foto"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs shadow transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </>
    )
  }

  if (!canUpload) return null

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-primary dark:hover:border-primary-light flex flex-col items-center justify-center gap-1.5 text-gray-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary-light transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <span className="text-xs">Nahrávám…</span>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs text-center leading-tight">Přidat foto</span>
          </>
        )}
      </button>
    </>
  )
}
