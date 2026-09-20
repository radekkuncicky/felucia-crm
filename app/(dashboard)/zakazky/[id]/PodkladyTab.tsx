'use client'

import { confirmDialog } from '@/components/ui/confirm'
import { useState, useRef } from 'react'
import { formatDate } from '@/lib/format'
import { apiFetch } from '@/lib/api'

interface Dokument {
  id: string
  nazev: string
  mime: string
  url: string
  vytvoreno: string
  nahral: { id: string; jmeno: string }
}

interface OpFoto {
  id: string
  nazev: string
  cesta: string
}

interface Props {
  zakazkaId: string
  pokyny: string | null
  dokumenty: Dokument[]
  canEdit: boolean
  opFotky?: OpFoto[]
  opId?: string | null
  opKod?: string | null
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
  if (mime === 'application/pdf') return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z'
  return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
}

export default function PodkladyTab({ zakazkaId, pokyny: initialPokyny, dokumenty: initialDokumenty, canEdit, opFotky = [], opId = null, opKod = null }: Props) {
  const [pokyny, setPokyny] = useState(initialPokyny ?? '')
  const [editingPokyny, setEditingPokyny] = useState(false)
  const [savingPokyny, setSavingPokyny] = useState(false)
  const [dokumenty, setDokumenty] = useState(initialDokumenty)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function savePokyny() {
    setSavingPokyny(true)
    await fetch(`/api/zakazky/${zakazkaId}/podklady`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pokyny }),
    })
    setSavingPokyny(false)
    setEditingPokyny(false)
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Soubor jde jako multipart a ukládá se na disk — ne base64 do DB,
        // to rozbíjelo mobilní appku (několik MB JSON, data: URI nejde otevřít).
        const formData = new FormData()
        formData.append('soubor', file)
        const res = await apiFetch<Dokument>(`/api/zakazky/${zakazkaId}/podklady`,
          { method: 'POST', body: formData })
        if (res.ok && res.data) {
          const dok = res.data
          setDokumenty(prev => [dok, ...prev])
        }
      }
    } finally {
      setUploading(false)
    }
  }

  async function deleteDokument(id: string) {
    if (!(await confirmDialog('Smazat soubor?', { confirmLabel: 'Smazat' }))) return
    const res = await fetch(`/api/zakazky/${zakazkaId}/podklady/${id}`, { method: 'DELETE' })
    if (res.ok) setDokumenty(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Pokyny od manažera */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Pokyny pro techniky</h3>
          {canEdit && !editingPokyny && (
            <button
              onClick={() => setEditingPokyny(true)}
              className="text-xs text-[#1B5E20] dark:text-green-400 hover:underline"
            >
              {pokyny ? 'Upravit' : 'Přidat pokyny'}
            </button>
          )}
        </div>

        {editingPokyny ? (
          <div className="space-y-3">
            <textarea
              rows={5}
              value={pokyny}
              onChange={e => setPokyny(e.target.value)}
              placeholder="Napište instrukce pro techniky — co mají připravit, na co dávat pozor, poznámky k projektu..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/40 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEditingPokyny(false); setPokyny(initialPokyny ?? '') }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={savePokyny}
                disabled={savingPokyny}
                className="px-3 py-1.5 bg-[#1B5E20] hover:bg-[#145218] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {savingPokyny ? 'Ukládám...' : 'Uložit'}
              </button>
            </div>
          </div>
        ) : pokyny ? (
          <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{pokyny}</p>
        ) : (
          <p className="text-sm text-gray-400 dark:text-slate-500 italic">Žádné pokyny zatím nebyly přidány.</p>
        )}
      </div>

      {/* Soubory */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Soubory a dokumentace</h3>
          {canEdit && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B5E20] hover:bg-[#145218] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {uploading ? 'Nahrávám...' : 'Nahrát soubor'}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.zip,.dwg,.dxf"
                onChange={e => handleUpload(e.target.files)}
              />
            </>
          )}
        </div>

        {dokumenty.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-slate-500">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Zatím žádné soubory</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dokumenty.map(dok => (
              <div key={dok.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg group">
                <div className="w-8 h-8 rounded-lg bg-[#1B5E20]/10 dark:bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#1B5E20] dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={fileIcon(dok.mime)} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{dok.nazev}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {dok.nahral.jmeno} · {formatDate(dok.vytvoreno)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={dok.url}
                    download={dok.nazev}
                    className="p-1.5 text-gray-400 hover:text-[#1B5E20] dark:hover:text-green-400 transition-colors"
                    title="Stáhnout"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                  {canEdit && (
                    <button
                      onClick={() => deleteDokument(dok.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Smazat"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fotodokumentace z obchodní fáze (OP) — read-only */}
      {opFotky.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Fotodokumentace z obchodní fáze</h3>
            {opId && (
              <a
                href={`/deals/${opId}?tab=fotodokumentace`}
                className="text-xs text-primary dark:text-primary-light hover:underline"
              >
                {opKod ? `OP ${opKod}` : 'Otevřít OP'} →
              </a>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {opFotky.map(foto => (
              <a
                key={foto.id}
                href={foto.cesta}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 hover:opacity-90 transition-opacity"
                title={foto.nazev}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.cesta} alt={foto.nazev} className="w-full h-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
