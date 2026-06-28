'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SOD_PLACEHOLDER_LABELS } from '@/lib/sodPlaceholders'

// Placeholdery, které mají v modalu vlastní pole (níže). Zbytek prázdných
// se vypíše dynamicky jako „Doplnit do smlouvy".
const DEDICATED = new Set(['termin_prevzeti', 'pocet_dni_realizace', 'zmena_term', 'hodnota_zalohy', 'zaloha_splatnost'])

interface Template {
  id: string
  nazev: string
}

interface CheckData {
  emptyPlaceholders: string[]
  usedPlaceholders: string[]
  seZalohou: boolean
  prefill: {
    terminPrevzeti: string
    pocetDniRealizace: string
    zmenaTerm: string
    zalohaKc: number
    zalohaSplatnost: number
    cenaBezDph: number
    cenaSDph: number
    dphSazba: number
  }
}

interface Props {
  dealId: string
  templates: Template[]
  onClose: () => void
}

const fmtKc = (n: number) => Math.round(n).toLocaleString('cs-CZ') + ' Kč'

const inputCls = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
const inputEmptyCls = 'w-full border border-red-300 dark:border-red-700 rounded-lg px-3 py-2 text-sm bg-red-50 dark:bg-red-900/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400/40'

function Label({ children, empty }: { children: React.ReactNode; empty?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
      {children}
      {empty && <span className="ml-1.5 text-xs font-normal text-red-500">prázdné v šabloně</span>}
    </label>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
      {children}
    </p>
  )
}

