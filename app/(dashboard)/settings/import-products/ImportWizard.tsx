'use client'

import { toast } from 'sonner'
import { useState, useRef } from 'react'

// Fixed product columns in FELUCIA XLSX template
const FELUCIA_FIXED_COLS = ['KÓD', 'NÁZEV', 'PRODUKTOVÁ ŘADA', 'KATEGORIE', 'JEDNOTKA', 'POPIS', 'DPH (%)', 'NÁKLADOVÁ CENA', 'STANDARDNÍ CENA', 'OBJEDNACÍ KÓD', 'DODAVATEL', 'DODACÍ LHŮTA']

// Raynet-specific column indices (0-based)
const RAYNET_COL = {
  KOD: 0, NAZEV: 1, RADA: 2, KATEGORIE: 3, JEDNOTKA: 4, POPIS: 5,
  DPH: 8, NAKLAD: 10, STD_CENA: 11, CENIK_START: 12,
} as const

interface ProductRow {
  kod: string
  nazev: string
  produktovaRada: string
  kategorie: string
  jednotka: string
  popis: string
  dphSazba: number
  nakladovaCena: number | null
  standardniCena: number
  objednaciKod: string
  dodavatel: string
  dodaciLhuta: string
  cenikyCeny: Record<string, number>
}

interface CenikCol {
  kod: string
  nazev: string
}

type Step = 1 | 2 | 3
type Format = 'felucia' | 'raynet' | null

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  return parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0
}

function parseNumOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function normalizeJednotka(val: string): string {
  const v = val.trim()
  if (!v || v === '1') return 'ks'
  return v
}

/** Parse Raynet ceník header: "[CN-LOW_COST] CN REKU - LOW COST [Kč]" */
function parseRaynetCenikHeader(header: string): { kod: string; nazev: string } | null {
  const match = header.match(/^\[([^\]]+)\]\s*(.*?)\s*(?:\[Kč\])?\s*$/)
  if (!match) return null
  return { kod: match[1].trim(), nazev: match[2].trim() }
}

/** Detect if this is a Raynet file by checking row 6 (index 5) for known headers */
function detectFormat(allRows: unknown[][]): Format {
  if (allRows.length < 8) return 'felucia'

  const row5 = allRows[5] as unknown[]
  const colA = String(row5[0] ?? '').toLowerCase()
  const colB = String(row5[1] ?? '').toLowerCase()

  // Raynet: row 6 has "Kód" in col A, "Název produktu" / "Název" in col B
  if ((colA === 'kód' || colA === 'kod' || colA === 'code') && colB.includes('název')) {
    return 'raynet'
  }

  // First row as header (FELUCIA format): check col 0 or 1 for known names
  const row0 = allRows[0] as unknown[]
  const r0A = String(row0[0] ?? '').toUpperCase()
  const r0B = String(row0[1] ?? '').toUpperCase()
  if (r0A === 'KÓD' || r0A === 'NÁZEV' || r0B === 'NÁZEV' || r0B === 'KÓD') {
    return 'felucia'
  }

  // Fallback: try Raynet if row 6 has content in cols 0-11
  if (row5.filter(v => String(v ?? '').trim()).length >= 5) {
    return 'raynet'
  }

  return 'felucia'
}

