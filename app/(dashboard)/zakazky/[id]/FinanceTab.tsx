import { prisma } from '@/lib/prisma'
import { formatKc } from '@/lib/format'
import { cn } from '@/lib/cn'
import { zakazkaFinance } from '@/lib/zakazkaFinance'
import { orgPrisma } from '@/lib/orgPrisma'
import { vykazZakazkyPoTechnicich } from '@/lib/vykazPrace'
import AbraFaktury from './AbraFaktury'
import VykazPraceTabulka from './VykazPraceTabulka'

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
  const [f, faktury, vykaz] = await Promise.all([
    zakazkaFinance(zakazkaId, orgId),
    showProdejni
      ? prisma.abraFaktura.findMany({
          where: { zakazkaId, orgId },
          orderBy: { vystaveno: 'asc' },
          select: { id: true, kod: true, typ: true, typDokl: true, etapaCislo: true, vystaveno: true, splatnost: true, uhrazeno: true, celkemSDph: true, zbyvaUhradit: true },
        })
      : [],
    orgPrisma(orgId).vykazPrace.findMany({
      where: { zakazkaId, orgId },
      orderBy: [{ datum: 'asc' }, { vytvoreno: 'asc' }],
      include: { user: { select: { jmeno: true } } },
    }),
  ])
  if (!f) return null
  const technici = vykazZakazkyPoTechnicich(vykaz)
  const nakladPrace = technici.reduce((s, t) => s + t.soucty.castka, 0)

  const zelena = 'text-green-600 dark:text-green-400'
  const oranzova = 'text-orange-600 dark:text-orange-400'
  const nicProdejni = f.cenaOP === null && f.pocetVyuctovani === 0
  const nicNakupky = f.cnMarzeProc === null && f.nakupniTotal === 0
  // hrubý výsledek: vyúčtování (vč. návrhů), jinak cena OP − materiál − práce techniků
  const zaklad = f.vyuctovaniCelkem > 0 ? f.vyuctovaniCelkem : f.cenaOP
  const zbyva = zaklad !== null && zaklad > 0 ? zaklad - f.nakupniTotal - nakladPrace : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <Karta
              nadpis="Práce techniků"
              hodnota={nakladPrace > 0 ? formatKc(nakladPrace) : '—'}
              popis={technici.length
                ? `${String(Math.round(technici.reduce((s, t) => s + t.soucty.hodiny, 0) * 100) / 100).replace('.', ',')} h · ${technici.reduce((s, t) => s + t.soucty.km, 0)} km · náklad`
                : 'zatím nic nezapsáno'}
            />
          </>
        )}
        {showProdejni && showNakupky && zbyva !== null && (
          <Karta
            nadpis="Zbývá po nákladech"
            hodnota={formatKc(zbyva)}
            hodnotaCls={zbyva >= 0 ? zelena : 'text-red-600 dark:text-red-400'}
            popis={`${f.vyuctovaniCelkem > 0 ? 'vyúčtování' : 'cena OP'} − materiál − práce techniků · ${Math.round(zbyva / zaklad! * 100)} %`}
          />
        )}
      </div>
      {(showProdejni ? nicProdejni : true) && (showNakupky ? nicNakupky : true) && technici.length === 0 && (
        <p className="text-sm text-muted">Zatím tu nic není — čísla se objeví s aktivní nabídkou OP, naskladněním položek a prvním vyúčtováním.</p>
      )}
      <VykazPraceTabulka technici={technici} showCastky={showNakupky} />
      {showProdejni && (
        <AbraFaktury faktury={faktury.map(x => ({ ...x, celkemSDph: Number(x.celkemSDph), zbyvaUhradit: Number(x.zbyvaUhradit) }))} />
      )}
    </div>
  )
}
