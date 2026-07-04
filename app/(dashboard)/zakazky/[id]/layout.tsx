import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { techLabels } from '@/lib/constants'
import { canTechnikAccessZakazka } from '@/lib/zakazkyHelpers'
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
  const role = session.user.role
  const isTechnik = role === 'TECHNIK'
  const canEdit = role === 'ADMIN' || role === 'OBCHODNIK'

  if (isTechnik && !(await canTechnikAccessZakazka(session.user.id, params.id, session.user.orgId))) {
    notFound()
  }

  const zakazka = await prisma.zakazka.findFirst({
    where: { id: params.id, orgId },
    include: {
      klient: true,
      vedouci: { select: { id: true, jmeno: true, email: true } },
      op: { select: { id: true, kod: true, predmet: true } },
      polozky: { select: { stav: true, nakupniCena: true, mnozstvi: true } },
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

  // CN marže from linked OP
  let cnMarzeProc: number | null = null
  if (!isTechnik && zakazka.opId) {
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
      if (prodej > 0 && hasNakupniData) {
        cnMarzeProc = Math.round((prodej - nakup) / prodej * 1000) / 10
      }
    }
  }

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
            <div className="flex gap-4 min-w-0 flex-1">
              {/* Titulní foto */}
              <TitulniFotoUpload
                zakazkaId={zakazka.id}
                titulniFotoUrl={zakazka.titulniFotoUrl ?? null}
                canEdit={canEdit}
                canTechnikUpload={isTechnik}
              />

              <div className="space-y-1 min-w-0 flex-1">
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
                  <Link href={`/clients/${zakazka.klient.id}`} className="hover:text-blue-600 hover:underline">
                    {zakazka.klient.jmeno} {zakazka.klient.prijmeni}
                  </Link>
                </p>

                {/* Rozbalovací kontaktní sekce */}
                <details className="mt-2 group">
                  <summary className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 cursor-pointer select-none list-none">
                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Kontakt &amp; adresa
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-3">
                      {adresa && <NavigateButton adresa={adresa} size="xs" />}
                      {zakazka.klient.telefon && (
                        <a href={`tel:${zakazka.klient.telefon}`} className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          {zakazka.klient.telefon}
                        </a>
                      )}
                      {zakazka.klient.email && (
                        <a href={`mailto:${zakazka.klient.email}`} className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          {zakazka.klient.email}
                        </a>
                      )}
                    </div>

                    {/* Místo stavby / adresa instalace */}
                    <MistoStavbyEdit
                      zakazkaId={zakazka.id}
                      mistoStavby={zakazka.mistoStavby ?? null}
                      klientAdresa={adresa}
                      canEdit={canEdit || isTechnik}
                    />
                  </div>
                </details>

                {/* Termín montáže — vždy viditelný */}
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

                {/* Položky progress */}
                {polozkyTotal > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-slate-400 font-medium shrink-0">Položky</span>
                    <div className="flex rounded-full overflow-hidden h-1.5 w-24 bg-gray-100 dark:bg-slate-700 shrink-0">
                      {polozkyStats.CEKA > 0 && <div style={{ width: `${polozkyStats.CEKA / polozkyTotal * 100}%` }} className="bg-gray-300 dark:bg-slate-600" title={`Čeká: ${polozkyStats.CEKA}`} />}
                      {polozkyStats.OBJEDNANO > 0 && <div style={{ width: `${polozkyStats.OBJEDNANO / polozkyTotal * 100}%` }} className="bg-blue-400" title={`Objednáno: ${polozkyStats.OBJEDNANO}`} />}
                      {polozkyStats.NASKLADNENO > 0 && <div style={{ width: `${polozkyStats.NASKLADNENO / polozkyTotal * 100}%` }} className="bg-green-400" title={`Naskladněno: ${polozkyStats.NASKLADNENO}`} />}
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

            {/* Right actions */}
            {!isTechnik && (
              <ZakazkaDetailHeader
                zakazkaId={zakazka.id}
                stav={zakazka.stav}
                opId={zakazka.opId ?? null}
                role={role}
                hasServiceModule={getPlanLimits(session!.user.plan as string).hasServiceModule}
              />
            )}
          </div>
        </div>
      </div>

      {/* Pipeline bar */}
      <PipelineBar
        zakazkaId={zakazka.id}
        currentStav={zakazka.stav}
        canChange={canEdit}
        etapy={zakazka.etapy.map(e => ({ id: e.id, cislo: e.cislo, nazev: e.nazev, stav: e.stav }))}
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
        zakazkaStav={zakazka.stav}
      />

      {/* Marže panel (not technik) — zobraz jen pokud jsou data */}
      {!isTechnik && (cnMarzeProc !== null || nakupniTotal > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">CN marže</p>
            <p className={`text-lg font-bold ${cnMarzeProc !== null ? (cnMarzeProc >= 30 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400') : 'text-gray-400'}`}>
              {cnMarzeProc !== null ? `${cnMarzeProc} %` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Nák. cena</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {nakupniTotal > 0 ? `${nakupniTotal.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Tab bar — always visible, active tab determined from URL */}
      <Suspense fallback={<div className="border-b border-gray-200 dark:border-slate-700 h-10" />}>
        <ZakazkyTabs zakazkaId={zakazka.id} isTechnik={isTechnik} />
      </Suspense>

      {/* Page content */}
      {children}

      {/* Floating quick-note button (mobile) */}
      <RychlaPoznamka zakazkaId={zakazka.id} />
    </div>
  )
}
