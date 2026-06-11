'use client'

import { confirmDialog } from '@/components/ui/confirm'
import { useEffect, useState, useRef, useCallback } from 'react'

interface Doc {
  id: string
  nazev: string
  originalName: string
  velikost: string
  mimeType: string
  cesta: string
  popis: string | null
  vytvoreno: string
  uploadedBy: string
}

interface StorageInfo {
  used: bigint
  limit: bigint
}

function formatBytes(bytes: bigint): string {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function mimeIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️'
  return '📎'
}

export default function DocumentsClient() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const loadData = useCallback(async () => {
    const [docsRes, storageRes] = await Promise.all([
      fetch('/api/documents'),
      fetch('/api/documents/storage'),
    ])
    const [docsData, storageData] = await Promise.all([docsRes.json(), storageRes.json()])
    setDocs(Array.isArray(docsData) ? docsData : [])
    if (storageData.used != null) {
      setStorage({ used: BigInt(storageData.used), limit: BigInt(storageData.limit) })
    }
  }, [])

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [loadData])

  async function uploadFile(file: File) {
    setError(null)
    setUploading(true)
    setUploadProgress(file.name)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Chyba při nahrávání')
        return
      }
      await loadData()
    } catch {
      setError('Chyba při nahrávání souboru')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    for (const file of arr) {
      await uploadFile(file)
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog('Smazat tento soubor?', { confirmLabel: 'Smazat' }))) return
    setDeletingId(id)
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      await loadData()
    } finally {
      setDeletingId(null)
    }
  }

  const storageExceeded = storage ? storage.used >= storage.limit : false
  const storagePercent = storage ? Math.min(100, Math.round(Number(storage.used) / Number(storage.limit) * 100)) : 0

  const filtered = docs.filter(d =>
    d.nazev.toLowerCase().includes(search.toLowerCase()) ||
    (d.popis ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Storage banner (upsell) */}
      {storageExceeded && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-red-500 text-xl mt-0.5">⚠️</span>
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Úložiště je plné</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              Využito {formatBytes(storage!.used)} z {formatBytes(storage!.limit)}. Pro navýšení limitu kontaktujte podporu.
            </p>
          </div>
        </div>
      )}

      {/* Storage bar */}
      {storage && !storageExceeded && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 dark:text-slate-400">Využité úložiště</span>
            <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
              {formatBytes(storage.used)} / {formatBytes(storage.limit)}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${storagePercent > 85 ? 'bg-orange-500' : 'bg-blue-500'}`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl px-6 py-10 text-center transition-colors ${
          dragging
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = '' }}
        />
        {uploading ? (
          <div className="space-y-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500 dark:text-slate-400">Nahrávám {uploadProgress}…</p>
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">Přetáhněte soubory sem</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">nebo</p>
            <button
              type="button"
              disabled={storageExceeded}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Vybrat soubory
            </button>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Max. 100 MB na soubor</p>
          </>
        )}
      </div>

      {/* Search + list */}
      {(docs.length > 0 || search) && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hledat soubor, popis…"
          className="w-full max-w-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400 dark:text-slate-500">Načítám…</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-400 dark:text-slate-500">
              {search ? 'Žádné výsledky' : 'Zatím žádné dokumenty — přetáhněte soubory nahoru'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Název</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden sm:table-cell">Velikost</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Nahráno</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Uživatel</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{mimeIcon(doc.mimeType)}</span>
                      <div className="min-w-0">
                        <a
                          href={doc.cesta}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary-light truncate block max-w-xs"
                        >
                          {doc.nazev}
                        </a>
                        {doc.popis && <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{doc.popis}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap hidden sm:table-cell">
                    {formatBytes(BigInt(doc.velikost))}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap hidden md:table-cell">
                    {new Date(doc.vytvoreno).toLocaleDateString('cs-CZ')}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell">
                    {doc.uploadedBy}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50"
                    >
                      Smazat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} souborů</p>
      )}
    </div>
  )
}
