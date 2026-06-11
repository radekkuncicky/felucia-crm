'use client'

import { useState, useRef } from 'react'

interface Foto {
  id: string
  url: string
  popis: string | null
  vytvoreno: string
  nahral: { id: string; jmeno: string }
}

interface Props {
  zakazkaId: string
  fotky: Foto[]
}

export default function FotoTab({ zakazkaId, fotky: initialFotky }: Props) {
  const [fotky, setFotky] = useState(initialFotky)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader()
        const dataUrl: string = await new Promise(resolve => {
          reader.onload = e => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })
        const now = new Date()
        const popis = `${now.toLocaleDateString('cs-CZ')} ${now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`
        const res = await fetch(`/api/zakazky/${zakazkaId}/foto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: dataUrl, popis }),
        })
        if (res.ok) {
          const foto = await res.json()
          setFotky(prev => [{ ...foto, nahral: { id: '', jmeno: 'Vy' } }, ...prev])
        }
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Foto" className="max-w-full max-h-full rounded-lg object-contain" />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Fotodokumentace ({fotky.length})</h3>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-sm font-medium text-primary dark:text-primary-light hover:underline disabled:opacity-50"
          >
            {uploading ? 'Nahrávám…' : '+ Přidat foto'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />
          {/* Dedicated camera input for mobile — opens camera directly */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        {/* Mobile: two large buttons — camera or gallery */}
        <div className="md:hidden mx-4 mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 bg-[#1B5E20] hover:bg-green-800 text-white rounded-xl py-5 font-semibold text-sm disabled:opacity-50 transition-colors active:scale-95 min-h-[80px]"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {uploading ? 'Nahrávám…' : 'Foťte'}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-xl py-5 font-semibold text-sm disabled:opacity-50 transition-colors active:scale-95 min-h-[80px]"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Z galerie
          </button>
        </div>
        {/* Desktop: drag & drop zone */}
        <div
          className="hidden md:block m-4 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-primary-light dark:hover:border-blue-500 transition-colors"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
        >
          <svg className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-slate-500">Přetáhněte fotky sem nebo klikněte pro výběr</p>
        </div>

        {fotky.length > 0 && (
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {fotky.map(f => (
              <div key={f.id} className="relative group">
                <button
                  onClick={() => setPreview(f.url)}
                  className="block w-full aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 hover:border-primary-light transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={f.popis ?? 'foto'}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  />
                </button>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 px-0.5">
                  {new Date(f.vytvoreno).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {f.nahral.jmeno ? ` · ${f.nahral.jmeno}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
