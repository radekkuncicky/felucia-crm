'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import DOMPurify from 'dompurify'
import ConfirmModal from '@/components/ConfirmModal'
import SodTemplateEditor, { SOD_PLACEHOLDERS } from '@/components/SodTemplateEditor'
import ContractTemplateGuide from '@/components/ContractTemplateGuide'

interface Template {
  id: string
  nazev: string
  popis?: string | null
  obsah: string
}

interface Props {
  templates: Template[]
  prilohaVop: string | null
  prilohaVzsp: string | null
  prilohaCenik: string | null
}

const SAMPLE: Record<string, string> = {
  '{{cislo_smlouvy}}': 'SOD-26-001',
  '{{datum}}': '25. 5. 2026',
  '{{klient_jmeno}}': 'Jan Novák',
  '{{klient_adresa}}': 'Hlavní 1, 602 00 Brno',
  '{{klient_email}}': 'jan.novak@email.cz',
  '{{klient_telefon}}': '+420 777 123 456',
  '{{klient_ico}}': '12345678',
  '{{klient_dic}}': 'CZ12345678',
  '{{kontaktni_osoba}}': 'Jana Nováková',
  '{{kontaktni_telefon}}': '+420 777 987 654',
  '{{predmet}}': 'montáž klimatizační jednotky Daikin 5 kW',
  '{{adresa_dila}}': 'Pracovní 5, 602 00 Brno',
  '{{obchodnik}}': 'Tomáš Obchodní',
  '{{termin_realizace}}': '15. 6. 2026',
  '{{termin_prevzeti}}': '20. 6. 2026',
  '{{pocet_dni_realizace}}': '3',
  '{{hodnota_zalohy}}': '35 000 Kč',
  '{{zaloha_splatnost}}': '14',
  '{{konecna_cena}}': '50 000 Kč',
  '{{cena_s_dph}}': '60 500 Kč',
  '{{dph_sazba}}': '21',
  '{{kod_op}}': 'OP-26-042',
  '{{organizace}}': 'Vzorová firma s.r.o.',
  '{{org_sidlo}}': 'Náměstí Míru 1, 602 00 Brno',
  '{{org_ico}}': '98765432',
  '{{org_dic}}': 'CZ98765432',
  '{{zmena_term}}': '30. 6. 2026',
  '{{technologie}}': 'klimatizace',
}

function renderPreview(html: string): string {
  const filled = SOD_PLACEHOLDERS.reduce(
    (text, [ph]) => text.replaceAll(ph, `<mark class="sod-sample">${SAMPLE[ph] ?? ph}</mark>`),
    html
  )
  return DOMPurify.sanitize(filled)
}

function isFullDocHtml(html: string): boolean {
  return /^<!doctype|^<html/i.test(html.trimStart())
}

