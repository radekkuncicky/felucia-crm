import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { techLabels, zakazkaStavLabels } from '@/lib/constants'
import { formatKc } from '@/lib/format'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { getPerms, isTechnikView } from '@/lib/permissions'
import { getPlanLimits } from '@/lib/planLimits'
import { NavigateButton } from '@/components/NavigateButton'
import ZakazkyTabs from './ZakazkyTabs'
import { vychoziZakazkaTab } from '@/lib/zakazkaTaby'
import PipelineBar from './PipelineBar'
import ZakazkaDetailHeader from './ZakazkaDetailHeader'
import MontazDatePicker from './MontazDatePicker'
import MistoStavbyEdit from './MistoStavbyEdit'
import KdykolivToggle from './KdykolivToggle'
import RychlaPoznamka from './RychlaPoznamka'
import EtapySection from './EtapySection'
import ZakazkaTechnici from './ZakazkaTechnici'
import CopyLinkButton from './CopyLinkButton'
import TitulniFotoUpload from './TitulniFotoUpload'
import AbraZakazkaTlacitko from './AbraZakazkaTlacitko'
import { abraKonfigurace } from '@/lib/abra/flexi'
import { CISLO_ZAKAZKY_ABRA } from '@/lib/abra/zakazka'
import SodStavBadge from './SodStavBadge'
import { sodStavZakazky } from '@/lib/sodStavZakazky'
import { SbalitelnyDetail, SbalitelnaCast, SbalitPrepinac, RychleAkce, JenPlnaHlavicka } from './MobilniHlavicka'
import { zakazkaFinance } from '@/lib/zakazkaFinance'

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
      polozky: { select: { stav: true } },
      vyuctovani: { select: { etapaId: true } },
      _count: { select: { predavaky: { where: { etapaId: null } } } },
      objednavky: { where: { stav: { in: ['NAVRH', 'ODESLANA', 'CASTECNE_DORUCENA'] } }, select: { id: true } },
      techniciRel: { orderBy: { prirazeno: 'asc' }, select: { technik: { select: { id: true, jmeno: true } } } },
      etapy: {
        orderBy: { cislo: 'asc' as const },
        include: {
          predavaky: { select: { id: true, cislo: true, stav: true } },
          vyuctovani: { select: { id: true, cislo: true, stav: true } },
          technici: { orderBy: { prirazeno: 'asc' }, select: { technik: { select: { id: true, jmeno: true } } } },
        },
        // montazOd + montazDo included via model defaults
      },
    },
  })

  if (!zakazka) notFound()

  // F2: ruční založení zakázky v ABRA Flexi — jen org napojená na Flexi a jen správce
  const abraTlacitko = perms.nastaveniOrg
    && abraKonfigurace()?.orgSlug === session.user.orgSlug
    && CISLO_ZAKAZKY_ABRA.test(zakazka.cislo)

  // Technici organizace pro výběr (hlavička + etapy) — jen pro editaci
  const vsichniTechnici = canEdit
    ? await prisma.user.findMany({
        where: { orgId, aktivni: true, role: { in: ['TECHNIK', 'HLAVNI_TECHNIK'] } },
        select: { id: true, jmeno: true },
        orderBy: { jmeno: 'asc' },
      })
    : []
  const techniciZakazky = zakazka.techniciRel.map(t => t.technik)

  // Stav SOD (přes OP) + ruční papírový podpis
  const sody = zakazka.opId
    ? await prisma.sod.findMany({
        where: { dealId: zakazka.opId, orgId },
        select: { id: true, cislo: true, stav: true, podepsano: true, vytvoreno: true },
      })
    : []
  const sodStav = sodStavZakazky(sody, zakazka.sodPapirovePodepsano)

  // Polozky stats for progress bar
  const polozkyTotal = zakazka.polozky.length
  const polozkyStats = { CEKA: 0, OBJEDNANO: 0, NASKLADNENO: 0, VYDANO: 0 }
  zakazka.polozky.forEach(p => { polozkyStats[p.stav as keyof typeof polozkyStats]++ })
  const polozkyReady = polozkyStats.NASKLADNENO + polozkyStats.VYDANO

  // Finance: v hlavičce jen jednořádkový souhrn, detail je v záložce Finance
  const showFinanceTab = perms.financeProdejni || showNakupky
  const fin = showFinanceTab ? await zakazkaFinance(zakazka.id, orgId) : null
  const finSouhrn: string[] = []
  if (fin && perms.financeProdejni) {
    if (fin.cenaOP !== null) finSouhrn.push(`${formatKc(fin.cenaOP)} dle OP`)
    if (fin.pocetVyuctovani > 0) {
      finSouhrn.push(fin.cenaOP
        ? `vyúčtováno ${Math.round(fin.vyuctovanoSchvaleno / fin.cenaOP * 100)} %`
        : `vyúčtováno ${formatKc(fin.vyuctovanoSchvaleno)}`)
    }
  }
  if (fin && showNakupky && fin.cnMarzeProc !== null) finSouhrn.push(`marže ${String(fin.cnMarzeProc).replace('.', ',')} %`)

  const adresa = [zakazka.klient.ulice, [zakazka.klient.mesto, zakazka.klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  // „Sadová 14, 702 00 Ostrava“ = „Sadová 14, Ostrava 702 00“ — porovnání bez ohledu na pořadí a interpunkci
  const slovaAdresy = (a: string) => a.toLowerCase().replace(/[\s,.;]+/g, ' ').trim().split(' ').sort().join(' ')
  const stejnaAdresa = (a: string, b: string) => slovaAdresy(a) === slovaAdresy(b)

  // Souhrn termínu pro sbalenou mobilní hlavičku
  const dm = (d: Date) => `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`
  const terminText = zakazka.montazOd
    ? (zakazka.montazDo && zakazka.montazDo.getTime() !== zakazka.montazOd.getTime()
        ? `${dm(zakazka.montazOd)} – ${dm(zakazka.montazDo)}`
        : dm(zakazka.montazOd))
    : zakazka.kdykoliv ? 'Kdykoliv' : 'Bez termínu'

  return (
    <SbalitelnyDetail>
    {/* pb na mobilu: plovoucí tlačítko poznámky nesmí zakrýt poslední řádky */}
    <div className="space-y-4 pb-16 md:pb-0">
      {/* Header — na mobilu sbalený (MobilniHlavicka), na desktopu celý */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 pt-4 sm:px-5 sm:py-5">
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
                <JenPlnaHlavicka>
                  <TitulniFotoUpload
                    zakazkaId={zakazka.id}
                    titulniFotoUrl={zakazka.titulniFotoUrl ?? null}
                    canEdit={canEdit}
                    canTechnikUpload={true}
                  />
                </JenPlnaHlavicka>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xl font-bold text-green-600 dark:text-green-400">{zakazka.cislo}</span>
                    <CopyLinkButton />
                    {zakazka.technologie && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                        {techLabels[zakazka.technologie as keyof typeof techLabels] ?? zakazka.technologie}
                      </span>
                    )}
                    {zakazka.typ === 'OBCHODNI' && (
                      <SodStavBadge
                        zakazkaId={zakazka.id}
                        kod={sodStav.kod}
                        label={sodStav.label}
                        sodCislo={sodStav.sod?.cislo ?? null}
                        datum={sodStav.datum?.toISOString() ?? null}
                        papirove={zakazka.sodPapirovePodepsano
                          ? { datum: zakazka.sodPapirovePodepsano.toISOString(), kdo: zakazka.sodPapirovePodepsalJmeno ?? null }
                          : null}
                        opHref={zakazka.opId && perms.obchod ? `/deals/${zakazka.opId}?tab=smlouvy` : null}
                        canEdit={canEdit}
                      />
                    )}
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{zakazka.nazev}</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    <Link href={`/clients/${zakazka.klient.id}`} className="hover:text-blue-600 hover:underline font-medium">
                      {zakazka.klient.jmeno} {zakazka.klient.prijmeni}
                    </Link>
                  </p>
                  <p className="sm:hidden text-sm text-gray-600 dark:text-slate-300">
                    {terminText} · {zakazkaStavLabels[zakazka.stav]}
                  </p>
                </div>
              </div>

              <RychleAkce zakazkaId={zakazka.id} adresa={zakazka.mistoStavby || adresa} telefon={zakazka.klient.telefon ?? null} />

              <SbalitelnaCast desktop="contents" openClassName="grid grid-cols-1 gap-4">

              {/* Sloupec 2: termín + místo instalace */}
              <div className="min-w-0 space-y-3 sm:border-l sm:border-r border-gray-100 dark:border-slate-700 sm:px-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Termín montáže</p>
                  <MontazDatePicker
                    zakazkaId={zakazka.id}
                    montazOd={zakazka.montazOd?.toISOString() ?? null}
                    montazDo={zakazka.montazDo?.toISOString() ?? null}
                    canEdit={canEdit}
                    technikIds={techniciZakazky.map(t => t.id)}
                    etapy={zakazka.etapy.map(e => ({
                      id: e.id,
                      cislo: e.cislo,
                      nazev: e.nazev ?? null,
                      montazOd: e.montazOd?.toISOString() ?? null,
                      montazDo: e.montazDo?.toISOString() ?? null,
                      technikIds: e.technici.map(t => t.technik.id),
                    }))}
                  />
                  <div className="mt-1.5">
                    <KdykolivToggle zakazkaId={zakazka.id} kdykoliv={zakazka.kdykoliv} canEdit={canEdit} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">
                    Technici{zakazka.etapy.length > 0 && <span className="normal-case font-normal"> · celá zakázka</span>}
                  </p>
                  <ZakazkaTechnici
                    key={techniciZakazky.map(t => t.id).join(',')}
                    zakazkaId={zakazka.id}
                    technici={techniciZakazky}
                    hlavniId={zakazka.hlavniTechnikId}
                    vsichni={vsichniTechnici}
                    canEdit={canEdit}
                    maEtapy={zakazka.etapy.length > 0}
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
                  {/* adresa klienta jen když je místo instalace jinde — jinak by byla 2× vedle sebe */}
                  {adresa && zakazka.mistoStavby?.trim() && !stejnaAdresa(zakazka.mistoStavby, adresa) && <NavigateButton adresa={adresa} label="Adresa klienta" size="xs" />}
                  {!zakazka.klient.telefon && !zakazka.klient.email && (
                    <span className="text-sm text-gray-400 dark:text-slate-500 italic">neuvedeno</span>
                  )}
                </div>
              </div>
              </SbalitelnaCast>
            </div>

            {/* Right actions */}
            {(perms.zakazkyMazani || perms.servisDispecink || abraTlacitko) && (
              <SbalitelnaCast>
                <div className="flex flex-wrap items-center gap-2">
                {abraTlacitko && (
                  <AbraZakazkaTlacitko
                    zakazkaId={zakazka.id}
                    odeslano={zakazka.abraOdeslano?.toISOString() ?? null}
                    abraId={zakazka.abraZakazkaId}
                  />
                )}
                <ZakazkaDetailHeader
                  zakazkaId={zakazka.id}
                  stav={zakazka.stav}
                  opId={zakazka.opId ?? null}
                  canDelete={perms.zakazkyMazani}
                  canServis={perms.servisDispecink}
                  hasServiceModule={getPlanLimits(session!.user.plan as string).hasServiceModule}
                />
                </div>
              </SbalitelnaCast>
            )}
          </div>

          {/* Položky progress + souhrn financí */}
          {(polozkyTotal > 0 || finSouhrn.length > 0) && (
            <SbalitelnaCast>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {polozkyTotal > 0 && (<>
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
              {perms.sklad !== 'ZADNY' && zakazka.objednavky.length > 0 && (
                <Link href={`/zakazky/${zakazka.id}?tab=polozky#objednavky`} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:underline whitespace-nowrap">
                  {zakazka.objednavky.length} {zakazka.objednavky.length === 1 ? 'otevřená objednávka' : zakazka.objednavky.length < 5 ? 'otevřené objednávky' : 'otevřených objednávek'}
                </Link>
              )}
              </>)}
              {finSouhrn.length > 0 && (
                <Link href={`/zakazky/${zakazka.id}?tab=finance`} className="sm:ml-auto text-xs text-gray-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary-light whitespace-nowrap">
                  {finSouhrn.join(' · ')} <span aria-hidden>→</span>
                </Link>
              )}
            </div>
            </SbalitelnaCast>
          )}
        </div>
        <SbalitPrepinac />
      </div>

      {/* Pipeline, etapy a finance — na mobilu pod „Detail zakázky" */}
      <SbalitelnaCast className="space-y-4">
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
          hlavniTechnikId: e.hlavniTechnikId,
          predavaky: e.predavaky,
          vyuctovani: e.vyuctovani,
          technici: e.technici.map(t => t.technik),
        }))}
        vsichniTechnici={vsichniTechnici}
        canEdit={canEdit}
        canDelete={perms.zakazkyMazani}
        maPraciBezEtapy={zakazka._count.predavaky > 0 || zakazka.vyuctovani.some(v => !v.etapaId)}
      />

      </SbalitelnaCast>

      {/* Tab bar — always visible, active tab determined from URL */}
      <Suspense fallback={<div className="border-b border-gray-200 dark:border-slate-700 h-10" />}>
        <ZakazkyTabs zakazkaId={zakazka.id} defaultTab={vychoziZakazkaTab(isTechnik)} showHistorie={canEdit} showFinance={showFinanceTab} />
      </Suspense>

      {/* Page content */}
      {children}

      {/* Floating quick-note button (mobile) */}
      <RychlaPoznamka zakazkaId={zakazka.id} />
    </div>
    </SbalitelnyDetail>
  )
}
