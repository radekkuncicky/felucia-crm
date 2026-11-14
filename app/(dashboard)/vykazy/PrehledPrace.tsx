'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { formatDate, formatKc } from '@/lib/format'
import type { PraceTechnik, PraceZakazka } from '@/lib/vykazPrace'

const h = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')} h`
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const obdobiLabel = (o: string) => {
  if (/^\d{4}$/.test(o)) return `celý rok ${o}`
  const [y, m] = o.split('-').map(Number)
  return `${MESICE[m - 1]} ${y}`
}
const odkaz = (z: PraceZakazka['zakazka']) => (z.druh === 'SERVIS' ? `/servis/zakazky/${z.id}` : `/zakazky/${z.id}`)
const zakazkyText = (n: number) => `${n} ${n === 1 ? 'zakázka' : n >= 2 && n <= 4 ? 'zakázky' : 'zakázek'}`

function ZakazkaRadek({ z }: { z: PraceZakazka }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className="border-t border-line align-top">
        <td className="py-2 pr-3">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="text-left text-fg hover:underline"
          >
            <span className="text-muted mr-1" aria-hidden>{open ? '▾' : '▸'}</span>
            <span className="font-medium">{z.zakazka.cislo}</span> <span className="text-muted">{z.zakazka.nazev}</span>
          </button>
        </td>
        <td className="py-2 pr-3 text-right text-fg whitespace-nowrap">{z.soucty.hodiny ? h(z.soucty.hodiny) : '—'}</td>
        <td className="py-2 pr-3 text-right text-fg whitespace-nowrap">{z.soucty.km || '—'}</td>
        <td className="py-2 pr-3 text-right text-fg whitespace-nowrap">{z.soucty.castkaPolozky ? formatKc(z.soucty.castkaPolozky) : '—'}</td>
        <td className="py-2 text-right font-semibold text-fg whitespace-nowrap">
          {formatKc(z.soucty.castka)}
          {z.soucty.chybiSazba > 0 && <span className="block text-xs font-normal text-amber-700 dark:text-amber-400">bez sazby: {z.soucty.chybiSazba}×</span>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="pb-3">
            <div className="bg-surface-2 rounded-lg p-2 overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {z.zaznamy.map(r => (
                    <tr key={r.id} className="align-top">
                      <td className="py-1 pr-3 whitespace-nowrap text-muted">{formatDate(r.datum)}</td>
                      <td className="py-1 pr-3 text-fg">
                        {r.typ === 'POLOZKA' ? r.popis : `Výjezd · ${h(r.hodiny)} · ${r.km} km`}
                        {r.poznamka && <span className="block text-muted">{r.poznamka}</span>}
                      </td>
                      <td className="py-1 pr-3 whitespace-nowrap text-muted">{r.vyfakturovano ? 'uzavřeno' : 'otevřené'}</td>
                      <td className="py-1 text-right whitespace-nowrap text-fg">
                        {r.chybiSazba ? <span className="text-amber-700 dark:text-amber-400">čeká na sazbu</span> : formatKc(r.castka)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link href={odkaz(z.zakazka)} className="inline-block mt-1 text-xs text-primary-dark dark:text-primary font-medium hover:underline">
                Otevřít {z.zakazka.druh === 'SERVIS' ? 'servis' : 'zakázku'} →
              </Link>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function DetailTechnika({ t, obdobi, onClose }: { t: PraceTechnik | null; obdobi: string; onClose: () => void }) {
  return (
    <Dialog open={!!t} onClose={onClose} size="2xl" title={t ? `${t.jmeno} — ${obdobiLabel(obdobi)}` : ''}>
      {t && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {zakazkyText(t.zakazky.length)} · {h(t.soucty.hodiny)} · {t.soucty.km} km · celkem{' '}
            <span className="font-semibold text-fg">{formatKc(t.soucty.castka)}</span>
            {t.uzavreno > 0 && t.uzavreno < t.soucty.castka && <> (uzavřeno ve výkazech {formatKc(t.uzavreno)})</>}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted uppercase">
                  <th className="py-1.5 pr-3 font-semibold">Zakázka</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Hodiny</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Km</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Položky</th>
                  <th className="py-1.5 font-semibold text-right">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {t.zakazky.map(z => <ZakazkaRadek key={`${z.zakazka.druh}:${z.zakazka.id}`} z={z} />)}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold text-fg">
                  <td className="py-2 pr-3">Celkem</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{h(t.soucty.hodiny)}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{t.soucty.km}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{formatKc(t.soucty.castkaPolozky)}</td>
                  <td className="py-2 text-right whitespace-nowrap">{formatKc(t.soucty.castka)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  )
}

/** Kdo kolik fakturoval za období (otevřené + uzavřené záznamy podle data práce); řádek → dialog se zakázkami. */
export default function PrehledPrace({ technici, obdobi, moznosti }: { technici: PraceTechnik[]; obdobi: string; moznosti: string[] }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = technici.find(t => t.userId === detailId) ?? null

  function zmenObdobi(v: string) {
    const q = new URLSearchParams(sp.toString())
    q.set('obdobi', v)
    router.replace(`/vykazy?${q}`, { scroll: false })
  }

  const celkem = technici.reduce(
    (a, t) => ({
      hodiny: a.hodiny + t.soucty.hodiny, km: a.km + t.soucty.km,
      prace: a.prace + t.soucty.castkaHodiny + t.soucty.castkaKm, polozky: a.polozky + t.soucty.castkaPolozky,
      castka: a.castka + t.soucty.castka, uzavreno: a.uzavreno + t.uzavreno,
    }),
    { hodiny: 0, km: 0, prace: 0, polozky: 0, castka: 0, uzavreno: 0 },
  )

  return (
    <section className="bg-surface rounded-xl border border-line overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold text-fg">Přehled práce</h2>
          <p className="text-xs text-muted">Kolik kdo zapsal a za co, podle data práce. Klikni na technika pro rozpis po zakázkách.</p>
        </div>
        <Select aria-label="Období" value={obdobi} onChange={e => zmenObdobi(e.target.value)} className="w-auto">
          {moznosti.map(o => <option key={o} value={o}>{obdobiLabel(o)}</option>)}
        </Select>
      </div>

      {technici.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted text-center">Za {obdobiLabel(obdobi)} nikdo nic nezapsal.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted uppercase border-b border-line">
                <th className="px-4 py-2 font-semibold">Technik</th>
                <th className="px-4 py-2 font-semibold text-right">Zakázky</th>
                <th className="px-4 py-2 font-semibold text-right">Hodiny</th>
                <th className="px-4 py-2 font-semibold text-right">Km</th>
                <th className="px-4 py-2 font-semibold text-right">Práce + km</th>
                <th className="px-4 py-2 font-semibold text-right">Položky</th>
                <th className="px-4 py-2 font-semibold text-right">Celkem</th>
                <th className="px-4 py-2 font-semibold text-right">Uzavřeno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {technici.map(t => (
                <tr
                  key={t.userId}
                  onClick={() => setDetailId(t.userId)}
                  className="cursor-pointer hover:bg-surface-2"
                >
                  <td className="px-4 py-2">
                    <button type="button" onClick={e => { e.stopPropagation(); setDetailId(t.userId) }} className="font-medium text-fg hover:underline text-left">
                      {t.jmeno}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right text-fg">{t.zakazky.length}</td>
                  <td className="px-4 py-2 text-right text-fg whitespace-nowrap">{h(t.soucty.hodiny)}</td>
                  <td className="px-4 py-2 text-right text-fg">{t.soucty.km}</td>
                  <td className="px-4 py-2 text-right text-fg whitespace-nowrap">{formatKc(t.soucty.castkaHodiny + t.soucty.castkaKm)}</td>
                  <td className="px-4 py-2 text-right text-fg whitespace-nowrap">{formatKc(t.soucty.castkaPolozky)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-fg whitespace-nowrap">
                    {formatKc(t.soucty.castka)}
                    {t.soucty.chybiSazba > 0 && <span className="block text-xs font-normal text-amber-700 dark:text-amber-400">{t.soucty.chybiSazba}× bez sazby</span>}
                  </td>
                  <td className={cn('px-4 py-2 text-right whitespace-nowrap', t.uzavreno >= t.soucty.castka ? 'text-fg' : 'text-muted')}>
                    {formatKc(t.uzavreno)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-semibold text-fg">
                <td className="px-4 py-2">Celkem</td>
                <td />
                <td className="px-4 py-2 text-right whitespace-nowrap">{h(celkem.hodiny)}</td>
                <td className="px-4 py-2 text-right">{celkem.km}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{formatKc(celkem.prace)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{formatKc(celkem.polozky)}</td>
                <td className="px-4 py-2 text-right font-bold whitespace-nowrap">{formatKc(celkem.castka)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{formatKc(celkem.uzavreno)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <DetailTechnika t={detail} obdobi={obdobi} onClose={() => setDetailId(null)} />
    </section>
  )
}
