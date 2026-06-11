'use client'

import { useState, useEffect, useRef } from 'react'
import ConfirmModal from '@/components/ConfirmModal'

interface Photo {
  id: string
  nazev: string
  cesta: string
  vytvoreno: string
}

interface Props {
  dealId: string
}

export default function FotodokumentaceTab({ dealId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [deletePhoto, setDeletePhoto] = useState<Photo | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/deals/${dealId}/photos`)
      .then(r => r.json())
      .then(data => { setPhotos(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dealId])

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/deals/${dealId}/photos`, { method: 'POST', body: fd })
      if (res.ok) {
        const photo = await res.json()
        setPhotos(prev => [photo, ...prev])
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const f of files) await uploadFile(f)
    e.target.value = ''
  }

  async function deletePhotoConfirm() {
    if (!deletePhoto) return
    await fetch(`/api/deals/${dealId}/photos/${deletePhoto.id}`, { method: 'DELETE' })
    setPhotos(prev => prev.filter(p => p.id !== deletePhoto.id))
    if (lightbox?.id === deletePhoto.id) setLightbox(null)
    setDeletePhoto(null)
  }

  return (
    <div className="space-y-4">
      <ConfirmModal
        isOpen={deletePhoto !== null}
        title="Smazat fotku"
        message={deletePhoto ? `Smazat fotku "${deletePhoto.nazev}"?` : 'Smazat fotku?'}
        confirmLabel="Smazat"
        danger
        onConfirm={deletePhotoConfirm}
        onCancel={() => setDeletePhoto(null)}
      />
      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          Array.from(e.dataTransfer.files).forEach(f => uploadFile(f))
        }}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50'}`}
      >
        <svg className="w-10 h-10 mx-auto text-gray-400 dark:text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Přetáhněte fotky sem nebo</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {uploading ? 'Nahrávám…' : 'Vybrat fotky'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" />
      </div>

      {/* Photos grid */}
      {loading ? (
        <div className="text-center text-sm text-gray-400 py-8">Načítám…</div>
      ) : photos.length === 0 ? (
        <div className="text-center text-sm text-gray-400 dark:text-slate-500 py-8">Žádné fotky. Nahrajte první fotodokumentaci.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="group relative bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.cesta}
                alt={photo.nazev}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightbox(photo)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              <button
                onClick={(e) => { e.stopPropagation(); setDeletePhoto(photo) }}
                className="absolute top-2 right-2 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{photo.nazev}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] mx-4" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.cesta} alt={lightbox.nazev} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-black/50 rounded-b-lg flex items-center justify-between">
              <p className="text-white text-sm">{lightbox.nazev}</p>
              <button onClick={() => setLightbox(null)} className="text-white hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
