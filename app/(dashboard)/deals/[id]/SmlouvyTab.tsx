'use client'

import { confirmDialog } from '@/components/ui/confirm'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SodTyp } from '@prisma/client'

const TYP_LABELS: Record<SodTyp, string> = {
  DPH_12_BEZ_ZALOHY: '12% bez zálohy',
  DPH_12_SE_ZALOHOU: '12% se zálohou',
  DPH_21_BEZ_ZALOHY: '21% bez zálohy',
  DPH_21_SE_ZALOHOU: '21% se zálohou',
  PDP_BEZ_ZALOHY: 'PDP bez zálohy',
  PDP_SE_ZALOHOU: 'PDP se zálohou',
}

const TYP_COLORS: Record<SodTyp, string> = {
  DPH_12_BEZ_ZALOHY: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  DPH_12_SE_ZALOHOU: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  DPH_21_BEZ_ZALOHY: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  DPH_21_SE_ZALOHOU: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  PDP_BEZ_ZALOHY: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  PDP_SE_ZALOHOU: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
}

interface Sod {
  id: string
  cislo: string
  typ: SodTyp
  vytvoreno: string
  templateId: string | null
}

interface Template {
  id: string
  nazev: string
}

interface Props {
  dealId: string
  role: string
}

export default function SmlouvyTab({ dealId, role }: Props) {
  const router = useRouter()
  const [sods, setSods] = useState<Sod[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/deals/${dealId}/sod`).then(r => r.json()),
      fetch('/api/contract-templates').then(r => r.json()),
    ]).then(([sodsData, tplData]) => {
      if (Array.isArray(sodsData)) setSods(sodsData)
      if (Array.isArray(tplData)) {
        setTemplates(tplData)
        if (tplData.length > 0) setSelectedTemplate(tplData[0].id)
      }
    }).finally(() => setLoading(false))
  }, [dealId])

  async function handleGenerate() {
    if (!selectedTemplate) return
    setGenError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/sod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, templateId: selectedTemplate }),
      })
      if (res.ok) {
        const sod = await res.json()
        router.push(`/sod/${sod.id}`)
      } else {
        const d = await res.json()
        setGenError(d.error ?? 'Chyba při generování')
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(sodId: string, cislo: string) {
    if (!(await confirmDialog(`Smazat SOD ${cislo}? Tato akce je nevratná.`, { confirmLabel: 'Smazat' }))) return
    setDeletingId(sodId)
    try {
      const res = await fetch(`/api/sod/${sodId}`, { method: 'DELETE' })
      if (res.ok) {
        setSods(prev => prev.filter(s => s.id !== sodId))
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Chyba při mazání')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="font-semibold text-gray-900 dark:text-white flex-1">Smlouvy o dílo</h2>
            {!loading && templates.length === 0 ? (
              <Link href="/settings/contract-templates" className="text-sm text-primary dark:text-primary-light hover:underline">
                Nejprve nastavte šablony smluv →
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  disabled={generating || loading}
                  className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.nazev}</option>
                  ))}
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !selectedTemplate}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {generating ? 'Generuji…' : 'Generovat smlouvu'}
                </button>
              </div>
            )}
          </div>
          {genError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{genError}</p>}
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-slate-500">Načítám…</div>
        ) : sods.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-slate-400">Zatím žádné smlouvy o dílo.</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Klikněte na &bdquo;Nová smlouva o dílo&ldquo; pro vytvoření.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {sods.map(sod => (
              <div key={sod.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white w-32 shrink-0">{sod.cislo}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYP_COLORS[sod.typ]}`}>
                  {TYP_LABELS[sod.typ]}
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">
                  {new Date(sod.vytvoreno).toLocaleDateString('cs-CZ')}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Link
                    href={`/sod/${sod.id}`}
                    className="text-xs font-medium text-primary dark:text-primary-light hover:underline px-2 py-1 rounded"
                  >
                    Detail
                  </Link>
                  <a
                    href={`/api/sod/${sod.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    PDF
                  </a>
                  <a
                    href={`/api/sod/${sod.id}/docx`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    DOCX
                  </a>
                  {role === 'ADMIN' && (
                    <button
                      onClick={() => handleDelete(sod.id, sod.cislo)}
                      disabled={deletingId === sod.id}
                      className="text-xs font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      {deletingId === sod.id ? '…' : 'Smazat'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
