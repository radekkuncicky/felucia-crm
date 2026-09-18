import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { techLabels } from '@/lib/constants'
import { formatKc } from '@/lib/format'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { getPerms, isTechnikView } from '@/lib/permissions'
import { getPlanLimits } from '@/lib/planLimits'
import { NavigateButton } from '@/components/NavigateButton'
import ZakazkyTabs from './ZakazkyTabs'
import PipelineBar from './PipelineBar'
import ZakazkaDetailHeader from './ZakazkaDetailHeader'
import MontazDatePicker from './MontazDatePicker'
import MistoStavbyEdit from './MistoStavbyEdit'
import RychlaPoznamka from './RychlaPoznamka'
import EtapySection from './EtapySection'
import CopyLinkButton from './CopyLinkButton'
import TitulniFotoUpload from './TitulniFotoUpload'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return {}
  const z = await prisma.zakazka.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    select: { cislo: true, nazev: true },
  })
  if (!z) return {}
  return { title: `${z.cislo} — ${z.nazev}` }
}

export default async function ZakazkaDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const orgId = session.user.orgId
  const perms = getPerms(session.user)
  // „technický pohled" — bez obchodu: jednodušší breadcrumb, bez odkazu na OP
  const isTechnik = isTechnikView(perms)
  const canEdit = perms.zakazkyEdit
  const showNakupky = perms.financeNakupky

  if (!(await canAccessZakazka(session.user, perms, params.id))) {
    notFound()
  }

  const zakazka = await prisma.zakazka.findFirst({
    where: { id: params.id, orgId },
    include: {
      klient: true,
      vedouci: { select: { id: true, jmeno: true, email: true } },
      op: { select: { id: true, kod: true, predmet: true } },
      polozky: { select: { stav: true, nakupniCena: true, mnozstvi: true } },
      vyuctovani: { select: { stav: true, polozky: { select: { mnozstvi: true, prodejniCena: true } } } },
      techniciRel: { select: { technikId: true } },
      etapy: {
        orderBy: { cislo: 'asc' as const },
        include: {
          predavaky: { select: { id: true, cislo: true, stav: true } },
          vyuctovani: { select: { id: true, cislo: true, stav: true } },
        },
        // montazOd + montazDo included via model defaults
      },
    },
  })

  if (!zakazka) notFound()

  // Polozky stats for progress bar
  const polozkyTotal = zakazka.polozky.length
  const polozkyStats = { CEKA: 0, OBJEDNANO: 0, NASKLADNENO: 0, VYDANO: 0 }
  zakazka.polozky.forEach(p => { polozkyStats[p.stav as keyof typeof polozkyStats]++ })
  const polozkyReady = polozkyStats.NASKLADNENO + polozkyStats.VYDANO

  // Cena dle aktivní nabídky OP + CN marže
  let cnMarzeProc: number | null = null
  let cenaOP: number | null = null
  if ((perms.financeProdejni || showNakupky) && zakazka.opId) {
    const op = await prisma.deal.findFirst({
      where: { id: zakazka.opId, orgId },
      include: {
        quotes: {
          where: { aktivni: true },
          include: { items: { include: { product: { select: { nakladovaCena: true } } } } },
        },
      },
    })
    if (op?.quotes[0]) {
      const q = op.quotes[0]
      const prodej = q.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100), 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nakup = q.items.reduce((s, i: any) => {
        const nakladovaCena = i.nakupniCena != null ? Number(i.nakupniCena) : (i.product?.nakladovaCena != null ? Number(i.product.nakladovaCena) : Number(i.cenaZaKus))
        return s + Number(i.mnozstvi) * nakladovaCena * (1 - Number(i.sleva ?? 0) / 100)
      }, 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasNakupniData = q.items.some((i: any) => i.nakupniCena != null || Number(i.product?.nakladovaCena ?? 0) > 0)
      if (prodej > 0) cenaOP = prodej
      if (prodej > 0 && hasNakupniData) {
        cnMarzeProc = Math.round((prodej - nakup) / prodej * 1000) / 10
      }
    }
  }

  // Součty vyúčtování (bez DPH) pro finanční přehled
  const sumVyuctovani = (list: { polozky: { mnozstvi: unknown; prodejniCena: unknown }[] }[]) =>
    list.reduce((s, v) => s + v.polozky.reduce((t, p) => t + Number(p.mnozstvi) * Number(p.prodejniCena), 0), 0)
  const vyuctovanoSchvaleno = sumVyuctovani(zakazka.vyuctovani.filter(v => v.stav === 'SCHVALENO'))
  const vyuctovaniCelkem = sumVyuctovani(zakazka.vyuctovani)
  const showFinance = perms.financeProdejni && (cenaOP !== null || zakazka.vyuctovani.length > 0)
  const rozdilVsOP = cenaOP !== null ? vyuctovaniCelkem - cenaOP : null

  const nakupniTotal = zakazka.polozky
    .filter(p => p.stav === 'NASKLADNENO' || p.stav === 'VYDANO')
    .reduce((s, p) => s + Number(p.nakupniCena ?? 0) * Number(p.mnozstvi), 0)

  const adresa = [zakazka.klient.ulice, [zakazka.klient.mesto, zakazka.klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
        <div className="flex flex-col gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-slate-500 flex-wrap">
            <Link href={isTechnik ? '/zakazky' : '/zakazky'} className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
              {isTechnik ? 'Moje zakázky' : 'Zakázky'}
            </Link>
            {zakazka.op && !isTechnik && (
              <>
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <Link href={`/deals/${zakazka.op.id}`} className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
                  {zakazka.op.kod ?? zakazka.op.id.slice(0, 8)}
                </Link>
              </>
            )}
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-600 dark:text-slate-300 font-medium">{zakazka.cislo}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0 flex-1">
              {/* Sloupec 1: foto + identifikace */}
              <div className="flex gap-4 min-w-0">
                <TitulniFotoUpload
                  zakazkaId={zakazka.id}
                  titulniFotoUrl={zakazka.titulniFotoUrl ?? null}
                  canEdit={canEdit}
                  canTechnikUpload={true}
                />

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xl font-bold text-green-600 dark:text-green-400">{zakazka.cislo}</span>
                    <CopyLinkButton />
                    {zakazka.technologie && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                        {techLabels[zakazka.technologie as keyof typeof techLabels] ?? zakazka.technologie}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{zakazka.nazev}</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    <Link href={`/clients/${zakazka.klient.id}`} className="hover:text-blue-600 hover:underline font-medium">
                      {zakazka.klient.jmeno} {zakazka.klient.prijmeni}
                    </Link>
                  </p>
                </div>
              </div>

              {/* Sloupec 2: termín + místo instalace */}
              <div className="min-w-0 space-y-3 sm:border-l sm:border-r border-gray-100 dark:border-slate-700 sm:px-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Termín montáže</p>
                  <MontazDatePicker
                    zakazkaId={zakazka.id}
                    montazOd={zakazka.montazOd?.toISOString() ?? null}
                    montazDo={zakazka.montazDo?.toISOString() ?? null}
                    canEdit={canEdit}
                    etapy={zakazka.etapy.map(e => ({
                      id: e.id,
                      cislo: e.cislo,
                      nazev: e.nazev ?? null,
                      montazOd: e.montazOd?.toISOString() ?? null,
                      montazDo: e.montazDo?.toISOString() ?? null,
                    }))}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Místo instalace</p>
                  <MistoStavbyEdit
                    zakazkaId={zakazka.id}
                    mistoStavby={zakazka.mistoStavby ?? null}
                    klientAdresa={adresa}
                    canEdit={true}
                  />
                </div>
              </div>

              {/* Sloupec 3: kontakt na klienta */}
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Kontakt</p>
                <div className="flex flex-col items-start gap-1.5">
                  {zakazka.klient.telefon && (
                    <a href={`tel:${zakazka.klient.telefon}`} className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      {zakazka.klient.telefon}
                    </a>
                  )}
                  {zakazka.klient.email && (
                    <a href={`mailto:${zakazka.klient.email}`} className="inline-flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      {zakazka.klient.email}
                    </a>
                  )}
                  {adresa && <NavigateButton adresa={adresa} label="Adresa klienta" size="xs" />}
                  {!zakazka.klient.telefon && !zakazka.klient.email && (
                    <span className="text-sm text-gray-400 dark:text-slate-500 italic">neuvedeno</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right actions */}
            {(perms.zakazkyMazani || perms.servisDispecink) && (
              <ZakazkaDetailHeader
                zakazkaId={zakazka.id}
                stav={zakazka.stav}
                opId={zakazka.opId ?? null}
                canDelete={perms.zakazkyMazani}
                canServis={perms.servisDispecink}
                hasServiceModule={getPlanLimits(session!.user.plan as string).hasServiceModule}
              />
            )}
          </div>

          {/* Položky progress */}
          {polozkyTotal > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium shrink-0">Položky</span>
              <div className="flex rounded-full overflow-hidden h-1.5 w-24 bg-gray-100 dark:bg-slate-700 shrink-0">
                {polozkyStats.CEKA > 0 && <div style={{ width: `${polozkyStats.CEKA / polozkyTotal * 100}%` }} className="bg-gray-300 dark:bg-slate-600" title={`Čeká: ${polozkyStats.CEKA}`} />}
                {polozkyStats.OBJEDNANO > 0 && <div style={{ width: `${polozkyStats.OBJEDNANO / polozkyTotal * 100}%` }} className="bg-blue-400" title={`Objednáno: ${polozkyStats.OBJEDNANO}`} />}
                {polozkyStats.NASKLADNENO > 0 && <div style={{ width: `${polozkyStats.NASKLADNENO / polozkyTotal * 100}%` }} className="bg-green-400" title={`Rezervováno: ${polozkyStats.NASKLADNENO}`} />}
                {polozkyStats.VYDANO > 0 && <div style={{ width: `${polozkyStats.VYDANO / polozkyTotal * 100}%` }} className="bg-emerald-500" title={`Vydáno: ${polozkyStats.VYDANO}`} />}
              </div>
              <span className="text-xs text-gray-600 dark:text-slate-300">{polozkyReady}/{polozkyTotal}</span>
              {polozkyReady === polozkyTotal && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">vše ready</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline bar */}
      <PipelineBar
        zakazkaId={zakazka.id}
        currentStav={zakazka.stav}
        canChange={canEdit}
        etapy={zakazka.etapy.map(e => ({
          id: e.id,
          cislo: e.cislo,
          nazev: e.nazev,
          stav: e.stav,
          predavaky: e.predavaky.map(p => ({ stav: p.stav })),
          vyuctovani: e.vyuctovani.map(v => ({ stav: v.stav })),
        }))}
      />

      {/* Etapy sekce */}
      <EtapySection
        zakazkaId={zakazka.id}
        etapy={zakazka.etapy.map(e => ({
          id: e.id,
          cislo: e.cislo,
          nazev: e.nazev,
          montazOd: e.montazOd?.toISOString() ?? null,
          montazDo: e.montazDo?.toISOString() ?? null,
          stav: e.stav,
          poznamka: e.poznamka,
          predavaky: e.predavaky,
          vyuctovani: e.vyuctovani,
        }))}
        canEdit={canEdit}
      />

      {/* Finanční přehled — cena dle OP vs. vyúčtování (bez DPH) + marže z nákupek */}
      {(showFinance || (showNakupky && (cnMarzeProc !== null || nakupniTotal > 0))) && (
        <div className="flex flex-wrap gap-3">
          {showFinance && (
            <>
              <div className="flex-1 min-w-[160px] bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Cena dle OP</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{cenaOP !== null ? formatKc(cenaOP) : '—'}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {cenaOP !== null ? 'aktivní nabídka · bez DPH' : 'bez aktivní nabídky'}
                </p>
              </div>
              <div className="flex-1 min-w-[160px] bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Vyúčtováno</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatKc(vyuctovanoSchvaleno)}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {cenaOP !== null && cenaOP > 0
                    ? `${Math.round(vyuctovanoSchvaleno / cenaOP * 100)} % ceny OP · bez DPH`
                    : 'schválená vyúčtování · bez DPH'}
                </p>
              </div>
              <div className="flex-1 min-w-[160px] bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Vyúčtování celkem</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatKc(vyuctovaniCelkem)}</p>
                {rozdilVsOP !== null ? (
                  <p className={`text-xs mt-0.5 font-medium ${rozdilVsOP >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {rozdilVsOP >= 0 ? '+' : '−'}{formatKc(Math.abs(rozdilVsOP))} vs OP · vč. návrhů
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">vč. návrhů · bez DPH</p>
                )}
              </div>
            </>
          )}
          {showNakupky && (cnMarzeProc !== null || nakupniTotal > 0) && (
            <>
              <div className="flex-1 min-w-[160px] bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">CN marže</p>
                <p className={`text-lg font-bold ${cnMarzeProc !== null ? (cnMarzeProc >= 30 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400') : 'text-gray-400'}`}>
                  {cnMarzeProc !== null ? `${cnMarzeProc} %` : '—'}
                </p>
              </div>
              <div className="flex-1 min-w-[160px] bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Nák. cena</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {nakupniTotal > 0 ? formatKc(nakupniTotal) : '—'}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab bar — always visible, active tab determined from URL */}
      <Suspense fallback={<div className="border-b border-gray-200 dark:border-slate-700 h-10" />}>
        <ZakazkyTabs zakazkaId={zakazka.id} showTechnici={canEdit} showVyuctovani={perms.financeProdejni} showHistorie={canEdit} />
      </Suspense>

      {/* Page content */}
      {children}

      {/* Floating quick-note button (mobile) */}
      <RychlaPoznamka zakazkaId={zakazka.id} />
    </div>
  )
}