function parseRaynetRows(allRows: unknown[][]): { rows: ProductRow[]; cenikCols: CenikCol[] } {
  const headerRow = allRows[5] as unknown[]

  // Parse ceník columns from headers (col 12+)
  const cenikCols: CenikCol[] = []
  for (let i = RAYNET_COL.CENIK_START; i < headerRow.length; i++) {
    const h = String(headerRow[i] ?? '').trim()
    if (!h) continue
    const parsed = parseRaynetCenikHeader(h)
    if (parsed) {
      cenikCols.push(parsed)
    } else {
      cenikCols.push({ kod: h, nazev: h })
    }
  }

  const dataRows = allRows.slice(7) // row 8 (index 7) onward
  const rows: ProductRow[] = []

  for (const rawRow of dataRows) {
    const r = rawRow as unknown[]
    const nazev = String(r[RAYNET_COL.NAZEV] ?? '').trim()
    if (!nazev) continue

    const cenikyCeny: Record<string, number> = {}
    cenikCols.forEach((col, i) => {
      const val = r[RAYNET_COL.CENIK_START + i]
      if (val === '' || val === null || val === undefined) return
      const price = parseNum(val)
      if (price > 0) cenikyCeny[col.kod] = price
    })

    const raynetKod = String(r[RAYNET_COL.KOD] ?? '').trim()
    rows.push({
      // In Raynet, col A (Kód*) is the supplier order code, not internal product code
      kod: '',
      objednaciKod: raynetKod,
      nazev,
      produktovaRada: String(r[RAYNET_COL.RADA] ?? '').trim(),
      kategorie: String(r[RAYNET_COL.KATEGORIE] ?? '').trim(),
      jednotka: normalizeJednotka(String(r[RAYNET_COL.JEDNOTKA] ?? '')),
      popis: String(r[RAYNET_COL.POPIS] ?? '').trim(),
      dphSazba: Math.round(parseNum(r[RAYNET_COL.DPH])) || 12,
      nakladovaCena: parseNumOrNull(r[RAYNET_COL.NAKLAD]),
      standardniCena: parseNum(r[RAYNET_COL.STD_CENA]),
      dodavatel: '',
      dodaciLhuta: '',
      cenikyCeny,
    })
  }

  return { rows, cenikCols }
}

function parseFeluciaRows(raw: Record<string, unknown>[]): { rows: ProductRow[]; cenikCols: CenikCol[] } {
  const fixedSet = new Set(FELUCIA_FIXED_COLS.map(h => h.toLowerCase()))
  const allHeaders = Object.keys(raw[0] ?? {})

  const detectedCenikCols: CenikCol[] = allHeaders
    .filter(h => !fixedSet.has(h.toLowerCase()))
    .map(h => ({ kod: h, nazev: h }))

  const col = (row: Record<string, unknown>, ...variants: string[]): string => {
    for (const v of variants) {
      if (v in row) return String(row[v] ?? '').trim()
      const lower = v.toLowerCase()
      const key = allHeaders.find(h => h.toLowerCase() === lower)
      if (key && key in row) return String(row[key] ?? '').trim()
    }
    return ''
  }

  const colNum = (row: Record<string, unknown>, ...variants: string[]): unknown => {
    for (const v of variants) {
      if (v in row) return row[v]
      const lower = v.toLowerCase()
      const key = allHeaders.find(h => h.toLowerCase() === lower)
      if (key && key in row) return row[key]
    }
    return ''
  }

  const rows: ProductRow[] = raw.map(r => {
    const cenikyCeny: Record<string, number> = {}
    for (const c of detectedCenikCols) {
      const val = r[c.kod]
      if (val !== '' && val !== null && val !== undefined) {
        const price = parseNum(val)
        if (price > 0) cenikyCeny[c.kod] = price
      }
    }
    return {
      kod: col(r, 'KÓD', 'Kód', 'kod', 'CODE', 'Code'),
      nazev: col(r, 'NÁZEV', 'Název', 'nazev', 'NAME', 'Name'),
      produktovaRada: col(r, 'PRODUKTOVÁ ŘADA', 'Produktová řada', 'produktovaRada'),
      kategorie: col(r, 'KATEGORIE', 'Kategorie', 'kategorie', 'CATEGORY'),
      jednotka: normalizeJednotka(col(r, 'JEDNOTKA', 'Jednotka', 'jednotka', 'UNIT') || 'ks'),
      popis: col(r, 'POPIS', 'Popis', 'popis', 'DESCRIPTION'),
      dphSazba: Math.round(parseNum(colNum(r, 'DPH (%)', 'DPH', 'Dph', 'dph', 'dphSazba'))) || 12,
      nakladovaCena: parseNumOrNull(colNum(r, 'NÁKLADOVÁ CENA', 'Nákladová cena', 'nakladovaCena')),
      standardniCena: parseNum(colNum(r, 'STANDARDNÍ CENA', 'Standardní cena', 'standardniCena', 'CENA', 'Cena')),
      objednaciKod: col(r, 'OBJEDNACÍ KÓD', 'Objednací kód', 'objednaciKod'),
      dodavatel: col(r, 'DODAVATEL', 'Dodavatel', 'dodavatel'),
      dodaciLhuta: col(r, 'DODACÍ LHŮTA', 'Dodací lhůta', 'dodaciLhuta'),
      cenikyCeny,
    }
  }).filter(r => r.nazev)

  return { rows, cenikCols: detectedCenikCols }
}

