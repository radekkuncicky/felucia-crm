'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/Field'
import { formatDate, formatKc } from '@/lib/format'

type Vykaz = {
  id: string; cislo: number; jmeno: string; userId: string; obdobiOd: string; obdobiDo: string
  hodiny: number; km: number; castka: number; vytvoreno: string
}

const h = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')} h`
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const mesicLabel = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${MESICE[mo - 1]} ${y}` }

/** Uzavřené výkazy techniků s filtrem měsíc/technik a PDF ke stažení. */
export default function UzavreneVykazy({ vykazy, mesice, mesic, technici, technik }: {
  vykazy: Vykaz[]; mesice: string[]; mesic: string | null; technici: { id: string; jmeno: string }[]; technik: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()

  function filtr(key: 'mesic' | 'technik', v: string) {
    const q = new URLSearchParams(sp.toString())
    if (v) q.set(key, v); else q.delete(key)
    router.replace(`/vykazy${q.size ? `?${q}` : ''}`, { scroll: false })
  }

  const soucet = vykazy.reduce((a, v) => a + v.castka, 0)

  return (
    <section className="bg-surface rounded-xl border border-line overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold text-fg">Uzavřené výkazy</h2>
          <p className="text-xs text-muted">Technik výkaz uzavře v appce a fakturuje podle něj. PDF je podklad k jeho faktuře.</p>
        </div>
        <Select aria-label="Měsíc uzavření" value={mesic ?? ''} onChange={e => filtr('mesic', e.target.value)} className="w-auto">
          <option value="">Všechny měsíce</option>
          {mesice.map(m => <option key={m} value={m}>{mesicLabel(m)}</option>)}
        </Select>
        <Select aria-label="Technik" value={technik ?? ''} onChange={e => filtr('technik', e.target.value)} className="w-auto">
          <option value="">Všichni technici</option>
          {technici.map(t => <option key={t.id} value={t.id}>{t.jmeno}</option>)}
        </Select>
      </div>

      {vykazy.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted text-center">Žádný uzavřený výkaz{mesic || technik ? ' pro tento filtr' : ''}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted uppercase border-b border-line">
                <th className="px-4 py-2 font-semibold">Výkaz</th>
                <th className="px-4 py-2 font-semibold">Technik</th>
                <th className="px-4 py-2 font-semibold">Období</th>
                <th className="px-4 py-2 font-semibold text-right">Hodiny</th>
                <th className="px-4 py-2 font-semibold text-right">Km</th>
                <th className="px-4 py-2 font-semibold text-right">Částka</th>
                <th className="px-4 py-2 font-semibold">Uzavřeno</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {vykazy.map(v => (
                <tr key={v.id}>
                  <td className="px-4 py-2 font-medium text-fg whitespace-nowrap">č. {v.cislo}</td>
                  <td className="px-4 py-2 text-fg">{v.jmeno}</td>
                  <td className="px-4 py-2 text-fg whitespace-nowrap">{formatDate(v.obdobiOd)} – {formatDate(v.obdobiDo)}</td>
                  <td className="px-4 py-2 text-right text-fg">{h(v.hodiny)}</td>
                  <td className="px-4 py-2 text-right text-fg">{v.km}</td>
                  <td className="px-4 py-2 text-right font-semibold text-fg whitespace-nowrap">{formatKc(v.castka)}</td>
                  <td className="px-4 py-2 text-muted whitespace-nowrap">{formatDate(v.vytvoreno)}</td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/api/vykazy/${v.id}/pdf`} target="_blank" rel="noopener" className="text-primary-dark dark:text-primary font-medium hover:underline">PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line">
                <td colSpan={5} className="px-4 py-2 font-semibold text-fg">Celkem ({vykazy.length})</td>
                <td className="px-4 py-2 text-right font-bold text-fg whitespace-nowrap">{formatKc(soucet)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
