'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const TYP_OPTIONS: [string, string][] = [
  ['PRACE', 'Práce'],
  ['MATERIAL', 'Materiál'],
  ['DOPRAVA', 'Doprava'],
  ['JINE', 'Jiné'],
]

type Row = {
  typ: string
  popis: string
  mnozstvi: string
  jednotka: string
  cenaZaJednotku: string
  krytoKontraktem: boolean
  dphSazba: string
}

interface Props {
  zakazkaId: string
  protokolDokoncen: string | null
  vyfakturovano: boolean
  zaplaceno: boolean
  canEdit: boolean
}

const num = (v: string, f = 0) => {
  const n = parseFloat((v || '').replace(',', '.'))
  return Number.isFinite(n) ? n : f
}
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const fmtKc = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč'

function emptyRow(): Row {
  return { typ: 'PRACE', popis: '', mnozstvi: '1', jednotka: 'ks', cenaZaJednotku: '', krytoKontraktem: false, dphSazba: '12' }
}

export default function VyuctovaniSekce({ zakazkaId, protokolDokoncen, vyfakturovano: vyfInit, zaplaceno: zapInit, canEdit }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [vyfakturovano, setVyfakturovano] = useState(vyfInit)
  const [zaplaceno, setZaplaceno] = useState(zapInit)

  useEffect(() => {
    fetch(`/api/servis/zakazky/${zakazkaId}/polozky`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.polozky) {
          setRows(d.polozky.map((p: Record<string, unknown>) => ({
            typ: String(p.typ ?? 'PRACE'),
            popis: String(p.popis ?? ''),
            mnozstvi: String(p.mnozstvi ?? '1'),
            jednotka: String(p.jednotka ?? 'ks'),
            cenaZaJednotku: p.cenaZaJednotku == null ? '' : String(p.cenaZaJednotku),
            krytoKontraktem: Boolean(p.krytoKontraktem),
            dphSazba: String(p.dphSazba ?? '12'),
          })))
        }
      })
      .finally(() => setLoading(false))
  }, [zakazkaId])

  function patch(i: number, p: Partial<Row>) {
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  }

  // Součty (zrcadlí serverový computeVyuctovani: kryto -> 0 klientovi).
  let zaklad = 0, dph = 0
  for (const r of rows) {
    if (r.krytoKontraktem) continue
    const z = round2(num(r.mnozstvi) * num(r.cenaZaJednotku))
    zaklad += z
    dph += round2(z * (num(r.dphSazba, 12) / 100))
  }
  zaklad = round2(zaklad)
  dph = round2(dph)
  const celkem = round2(zaklad + dph)

  async function save() {
    setSaving(true)
    try {
      await api.put(`/api/servis/zakazky/${zakazkaId}/polozky`, { polozky: rows },
        { errorMessage: 'Položky se nepodařilo uložit.' })
    } finally { setSaving(false) }
  }

  async function vyuctovat() {
    setActing(true)
    try {
      const res = await api.post(`/api/servis/zakazky/${zakazkaId}/vyuctovat`, undefined,
        { errorMessage: 'Vyúčtování se nepodařilo dokončit.' })
      if (res.ok) { setVyfakturovano(true); router.refresh() }
    } finally { setActing(false) }
  }

  async function toggleZaplaceno() {
    const next = !zaplaceno
    setZaplaceno(next)
    const res = await api.patch(`/api/servis/zakazky/${zakazkaId}`, { zaplaceno: next },
      { errorMessage: 'Změnu se nepodařilo uložit.' })
    if (!res.ok) setZaplaceno(!next)
    else router.refresh()
  }

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500'
  const card = 'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5'

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-semibold text-gray-900 dark:text-white">Vyúčtování</h2>
        <div className="flex items-center gap-2">
          {vyfakturovano && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">Vyúčtováno</span>}
          {zaplaceno && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">Zaplaceno</span>}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Načítám…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-slate-400 text-left">
                  <th className="pb-1 pr-2 font-medium">Typ</th>
                  <th className="pb-1 pr-2 font-medium">Popis</th>
                  <th className="pb-1 pr-2 font-medium text-right">Množ.</th>
                  <th className="pb-1 pr-2 font-medium">Jedn.</th>
                  <th className="pb-1 pr-2 font-medium text-right">Cena/j.</th>
                  <th className="pb-1 pr-2 font-medium text-right">DPH %</th>
                  <th className="pb-1 pr-2 font-medium text-center">Kontrakt</th>
                  <th className="pb-1"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-slate-700/50">
                    <td className="py-1 pr-2">
                      <select value={r.typ} onChange={e => patch(i, { typ: e.target.value })} disabled={!canEdit} className={inp}>
                        {TYP_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="py-1 pr-2"><input value={r.popis} onChange={e => patch(i, { popis: e.target.value })} disabled={!canEdit} className={inp} placeholder="Popis položky" /></td>
                    <td className="py-1 pr-2 w-16"><input value={r.mnozstvi} onChange={e => patch(i, { mnozstvi: e.target.value })} disabled={!canEdit} className={`${inp} text-right`} /></td>
                    <td className="py-1 pr-2 w-14"><input value={r.jednotka} onChange={e => patch(i, { jednotka: e.target.value })} disabled={!canEdit} className={inp} /></td>
                    <td className="py-1 pr-2 w-24"><input value={r.cenaZaJednotku} onChange={e => patch(i, { cenaZaJednotku: e.target.value })} disabled={!canEdit || r.krytoKontraktem} className={`${inp} text-right`} placeholder="0" /></td>
                    <td className="py-1 pr-2 w-16"><input value={r.dphSazba} onChange={e => patch(i, { dphSazba: e.target.value })} disabled={!canEdit} className={`${inp} text-right`} /></td>
                    <td className="py-1 pr-2 text-center"><input type="checkbox" checked={r.krytoKontraktem} onChange={e => patch(i, { krytoKontraktem: e.target.checked })} disabled={!canEdit} className="accent-green-600" /></td>
                    <td className="py-1">
                      {canEdit && (
                        <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500" title="Odebrat">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="py-3 text-center text-sm text-gray-400 dark:text-slate-500">Žádné položky</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <button onClick={() => setRows(rs => [...rs, emptyRow()])} className="mt-2 text-sm text-green-600 dark:text-green-400 hover:underline">+ Přidat položku</button>
          )}

          <div className="mt-4 ml-auto w-56 text-sm space-y-1">
            <div className="flex justify-between text-gray-600 dark:text-slate-300"><span>Základ bez DPH</span><span>{fmtKc(zaklad)}</span></div>
            <div className="flex justify-between text-gray-600 dark:text-slate-300"><span>DPH</span><span>{fmtKc(dph)}</span></div>
            <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-slate-600 pt-1 mt-1"><span>Celkem</span><span>{fmtKc(celkem)}</span></div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canEdit && (
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
                {saving ? 'Ukládám…' : 'Uložit položky'}
              </button>
            )}
            <a href={`/api/servis/zakazky/${zakazkaId}/faktura`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
              Podklad faktury PDF
            </a>
            {canEdit && !vyfakturovano && (
              <button
                onClick={vyuctovat}
                disabled={acting || !protokolDokoncen}
                title={!protokolDokoncen ? 'Nejdřív dokončete protokol' : undefined}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {acting ? 'Zpracovávám…' : 'Vyúčtovat'}
              </button>
            )}
            {canEdit && vyfakturovano && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={zaplaceno} onChange={toggleZaplaceno} className="accent-green-600" />
                Zaplaceno
              </label>
            )}
          </div>
          {!protokolDokoncen && !vyfakturovano && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Vyúčtovat lze až po dokončení protokolu.</p>
          )}
        </>
      )}
    </div>
  )
}