function renderFullDocPreview(html: string): string {
  return SOD_PLACEHOLDERS.reduce(
    (text, [ph]) => text.replaceAll(ph, SAMPLE[ph] ?? ph),
    html
  )
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function ContractTemplatesManager({ templates: initial, prilohaVop: initVop, prilohaVzsp: initVzsp, prilohaCenik: initCenik }: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initial)
  const [attachPaths, setAttachPaths] = useState<Record<string, string | null>>({
    vop: initVop, vzsp: initVzsp, cenik: initCenik,
  })
  const [attachUploading, setAttachUploading] = useState<Record<string, boolean>>({})
  const [attachDeleting, setAttachDeleting] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ nazev: '', popis: '', obsah: '' })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewFullDoc, setPreviewFullDoc] = useState<string | null>(null)

  function openPreview(content: string) {
    if (isFullDocHtml(content)) {
      setPreviewFullDoc(renderFullDocPreview(content))
      setPreviewHtml(null)
    } else {
      setPreviewHtml(renderPreview(content))
      setPreviewFullDoc(null)
    }
  }

  function closePreview() {
    setPreviewHtml(null)
    setPreviewFullDoc(null)
  }
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleCreate() {
    setSaving(true)
    const res = await fetch('/api/contract-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const tpl = await res.json()
      setTemplates(prev => [...prev, tpl])
      setCreating(false)
      setForm({ nazev: '', popis: '', obsah: '' })
      router.refresh()
    }
    setSaving(false)
  }

  async function handleUpdate() {
    if (!editing) return
    setSaving(true)
    await fetch(`/api/contract-templates/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: form.nazev, popis: form.popis, obsah: form.obsah }),
    })
    setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, ...form } : t))
    setEditing(null)
    setForm({ nazev: '', popis: '', obsah: '' })
    setSaving(false)
    router.refresh()
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    await fetch(`/api/contract-templates/${deleteId}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== deleteId))
    setDeleteId(null)
    router.refresh()
  }

  function startEdit(t: Template) {
    setEditing(t)
    setForm({ nazev: t.nazev, popis: t.popis ?? '', obsah: t.obsah })
    setCreating(false)
  }

  async function handleDuplicate(t: Template) {
    const res = await fetch('/api/contract-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: `${t.nazev} (kopie)`, popis: t.popis ?? '', obsah: t.obsah }),
    })
    if (res.ok) {
      const tpl = await res.json()
      setTemplates(prev => [...prev, tpl])
      toast.success('Šablona zduplikována')
      router.refresh()
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Duplikaci se nepodařilo provést')
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // umožní znovu vybrat tentýž soubor
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/contract-templates/import', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Import se nepodařil')
        return
      }
      setForm(f => ({ ...f, obsah: data.html }))
      toast.success('Soubor naimportován — doplňte {{placeholdery}} a uložte')
    } finally {
      setImporting(false)
    }
  }

  async function handleAttachUpload(typ: string, file: File) {
    setAttachUploading(p => ({ ...p, [typ]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/settings/company/priloha/${typ}`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setAttachPaths(p => ({ ...p, [typ]: data.path }))
        toast.success('Soubor nahrán')
      } else {
        toast.error(data.error ?? 'Nahrávání selhalo')
      }
    } finally {
      setAttachUploading(p => ({ ...p, [typ]: false }))
    }
  }

  async function handleAttachDelete(typ: string) {
    setAttachDeleting(p => ({ ...p, [typ]: true }))
    try {
      await fetch(`/api/settings/company/priloha/${typ}`, { method: 'DELETE' })
      setAttachPaths(p => ({ ...p, [typ]: null }))
      toast.success('Příloha odebrána')
    } finally {
      setAttachDeleting(p => ({ ...p, [typ]: false }))
    }
  }

  function startCreate() {
    setCreating(true)
    setEditing(null)
    setForm({ nazev: '', popis: '', obsah: '' })
  }

  function cancel() {
    setCreating(false)
    setEditing(null)
    setForm({ nazev: '', popis: '', obsah: '' })
  }

  const isEditorOpen = creating || editing !== null

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={deleteId !== null}
        title="Smazat šablonu smlouvy"
        message="Smazat šablonu smlouvy? Tato akce je nevratná."
        confirmLabel="Smazat"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />

      {/* Preview modal */}
      {(previewHtml !== null || previewFullDoc !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-slate-700">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">Náhled smlouvy</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Ukázková data — hodnoty budou doplněny z OP při generování</p>
              </div>
              <button onClick={closePreview} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {previewFullDoc !== null ? (
                <iframe
                  srcDoc={previewFullDoc}
                  className="w-full border-0"
                  style={{ height: '75vh' }}
                  sandbox="allow-same-origin"
                  title="Náhled šablony"
                />
              ) : (
                <div className="p-8">
                  <style>{`
                    .sod-preview { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.7; color: #111; }
                    .sod-preview h1 { font-size: 14pt; font-weight: bold; text-align: center; margin: 1em 0 0.8em; }
                    .sod-preview h2 { font-size: 12pt; font-weight: bold; margin: 1em 0 0.5em; }
                    .sod-preview h3 { font-size: 11pt; font-weight: bold; margin: 0.8em 0 0.4em; }
                    .sod-preview p { margin: 0 0 0.6em; }
                    .sod-preview ul, .sod-preview ol { padding-left: 1.5em; margin: 0.4em 0; }
                    .sod-preview li { margin: 0.2em 0; }
                    .sod-sample { background: #fef9c3; color: #92400e; border-radius: 2px; padding: 0 2px; font-style: normal; }
                  `}</style>
                  <div
                    className="sod-preview"
                    dangerouslySetInnerHTML={{ __html: previewHtml! }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Šablony smluv</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Šablony jsou dostupné v záložce Smlouvy u každého obchodního případu.</p>
        </div>
        {!isEditorOpen && (
          <button
            onClick={startCreate}
            className="bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + Nová šablona
          </button>
        )}
      </div>

      <ContractTemplateGuide />

      {/* Editor */}
      {isEditorOpen && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">{creating ? 'Nová šablona' : 'Upravit šablonu'}</h3>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.html,.htm"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-40"
              >
                {importing ? 'Importuji…' : '⬆ Import z DOCX/HTML'}
              </button>
              <button
                type="button"
                onClick={() => openPreview(form.obsah)}
                disabled={!form.obsah}
                className="text-sm text-primary dark:text-primary-light hover:underline disabled:opacity-40 disabled:no-underline"
              >
                Náhled s ukázkovými daty →
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Název šablony</label>
            <input
              type="text"
              value={form.nazev}
              onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))}
              placeholder="Smlouva o dílo – Klimatizace 21 % se zálohou"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Popis <span className="text-gray-400 font-normal">(nepovinné)</span></label>
            <input
              type="text"
              value={form.popis}
              onChange={e => setForm(f => ({ ...f, popis: e.target.value }))}
              placeholder="Krátká poznámka, k čemu šablona slouží"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Obsah smlouvy</label>
            <SodTemplateEditor
              content={form.obsah}
              onChange={v => setForm(f => ({ ...f, obsah: v }))}
              showPlaceholders
              minHeight="60vh"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={creating ? handleCreate : handleUpdate}
              disabled={!form.nazev || saving}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? 'Ukládám…' : 'Uložit šablonu'}
            </button>
            <button onClick={cancel} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-2">
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Název</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Obsah (náhled)</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {templates.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                  Žádné šablony. Přidejte první šablonu smlouvy.
                </td>
              </tr>
            )}
            {templates.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900 dark:text-white">{t.nazev}</p>
                  {t.popis && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{t.popis}</p>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400 max-w-md">
                  <p className="truncate">{stripHtml(t.obsah).substring(0, 100)}{stripHtml(t.obsah).length > 100 ? '…' : ''}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => openPreview(t.obsah)}
                      className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                    >
                      Náhled
                    </button>
                    <button
                      onClick={() => startEdit(t)}
                      className="text-sm text-primary dark:text-primary-light hover:text-blue-800 font-medium"
                    >
                      Upravit
                    </button>
                    <button
                      onClick={() => handleDuplicate(t)}
                      className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                    >
                      Duplikovat
                    </button>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      className="text-sm text-red-500 dark:text-red-400 hover:text-red-700"
                    >
                      Smazat
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Přílohy smluv */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Přílohy smluv</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            PDF soubory, které lze přiložit k vygenerované smlouvě o dílo (VOP, záruční podmínky, ceník).
          </p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {([
            { typ: 'vop',   label: 'Všeobecné obchodní podmínky (VOP)' },
            { typ: 'vzsp',  label: 'Všeobecné záruční a servisní podmínky (VZSP)' },
            { typ: 'cenik', label: 'Ceník' },
          ] as const).map(({ typ, label }) => (
            <div key={typ} className="px-5 py-3.5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{label}</p>
                {attachPaths[typ] ? (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 truncate">
                    ✓ Nahráno
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Žádný soubor</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {attachPaths[typ] && (
                  <a
                    href={attachPaths[typ]!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary dark:text-primary-light hover:underline"
                  >
                    Zobrazit
                  </a>
                )}
                <label className={`cursor-pointer text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-colors ${attachUploading[typ] ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover'}`}>
                  {attachUploading[typ] ? 'Nahrávám…' : attachPaths[typ] ? 'Nahradit' : 'Nahrát PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={attachUploading[typ]}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) handleAttachUpload(typ, f)
                    }}
                  />
                </label>
                {attachPaths[typ] && (
                  <button
                    onClick={() => handleAttachDelete(typ)}
                    disabled={attachDeleting[typ]}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 disabled:opacity-50"
                  >
                    {attachDeleting[typ] ? '…' : 'Odebrat'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