export default function GenerateSodModal({ dealId, templates, onClose }: Props) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [checkData, setCheckData] = useState<CheckData | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [terminPrevzeti, setTerminPrevzeti] = useState('')
  const [pocetDniRealizace, setPocetDniRealizace] = useState('')
  const [zmenaTerm, setZmenaTerm] = useState('')
  const [zalohaKc, setZalohaKc] = useState('')
  const [zalohaSplatnost, setZalohaSplatnost] = useState('14')
  // Dynamická pole pro ostatní prázdné placeholdery (klient_ico, klient_dic…)
  const [extra, setExtra] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!templateId) return
    setCheckData(null)
    setCheckLoading(true)
    setError('')
    fetch(`/api/sod/check?dealId=${dealId}&templateId=${templateId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setCheckData(data)
        setTerminPrevzeti(data.prefill.terminPrevzeti)
        setPocetDniRealizace(data.prefill.pocetDniRealizace)
        setZmenaTerm(data.prefill.zmenaTerm)
        setZalohaKc(data.prefill.zalohaKc > 0 ? String(data.prefill.zalohaKc) : '')
        setZalohaSplatnost(String(data.prefill.zalohaSplatnost))
        const extraInit: Record<string, string> = {}
        for (const k of data.emptyPlaceholders as string[]) {
          if (!DEDICATED.has(k)) extraInit[k] = ''
        }
        setExtra(extraInit)
      })
      .catch(() => setError('Chyba při načítání dat šablony'))
      .finally(() => setCheckLoading(false))
  }, [dealId, templateId])

  async function handleGenerate() {
    setError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/sod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          templateId,
          terminPrevzeti: terminPrevzeti || null,
          pocetDniRealizace: pocetDniRealizace ? Number(pocetDniRealizace) : null,
          zmenaTerm: zmenaTerm || null,
          zalohaKc: checkData?.seZalohou && zalohaKc ? Number(zalohaKc) : null,
          zalohaSplatnost: checkData?.seZalohou ? Number(zalohaSplatnost) : null,
          overrides: extra,
        }),
      })
      if (res.ok) {
        const sod = await res.json()
        router.push(`/sod/${sod.id}`)
      } else {
        const d = await res.json()
        setError(d.error ?? 'Chyba při generování')
        setGenerating(false)
      }
    } catch {
      setError('Chyba při generování')
      setGenerating(false)
    }
  }

  const empty = checkData?.emptyPlaceholders ?? []
  const used = checkData?.usedPlaceholders ?? []
  const showZmenaTerm = used.includes('zmena_term')
  const extraKeys = Object.keys(extra)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={generating ? undefined : onClose} />

      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Nová smlouva o dílo</h2>
          <button
            onClick={onClose}
            disabled={generating}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Výběr šablony */}
          <div>
            <Label>Šablona smlouvy</Label>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              disabled={generating}
              className={inputCls}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.nazev}</option>
              ))}
            </select>
          </div>

          {checkLoading && (
            <div className="text-sm text-gray-400 dark:text-slate-500 text-center py-3">
              Načítám data šablony…
            </div>
          )}

          {!checkLoading && empty.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                {empty.length === 1
                  ? '1 pole zůstane v smlouvě prázdné'
                  : `${empty.length} pole${empty.length < 5 ? 'a' : ''} zůstanou v smlouvě prázdná`}
                {' '}— vyplňte je níže.
              </span>
            </div>
          )}

          {!checkLoading && checkData && (
            <>
              {/* Cena – informativně */}
              {checkData.prefill.cenaSDph > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Cena bez DPH</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {fmtKc(checkData.prefill.cenaBezDph)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Cena s DPH ({checkData.prefill.dphSazba} %)
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {fmtKc(checkData.prefill.cenaSDph)}
                    </p>
                  </div>
                </div>
              )}

              {/* Termíny */}
              <div className="space-y-3">
                <SectionHeading>Termíny</SectionHeading>
                <div>
                  <Label empty={empty.includes('termin_prevzeti')}>Termín předání</Label>
                  <input
                    type="text"
                    value={terminPrevzeti}
                    onChange={e => setTerminPrevzeti(e.target.value)}
                    placeholder="Q3/2026 nebo 30. 9. 2026"
                    disabled={generating}
                    className={empty.includes('termin_prevzeti') ? inputEmptyCls : inputCls}
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Volný text</p>
                </div>
                <div>
                  <Label empty={empty.includes('pocet_dni_realizace')}>Počet dní realizace</Label>
                  <input
                    type="number"
                    value={pocetDniRealizace}
                    onChange={e => setPocetDniRealizace(e.target.value)}
                    min="1"
                    placeholder="14"
                    disabled={generating}
                    className={empty.includes('pocet_dni_realizace') ? inputEmptyCls : inputCls}
                  />
                </div>
                {showZmenaTerm && (
                  <div>
                    <Label empty={empty.includes('zmena_term')}>
                      Podmínka změny termínu
                      <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">(nepovinné)</span>
                    </Label>
                    <input
                      type="text"
                      value={zmenaTerm}
                      onChange={e => setZmenaTerm(e.target.value)}
                      placeholder="při prodlení dodávky"
                      disabled={generating}
                      className={empty.includes('zmena_term') ? inputEmptyCls : inputCls}
                    />
                  </div>
                )}
              </div>

              {/* Záloha */}
              {checkData.seZalohou && (
                <div className="space-y-3">
                  <SectionHeading>Záloha</SectionHeading>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label empty={empty.includes('hodnota_zalohy')}>Výše zálohy (Kč)</Label>
                      <input
                        type="number"
                        value={zalohaKc}
                        onChange={e => setZalohaKc(e.target.value)}
                        min="0"
                        step="1"
                        placeholder="50000"
                        disabled={generating}
                        className={empty.includes('hodnota_zalohy') ? inputEmptyCls : inputCls}
                      />
                    </div>
                    <div>
                      <Label empty={empty.includes('zaloha_splatnost')}>Splatnost (dní)</Label>
                      <input
                        type="number"
                        value={zalohaSplatnost}
                        onChange={e => setZalohaSplatnost(e.target.value)}
                        min="1"
                        disabled={generating}
                        className={empty.includes('zaloha_splatnost') ? inputEmptyCls : inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Ostatní prázdná pole ze šablony (klient_ico, klient_dic…) */}
              {extraKeys.length > 0 && (
                <div className="space-y-3">
                  <SectionHeading>Doplnit do smlouvy</SectionHeading>
                  {extraKeys.map(k => (
                    <div key={k}>
                      <Label empty>{SOD_PLACEHOLDER_LABELS[k] ?? k}</Label>
                      <input
                        type="text"
                        value={extra[k]}
                        onChange={e => setExtra(prev => ({ ...prev, [k]: e.target.value }))}
                        disabled={generating}
                        className={extra[k]?.trim() ? inputCls : inputEmptyCls}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700 shrink-0">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            Zrušit
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || checkLoading || !checkData}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generuji…
              </>
            ) : 'Generovat smlouvu'}
          </button>
        </div>
      </div>
    </div>
  )
}
