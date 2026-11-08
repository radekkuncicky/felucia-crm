'use client'

import { useMemo, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatCislo, formatKc } from '@/lib/format'
import { porovnejVyuctovaniSCN, type PolozkaCN, type PolozkaVyu, type StavRadku } from '@/lib/porovnaniVyuctovani'

export interface CNProPorovnani {
  nazev: string
  polozky: PolozkaCN[]
}

interface Props {
  cn: CNProPorovnani | null
  vyuPolozky: PolozkaVyu[]
  /** vyúčtování jedné etapy — položky z jiných etap se ukážou jako chybějící */
  etapaCislo: number | null
}

const STAV: Record<StavRadku, { label: string; radek: string; stitek: string }> = {
  SHODA: { label: 'Shoda', radek: '', stitek: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  ROZDIL: { label: 'Rozdíl', radek: 'bg-amber-50/60 dark:bg-amber-900/10', stitek: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  CHYBI: { label: 'Chybí ve VYU', radek: 'bg-red-50/60 dark:bg-red-900/10', stitek: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  NAVIC: { label: 'Navíc ve VYU', radek: 'bg-blue-50/60 dark:bg-blue-900/10', stitek: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
}

const kc = (n: number) => formatKc(n)
const rozdilKc = (n: number) => (n === 0 ? '—' : `${n > 0 ? '+' : '−'}${formatKc(Math.abs(n))}`)
const mn = (m: number, j: string) => `${formatCislo(m)} ${j}`

/** Tlačítko + informativní dialog „Porovnat vyúčtování s CN" (nic neukládá). */
export default function PorovnaniSCN({ cn: nabidka, vyuPolozky, etapaCislo }: Props) {
  const [open, setOpen] = useState(false)
  const vysledek = useMemo(
    () => (open && nabidka ? porovnejVyuctovaniSCN(nabidka.polozky, vyuPolozky) : null),
    [open, nabidka, vyuPolozky],
  )

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!nabidka}
        title={nabidka ? 'Porovnat položky vyúčtování s aktivní cenovou nabídkou' : 'Obchodní případ nemá aktivní cenovou nabídku'}
      >
        Porovnat s CN
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Porovnání vyúčtování s cenovou nabídkou" size="2xl"
        footer={<div className="flex justify-end"><Button variant="ghost" onClick={() => setOpen(false)}>Zavřít</Button></div>}>
        {nabidka && vysledek && (
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              Nabídka: <span className="font-medium text-fg">{nabidka.nazev}</span> · ceny bez DPH, po položkové slevě. Jen pro informaci, nic se nemění.
              {etapaCislo !== null && <> Vyúčtování patří k etapě {etapaCislo} — položky jiných etap se ukážou jako chybějící.</>}
            </p>

            {/* Souhrn */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg border border-line px-3 py-2"><p className="text-xs text-muted">Dle CN</p><p className="font-semibold text-fg">{kc(vysledek.souhrn.cnCelkem)}</p></div>
              <div className="rounded-lg border border-line px-3 py-2"><p className="text-xs text-muted">Vyúčtováno</p><p className="font-semibold text-fg">{kc(vysledek.souhrn.vyuCelkem)}</p></div>
              <div className="rounded-lg border border-line px-3 py-2"><p className="text-xs text-muted">Rozdíl</p>
                <p className={cn('font-semibold', vysledek.souhrn.rozdil > 0 ? 'text-blue-700 dark:text-blue-300' : vysledek.souhrn.rozdil < 0 ? 'text-red-700 dark:text-red-300' : 'text-fg')}>{rozdilKc(vysledek.souhrn.rozdil)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(['SHODA', 'ROZDIL', 'CHYBI', 'NAVIC'] as StavRadku[]).map((s) => {
                const pocet = { SHODA: vysledek.souhrn.shoda, ROZDIL: vysledek.souhrn.rozdilu, CHYBI: vysledek.souhrn.chybi, NAVIC: vysledek.souhrn.navic }[s]
                return <span key={s} className={cn('px-2 py-0.5 rounded-full font-medium', STAV[s].stitek)}>{STAV[s].label}: {pocet}</span>
              })}
            </div>

            {/* Desktop tabulka */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs text-muted">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Položka</th>
                    <th className="text-right font-medium px-3 py-2">CN množ.</th>
                    <th className="text-right font-medium px-3 py-2">CN celkem</th>
                    <th className="text-right font-medium px-3 py-2">VYU množ.</th>
                    <th className="text-right font-medium px-3 py-2">VYU celkem</th>
                    <th className="text-right font-medium px-3 py-2">Rozdíl</th>
                    <th className="text-left font-medium px-3 py-2">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vysledek.radky.map((r, i) => (
                    <tr key={i} className={STAV[r.stav].radek}>
                      <td className="px-3 py-2 text-fg">{r.nazev}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.cn ? mn(r.cn.mnozstvi, r.jednotka) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.cn ? kc(r.cn.celkem) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.vyu ? mn(r.vyu.mnozstvi, r.jednotka) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.vyu ? kc(r.vyu.celkem) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rozdilKc(r.rozdil)}</td>
                      <td className="px-3 py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap', STAV[r.stav].stitek)}>{STAV[r.stav].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobil: karty */}
            <ul className="sm:hidden space-y-2">
              {vysledek.radky.map((r, i) => (
                <li key={i} className={cn('rounded-lg border border-line px-3 py-2 space-y-1', STAV[r.stav].radek)}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-fg">{r.nazev}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap', STAV[r.stav].stitek)}>{STAV[r.stav].label}</span>
                  </div>
                  <p className="text-xs text-muted">
                    CN: {r.cn ? `${mn(r.cn.mnozstvi, r.jednotka)} · ${kc(r.cn.celkem)}` : '—'}<br />
                    VYU: {r.vyu ? `${mn(r.vyu.mnozstvi, r.jednotka)} · ${kc(r.vyu.celkem)}` : '—'}
                    {r.rozdil !== 0 && <> · <span className="font-medium text-fg">{rozdilKc(r.rozdil)}</span></>}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </>
  )
}
