'use client'

import { useMemo, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { VyuctovaniStav } from '@prisma/client'
import { cn } from '@/lib/cn'
import { formatCislo, formatKc } from '@/lib/format'
import { porovnejVyuctovaniSCN, type PolozkaCN, type PolozkaVyu, type StavRadku } from '@/lib/porovnaniVyuctovani'

export interface CNProPorovnani {
  nazev: string
  polozky: PolozkaCN[]
}

export interface VyuProPorovnani {
  id: string
  cislo: string
  stav: VyuctovaniStav
  etapaCislo: number | null
  /** právě otevřené vyúčtování (zvýrazněný sloupec, živé položky) */
  aktualni: boolean
  polozky: Omit<PolozkaVyu, 'vyuId'>[]
}

interface Props {
  cn: CNProPorovnani | null
  /** všechna vyúčtování zakázky v pořadí sloupců */
  vyuctovani: VyuProPorovnani[]
}

const VYU_STAV: Record<VyuctovaniStav, string> = { NAVRH: 'návrh', KE_SCHVALENI: 'ke schválení', SCHVALENO: 'schváleno' }

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
export default function PorovnaniSCN({ cn: nabidka, vyuctovani }: Props) {
  const [open, setOpen] = useState(false)
  const vysledek = useMemo(
    () => (open && nabidka
      ? porovnejVyuctovaniSCN(nabidka.polozky, vyuctovani.flatMap((v) => v.polozky.map((p) => ({ ...p, vyuId: v.id }))))
      : null),
    [open, nabidka, vyuctovani],
  )
  const sloupce = useMemo(() => vyuctovani.map((v) => ({
    ...v,
    celkem: vysledek ? Math.round(vysledek.radky.reduce((s, r) => s + (r.poVyu[v.id]?.celkem ?? 0), 0) * 100) / 100 : 0,
  })), [vyuctovani, vysledek])
  const vice = sloupce.length > 1
  const hlavickaVyu = (v: (typeof sloupce)[number]) => (
    <>
      <span className={cn('font-mono', v.aktualni && 'font-semibold text-fg')}>{v.cislo}</span>
      <span className="block font-normal">{v.etapaCislo !== null ? `etapa ${v.etapaCislo} · ` : ''}{VYU_STAV[v.stav]}</span>
    </>
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

      <Dialog open={open} onClose={() => setOpen(false)} title="Porovnání vyúčtování zakázky s cenovou nabídkou" size="2xl"
        footer={<div className="flex justify-end"><Button variant="ghost" onClick={() => setOpen(false)}>Zavřít</Button></div>}>
        {nabidka && vysledek && (
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              Nabídka: <span className="font-medium text-fg">{nabidka.nazev}</span> · ceny bez DPH, po položkové slevě. Jen pro informaci, nic se nemění.
              {vice
                ? <> Sčítají se všechna vyúčtování zakázky ({sloupce.length}) — rozdíl je za celou zakázku.</>
                : <> Zakázka má zatím jen toto vyúčtování.</>}
            </p>

            {/* Souhrn */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg border border-line px-3 py-2"><p className="text-xs text-muted">Dle CN</p><p className="font-semibold text-fg">{kc(vysledek.souhrn.cnCelkem)}</p></div>
              <div className="rounded-lg border border-line px-3 py-2"><p className="text-xs text-muted">Vyúčtováno{vice ? ` celkem (${sloupce.length}×)` : ''}</p><p className="font-semibold text-fg">{kc(vysledek.souhrn.vyuCelkem)}</p></div>
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
                    <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Dle CN</th>
                    {sloupce.map((v) => (
                      <th key={v.id} className={cn('text-right font-medium px-3 py-2 whitespace-nowrap', v.aktualni && 'bg-primary/10')}>{hlavickaVyu(v)}</th>
                    ))}
                    {vice && <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Vyúčtováno celkem</th>}
                    <th className="text-right font-medium px-3 py-2">Rozdíl</th>
                    <th className="text-left font-medium px-3 py-2">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vysledek.radky.map((r, i) => (
                    <tr key={i} className={STAV[r.stav].radek}>
                      <td className="px-3 py-2 text-fg">{r.nazev}</td>
                      <Bunka d={r.cn} j={r.jednotka} />
                      {sloupce.map((v) => <Bunka key={v.id} d={r.poVyu[v.id] ?? null} j={r.jednotka} zvyraznit={v.aktualni} />)}
                      {vice && <Bunka d={r.vyu} j={r.jednotka} tucne />}
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{rozdilKc(r.rozdil)}</td>
                      <td className="px-3 py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap', STAV[r.stav].stitek)}>{STAV[r.stav].label}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surface-2 font-semibold text-fg border-t border-line">
                  <tr>
                    <td className="px-3 py-2">Celkem</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{kc(vysledek.souhrn.cnCelkem)}</td>
                    {sloupce.map((v) => <td key={v.id} className={cn('px-3 py-2 text-right tabular-nums whitespace-nowrap', v.aktualni && 'bg-primary/10')}>{kc(v.celkem)}</td>)}
                    {vice && <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{kc(vysledek.souhrn.vyuCelkem)}</td>}
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{rozdilKc(vysledek.souhrn.rozdil)}</td>
                    <td />
                  </tr>
                </tfoot>
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
                    {vice && sloupce.filter((v) => r.poVyu[v.id]).map((v) => (
                      <span key={v.id}>{v.cislo}: {mn(r.poVyu[v.id].mnozstvi, r.jednotka)} · {kc(r.poVyu[v.id].celkem)}<br /></span>
                    ))}
                    {vice ? 'Vyúčtováno celkem' : 'VYU'}: {r.vyu ? `${mn(r.vyu.mnozstvi, r.jednotka)} · ${kc(r.vyu.celkem)}` : '—'}
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

/** Buňka tabulky: částka + menší množství pod ní. */
function Bunka({ d, j, zvyraznit, tucne }: { d: { mnozstvi: number; celkem: number } | null; j: string; zvyraznit?: boolean; tucne?: boolean }) {
  return (
    <td className={cn('px-3 py-2 text-right tabular-nums whitespace-nowrap', zvyraznit && 'bg-primary/10', tucne && 'font-medium text-fg')}>
      {d ? (<>{kc(d.celkem)}<span className="block text-xs text-muted">{mn(d.mnozstvi, j)}</span></>) : <span className="text-muted">—</span>}
    </td>
  )
}
