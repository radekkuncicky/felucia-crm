import { prisma } from '@/lib/prisma'
import { formatKc } from '@/lib/format'
import { cn } from '@/lib/cn'
import { zakazkaFinance } from '@/lib/zakazkaFinance'
import AbraFaktury from './AbraFaktury'

function Karta({ nadpis, hodnota, popis, hodnotaCls, popisCls }: {
  nadpis: string; hodnota: string; popis?: string; hodnotaCls?: string; popisCls?: string
}) {
  return (
    <div className="bg-surface rounded-xl border border-line px-4 py-3">
      <p className="text-xs font-semibold text-muted uppercase mb-1">{nadpis}</p>
      <p className={cn('text-lg font-bold text-fg whitespace-nowrap', hodnotaCls)}>{hodnota}</p>
      {popis && <p className={cn('text-xs text-muted mt-0.5', popisCls)}>{popis}</p>}
    </div>
  )
}

/** Záložka Finance: cena dle OP × vyúčtování × nákupky + faktury z ABRA. */
export default async function FinanceTab({ zakazkaId, orgId, showProdejni, showNakupky }: {
  zakazkaId: string
  orgId: string
  /** financeProdejni */
  showProdejni: boolean
  /** financeNakupky */
  showNakupky: boolean
}) {
  const [f, faktury] = await Promise.all([
    zakazkaFinance(zakazkaId, orgId),
    showProdejni
      ? prisma.abraFaktura.findMany({
          where: { zakazkaId, orgId },
          orderBy: { vystaveno: 'asc' },
          select: { id: true, kod: true, typ: true, typDokl: true, etapaCislo: true, vystaveno: true, splatnost: true, uhrazeno: true, celkemSDph: true, zbyvaUhradit: true },
        })
      : [],
  ])
  if (!f) return null

  const zelena = 'text-green-600 dark:text-green-400'
  const oranzova = 'text-orange-600 dark:text-orange-400'
  const nicProdejni = f.cenaOP === null && f.pocetVyuctovani === 0
  const nicNakupky = f.cnMarzeProc === null && f.nakupniTotal === 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {showProdejni && (
          <>
            <Karta
              nadpis="Cena dle OP"
              hodnota={f.cenaOP !== null ? formatKc(f.cenaOP) : '—'}
              popis={f.cenaOP !== null ? 'aktivní nabídka · bez DPH' : 'bez aktivní nabídky'}
            />
            <Karta
              nadpis="Vyúčtováno"
              hodnota={formatKc(f.vyuctovanoSchvaleno)}
              hodnotaCls={f.vyuctovanoSchvaleno > 0 ? zelena : undefined}
              popis={f.cenaOP ? `${Math.round(f.vyuctovanoSchvaleno / f.cenaOP * 100)} % ceny OP · bez DPH` : 'schválená vyúčtování · bez DPH'}
            />
            <Karta
              nadpis="Vyúčtování celkem"
              hodnota={formatKc(f.vyuctovaniCelkem)}
              popis={f.rozdilVsOP !== null
                ? `${f.rozdilVsOP >= 0 ? '+' : '−'}${formatKc(Math.abs(f.rozdilVsOP))} vs OP · vč. návrhů`
                : 'vč. návrhů · bez DPH'}
              popisCls={f.rozdilVsOP !== null ? cn('font-medium', f.rozdilVsOP >= 0 ? zelena : oranzova) : undefined}
            />
          </>
        )}
        {showNakupky && (
          <>
            <Karta
              nadpis="Marže nabídky"
              hodnota={f.cnMarzeProc !== null ? `${String(f.cnMarzeProc).replace('.', ',')} %` : '—'}
              hodnotaCls={f.cnMarzeProc !== null ? (f.cnMarzeProc >= 30 ? zelena : oranzova) : 'text-muted'}
              popis="aktivní nabídka"
            />
            <Karta
              nadpis="Nákupní cena"
              hodnota={f.nakupniTotal > 0 ? formatKc(f.nakupniTotal) : '—'}
              popis="naskladněné a vydané položky"
            />
          </>
        )}
      </div>
      {(showProdejni ? nicProdejni : true) && (showNakupky ? nicNakupky : true) && (
        <p className="text-sm text-muted">Zatím tu nic není — čísla se objeví s aktivní nabídkou OP, naskladněním položek a prvním vyúčtováním.</p>
      )}
      {showProdejni && (
        <AbraFaktury faktury={faktury.map(x => ({ ...x, celkemSDph: Number(x.celkemSDph), zbyvaUhradit: Number(x.zbyvaUhradit) }))} />
      )}
    </div>
  )
}