export default function ImportWizard() {
  const [step, setStep] = useState<Step>(1)
  const [rows, setRows] = useState<ProductRow[]>([])
  const [cenikCols, setCenikCols] = useState<CenikCol[]>([])
  const [detectedFormat, setDetectedFormat] = useState<Format>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ importedProducts: number; importedCeniky: number; importedPolozky: number; errors: string[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]

      // Read all rows as arrays for format detection
      const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
      if (allRows.length === 0) { toast.warning('Soubor neobsahuje žádná data.'); return }

      const format = detectFormat(allRows)
      setDetectedFormat(format)

      let parsed: ReturnType<typeof parseRaynetRows>

      if (format === 'raynet') {
        parsed = parseRaynetRows(allRows)
      } else {
        // FELUCIA format: re-read with named headers
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
        parsed = parseFeluciaRows(raw)
      }

      if (parsed.rows.length === 0) { toast.warning('Soubor neobsahuje žádné produkty.'); return }

      setCenikCols(parsed.cenikCols)
      setRows(parsed.rows)
      setStep(2)
    } catch (e) {
      toast.error('Chyba při čtení souboru: ' + String(e))
    }
  }

  async function handleImport() {
    setImporting(true)
    try {
      const res = await fetch('/api/settings/import-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: rows, ceniky: cenikCols }),
      })
      const data = await res.json()
      setResult(data)
      setStep(3)
    } catch {
      toast.error('Chyba při importu')
    } finally {
      setImporting(false)
    }
  }

  function downloadTemplate() {
    const headers = [...FELUCIA_FIXED_COLS, 'CENÍK_A', 'CENÍK_B']
    const ex1 = ['KL-001', 'Klimatizace DAIKIN 3,5kW', 'Klimatizace', 'Split systémy', 'ks', 'Nástěnná klimatizace', '12', '18000', '25000', 'DAI-FTXC35C', 'DAIKIN', '5-7 prac. dní', '23000', '22000']
    const ex2 = ['TC-001', 'Tepelné čerpadlo 8kW', 'Tepelná čerpadla', '', 'ks', '', '12', '60000', '85000', 'ERRQ008AW1', 'Mitsubishi', '2 týdny', '80000', '78000']
    const content = [headers, ex1, ex2].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sablona-produkty.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const steps = [
    { n: 1, label: 'Připravit data' },
    { n: 2, label: 'Náhled & import' },
    { n: 3, label: 'Výsledek' },
  ]

  const withCenikCount = rows.filter(r => Object.keys(r.cenikyCeny).length > 0).length

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${step >= s.n ? 'text-primary dark:text-primary-light' : 'text-gray-400 dark:text-slate-500'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step > s.n ? 'bg-green-500 text-white' : step === s.n ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className="text-sm font-medium hidden sm:block">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-3 ${step > s.n ? 'bg-green-400' : 'bg-gray-200 dark:bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Prepare */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Krok 1: Připravte XLSX soubor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* External CRM format */}
            <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
              <h3 className="font-medium text-purple-800 dark:text-purple-300 mb-1 text-sm">Export z vašeho systému</h3>
              <p className="text-xs text-purple-700 dark:text-purple-400">
                Export z vašeho předchozího CRM — záhlaví na řádku 6, ceníkové sloupce ve formátu <code className="bg-purple-100 dark:bg-purple-900/50 px-1 rounded">[KOD] Název [Kč]</code>
              </p>
            </div>
            {/* FELUCIA format */}
            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-1 text-sm">FELUCIA šablona (CSV/XLSX)</h3>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Záhlaví v prvním řádku: <span className="font-mono">{FELUCIA_FIXED_COLS.slice(0, 3).join(' | ')} …</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Stáhnout FELUCIA šablonu
            </button>
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Mám soubor → Pokračovat
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Upload & preview */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Krok 2: Nahrát soubor</h2>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-primary-light hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
          >
            <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Přetáhněte XLSX nebo CSV soubor</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Export z vašeho systému nebo FELUCIA šablona · klikněte pro výběr</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>

          {rows.length > 0 && (
            <div className="space-y-4">
              {/* Format badge */}
              {detectedFormat && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${detectedFormat === 'raynet' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Detekovaný formát: {detectedFormat === 'raynet' ? 'Export z vašeho systému' : 'FELUCIA šablona'}
                </div>
              )}

              {/* Summary */}
              <div className="flex gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{rows.length}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-500">produktů</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{cenikCols.length}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-500">ceníků</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{withCenikCount}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">prod. s ceník. cenou</p>
                </div>
              </div>

              {cenikCols.length > 0 && (
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Detekované ceníky:</p>
                  <div className="flex flex-wrap gap-2">
                    {cenikCols.map(c => (
                      <span key={c.kod} className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-mono">{c.kod}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Náhled (prvních 10 z {rows.length} řádků):</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
                <table className="w-full text-xs" style={{ minWidth: 600 }}>
                  <thead className="bg-gray-50 dark:bg-slate-900">
                    <tr>
                      {['KÓD', 'NÁZEV', 'KATEGORIE', 'JED.', 'DPH', 'STAND. CENA', 'NÁK. CENA', ...cenikCols.slice(0, 3).map(c => c.kod)].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500 dark:text-slate-400 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-3 py-2 font-mono text-gray-500 dark:text-slate-400">{r.kod || '—'}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white max-w-48 truncate">{r.nazev}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.kategorie || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.jednotka}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.dphSazba} %</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-white">{r.standardniCena.toLocaleString('cs-CZ')} Kč</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.nakladovaCena !== null ? r.nakladovaCena.toLocaleString('cs-CZ') + ' Kč' : '—'}</td>
                        {cenikCols.slice(0, 3).map(c => (
                          <td key={c.kod} className="px-3 py-2 text-gray-600 dark:text-slate-400">
                            {c.kod in r.cenikyCeny ? r.cenikyCeny[c.kod].toLocaleString('cs-CZ') + ' Kč' : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                >
                  {importing ? 'Importuji…' : `Importovat ${rows.length} produktů${cenikCols.length > 0 ? ` + ${cenikCols.length} ceníků` : ''}`}
                </button>
                <button onClick={() => { setRows([]); setCenikCols([]); setDetectedFormat(null); setStep(1) }} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                  Začít znovu
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && result && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl">✅</div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Import dokončen</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {result.importedProducts} produktů · {result.importedCeniky} nových ceníků · {result.importedPolozky} položek ceníků
              </p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Chyby ({result.errors.length}):</p>
              <ul className="text-xs text-red-600 dark:text-red-300 space-y-0.5 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-3">
            <a href="/products" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg">
              Přejít na produkty
            </a>
            <button onClick={() => { setStep(1); setRows([]); setCenikCols([]); setResult(null); setDetectedFormat(null) }} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
              Importovat znovu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
