import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { techLabels, zakazkaStavLabels } from '@/lib/constants'
import DealTabs from './DealTabs'
import DealEditForm from './DealEditForm'
import DealStatusBadge from './DealStatusBadge'
import ActivitiesSection from './ActivitiesSection'
import DealActions from './DealActions'
import NabidkyTab from './NabidkyTab'
import DokumentyTab from './DokumentyTab'
import SmlouvyTab from './SmlouvyTab'
import FotodokumentaceTab from './FotodokumentaceTab'
import TabActivator from './TabActivator'
import ServisTab from './ServisTab'
import { getPlanLimits } from '@/lib/planLimits'
import { NavigateButton } from '@/components/NavigateButton'
import { CollapsibleEdit } from './CollapsibleEdit'
import { DealNotesCard } from './DealNotesCard'

function fmt(d: Date | null) {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

type TemplateItem = { product_id?: string; nazev: string; mnozstvi: number; cena_za_kus: number; poznamky?: string }

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const tab = searchParams.tab ?? 'prehled'

  const isPlatinum = getPlanLimits(session!.user.plan).hasServiceModule

  const [deal, products, quoteTemplates, orgUsers, servisKontrakty, orgSettings, dealZarizeni, renderTemplates] = await Promise.all([
    prisma.deal.findFirst({
      where: { id: params.id, orgId },
      include: {
        client: true,
        user: true,
        organization: true,
        quotes: {
          include: { items: { include: { product: true }, orderBy: { id: 'asc' } } },
          orderBy: { vytvoreno: 'asc' },
        },
        activities: { include: { user: true, resitel: true }, orderBy: { datum: 'desc' } },
      },
    }),
    prisma.product.findMany({
      where: { orgId, aktivni: true },
      include: { categories: { orderBy: { nazev: 'asc' } } },
      orderBy: { nazev: 'asc' },
    }),
    prisma.quoteTemplate.findMany({ where: { orgId }, orderBy: { nazev: 'asc' } }),
    prisma.user.findMany({ where: { orgId, aktivni: true }, select: { id: true, jmeno: true }, orderBy: { jmeno: 'asc' } }),
    isPlatinum
      ? prisma.servisniKontrakt.findMany({
          where: { dealId: params.id, orgId },
          include: {
            zarizeni: { select: { id: true, nazev: true, typ: true, vyrobniCislo: true, datumInstalace: true, zarukaDo: true } },
            servisniNavstevy: {
              include: { technik: { select: { id: true, jmeno: true } } },
              orderBy: { planovanyTermin: 'asc' },
              take: 20,
            },
          },
        })
      : Promise.resolve([]),
    prisma.orgSettings.findUnique({ where: { orgId } }),
    isPlatinum
      ? prisma.zarizeni.findMany({
          where: { dealId: params.id, orgId },
          select: { id: true, nazev: true, typ: true, vyrobniCislo: true, datumInstalace: true, zarukaDo: true },
        })
      : Promise.resolve([]),
    prisma.quoteTemplate.findMany({
      where: { orgId },
      select: { id: true, nazev: true, typ: true, isDefault: true, isSystem: true },
      orderBy: [{ isDefault: 'desc' }, { nazev: 'asc' }],
    }),
  ])

  if (!deal) notFound()

  // Zneplatněné OP vidí jen admin
  const isAdmin = session!.user.role === 'ADMIN' || session!.user.isSuperAdmin === true
  if (deal.stav === 'ZNEPLATNENO' && !isAdmin) notFound()

  // Zakázka vzniklá z tohoto OP (auto-create při Úspěchu)
  const linkedZakazka = await prisma.zakazka.findFirst({
    where: { opId: deal.id, orgId },
    select: { id: true, cislo: true, stav: true },
  })

  // Calculate active quote price for header
  const activeQuote = deal.quotes.find(q => q.aktivni)
  const konecnaCena = activeQuote
    ? activeQuote.items.reduce(
        (s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100),
        0
      )
    : 0
  const cenaSDph = konecnaCena * (1 + (activeQuote?.dphSazba ?? deal.dphSazba) / 100)

  // Margin calculation — fallback: item.nakupniCena ?? product.nakladovaCena ?? cenaZaKus (0% margin)
  let marzeKc = 0, marzeProc = 0, nakupniTotal = 0, hasNakupni = false
  if (activeQuote && activeQuote.items.length > 0) {
    for (const item of activeQuote.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nakladovaCena = (item as any).nakupniCena != null ? Number((item as any).nakupniCena) : (item.product?.nakladovaCena != null ? Number(item.product.nakladovaCena) : Number(item.cenaZaKus))
      // sleva is a customer discount on sell price — does not affect purchase cost
      const n = nakladovaCena * Number(item.mnozstvi)
      nakupniTotal += n
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((item as any).nakupniCena != null || Number(item.product?.nakladovaCena ?? 0) > 0) hasNakupni = true
    }
    marzeKc = konecnaCena - nakupniTotal
    marzeProc = konecnaCena > 0 ? (marzeKc / konecnaCena) * 100 : 0
  }

  return (
    <div className="space-y-4">
      <TabActivator id={deal.id} kod={deal.kod} technologie={deal.technologie} />
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-slate-500">
              <Link href="/deals" className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors">Obchodní případy</Link>
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <span className="text-gray-600 dark:text-slate-300 font-medium">{deal.kod ?? deal.id.slice(0, 8)}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {deal.kod && (
                <span className="font-mono text-sm font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 rounded">
                  {deal.kod}
                </span>
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                {deal.predmet ?? 'Bez předmětu'}
              </h1>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-1">
              <DealStatusBadge
                dealId={deal.id}
                currentStav={deal.stav}
                plan={session!.user.plan}
                klientId={deal.client.id}
                klientJmeno={`${deal.client.jmeno} ${deal.client.prijmeni}`}
                povinnaAktivitaUOP={orgSettings?.povinnaAktivitaUOP ?? false}
                automatickyServis={orgSettings?.automatickyServis ?? true}
              />
              <span className="text-gray-300 dark:text-slate-600">·</span>
              <span className="text-sm text-gray-500 dark:text-slate-400">{techLabels[deal.technologie]}</span>
              <span className="text-gray-300 dark:text-slate-600">·</span>
              <Link href={`/clients/${deal.client.id}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline">
                {deal.client.jmeno} {deal.client.prijmeni}
              </Link>
              {deal.user && (
                <>
                  <span className="text-gray-300 dark:text-slate-600">·</span>
                  <span className="text-sm text-gray-500 dark:text-slate-400">{deal.user.jmeno}</span>
                </>
              )}
              {linkedZakazka && (
                <Link
                  href={`/zakazky/${linkedZakazka.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-pale dark:bg-green-950/40 text-primary-dark dark:text-primary-light hover:bg-primary/20 dark:hover:bg-green-900/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Zakázka {linkedZakazka.cislo} · {zakazkaStavLabels[linkedZakazka.stav] ?? linkedZakazka.stav}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
            {(deal.client.ulice || deal.client.mesto) && (
              <NavigateButton
                adresa={[deal.client.ulice, [deal.client.mesto, deal.client.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                size="xs"
              />
            )}
          </div>
          <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-3 sm:flex-shrink-0">
            {konecnaCena > 0 ? (
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{konecnaCena.toLocaleString('cs-CZ')} Kč</p>
                <p className="text-sm text-primary dark:text-primary-light">{cenaSDph.toLocaleString('cs-CZ')} Kč s DPH</p>
              </div>
            ) : (
              <div className="text-right">
                <p className="text-sm text-gray-400 dark:text-slate-500 italic">Bez nabídky</p>
              </div>
            )}
            <DealActions
              dealId={deal.id}
              dealData={{
                kod: deal.kod,
                predmet: deal.predmet,
                clientJmeno: `${deal.client.jmeno} ${deal.client.prijmeni}`,
                clientId: deal.client.id,
                adresaDila: deal.adresaDila,
                technologie: deal.technologie,
                hodnotaZalohy: deal.hodnotaZalohy ? String(deal.hodnotaZalohy) : null,
              }}
            />
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <DealTabs
        dealId={deal.id}
        activeTab={tab}
        hasServisKontrakt={servisKontrakty.length > 0}
        plan={session!.user.plan}
      />

      {/* Tab content */}
      {tab === 'prehled' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: notes + collapsible edit form */}
          <div className="space-y-4">
            <DealNotesCard dealId={deal.id} poznamky={deal.poznamky ?? ''} />
            <CollapsibleEdit>
              <DealEditForm
                deal={{
                  id: deal.id,
                  stav: deal.stav,
                  predmet: deal.predmet ?? '',
                  hodnotaZalohy: deal.hodnotaZalohy ? String(deal.hodnotaZalohy) : '',
                  splatnostZalohy: fmt(deal.splatnostZalohy),
                  terminPrevzeti: fmt(deal.terminPrevzeti),
                  terminRealizace: fmt(deal.terminRealizace),
                  cisloSmlouvy: deal.cisloSmlouvy ?? '',
                  adresaDila: deal.adresaDila ?? '',
                  kontaktniOsoba: deal.kontaktniOsoba ?? '',
                  kontaktniTelefon: deal.kontaktniTelefon ?? '',
                  poznamky: deal.poznamky ?? '',
                }}
                aktivniNabidkaCena={cenaSDph > 0 ? cenaSDph : undefined}
              />
            </CollapsibleEdit>
          </div>

          {/* Right: info cards + activity timeline */}
          <div className="space-y-4">
            {/* Info cards row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Kód OP</p>
                <p className="font-mono font-bold text-gray-900 dark:text-white">{deal.kod ?? '—'}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Vytvořen</p>
                <p className="font-medium text-gray-900 dark:text-white">{new Date(deal.vytvoreno).toLocaleDateString('cs-CZ')}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Obchodník</p>
                <p className="font-medium text-gray-900 dark:text-white truncate">{deal.user?.jmeno ?? '—'}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">DPH sazba</p>
                <p className="font-medium text-gray-900 dark:text-white">{deal.dphSazba} %</p>
              </div>
            </div>

            {/* Active quote stats */}
            {activeQuote && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase mb-3">Aktivní nabídka: {activeQuote.nazev}</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{konecnaCena.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Kč bez DPH</p>
                  </div>
                  {hasNakupni ? (
                    <>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                        <p className="text-lg font-bold text-gray-600 dark:text-slate-300">{nakupniTotal.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Kč náklady</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                        <p className={`text-lg font-bold ${marzeProc >= 30 ? 'text-green-600 dark:text-green-400' : marzeProc >= 15 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                          {marzeProc.toFixed(1)} %
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          {marzeKc.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč marže
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{(cenaSDph / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} tis</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Kč s DPH</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 flex flex-col items-center justify-center">
                        <Link href="/products" className="text-xs text-orange-500 dark:text-orange-400 hover:underline text-center leading-tight">
                          Doplňte nákupní ceny pro zobrazení marže
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Důvod prohry */}
            {deal.stav === 'PAS' && deal.duvodProhry && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase mb-1">Důvod prohry</p>
                <p className="text-sm text-red-800 dark:text-red-300">{deal.duvodProhry}</p>
              </div>
            )}

            {/* Recent activities timeline */}
            {deal.activities.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Poslední aktivity</h3>
                <div className="space-y-2">
                  {deal.activities.slice(0, 5).map(a => {
                    const icons: Record<string, string> = { HOVOR: '📞', EMAIL: '✉️', SCHUZKA: '🤝', POZNAMKA: '📝', UKOL: '✅' }
                    return (
                      <div key={a.id} className="flex items-start gap-2.5">
                        <span className="text-base flex-shrink-0 mt-0.5">{icons[a.typ] ?? '•'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-700 dark:text-slate-300 truncate">{a.popis}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(a.datum).toLocaleDateString('cs-CZ')}{a.user ? ` · ${a.user.jmeno}` : ''}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {deal.activities.length > 5 && (
                  <Link href={`/deals/${deal.id}?tab=aktivity`} className="text-xs text-blue-600 hover:underline mt-3 inline-block">
                    Zobrazit všechny ({deal.activities.length}) →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'nabidky' && (
        <NabidkyTab
          dealId={deal.id}
          dealKod={deal.kod}
          dphSazba={deal.dphSazba}
          quotes={deal.quotes.map(q => ({
            id: q.id,
            kod: q.kod ?? null,
            nazev: q.nazev,
            popis: q.popis ?? '',
            dphSazba: q.dphSazba,
            aktivni: q.aktivni,
            templateId: q.templateId ?? null,
            vytvoreno: q.vytvoreno.toISOString(),
            items: q.items.map(i => ({
              id: i.id,
              kod: i.kod ?? null,
              nazev: i.nazev,
              mnozstvi: Number(i.mnozstvi),
              jednotka: i.jednotka ?? 'ks',
              cenaZaKus: Number(i.cenaZaKus),
              sleva: Number(i.sleva ?? 0),
              dphSazba: Number(i.dphSazba ?? 12),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nakupniCena: (i as any).nakupniCena != null ? Number((i as any).nakupniCena) : null,
              poznamky: i.poznamky ?? null,
              productId: i.productId ?? null,
              poradi: i.poradi ?? 0,
            })),
          }))}
          products={products.map(p => ({
            id: p.id,
            nazev: p.nazev,
            cena: Number(p.standardniCena),
            nakladovaCena: p.nakladovaCena !== null ? Number(p.nakladovaCena) : null,
            kategorie: p.categories[0]?.nazev ?? null,
            categoryId: p.categories[0]?.id ?? null,
            jednotka: p.jednotka,
            categoryNazev: p.categories[0]?.nazev,
          }))}
          templates={quoteTemplates.map(t => ({
            id: t.id,
            nazev: t.nazev,
            polozky: t.polozky as TemplateItem[],
          }))}
          renderTemplates={renderTemplates}
          userRole={session!.user.role}
        />
      )}

      {tab === 'smlouvy' && (
        <SmlouvyTab
          dealId={deal.id}
          role={session!.user.role}
        />
      )}

      {tab === 'aktivity' && (
        <ActivitiesSection
          dealId={deal.id}
          activities={deal.activities.map(a => ({
            id: a.id,
            typ: a.typ,
            popis: a.popis,
            datum: new Date(a.datum).toISOString().split('T')[0],
            cas: a.cas ?? null,
            trvaniMin: a.trvaniMin ?? null,
            splneno: a.splneno,
            stav: a.stav as 'PLANOVANA' | 'DOKONCENA' | 'ZRUSENA',
            userJmeno: a.user?.jmeno ?? '',
            cil: a.cil ?? null,
            vysledek: a.vysledek ?? null,
            misto: a.misto ?? null,
            resitelJmeno: a.resitel?.jmeno ?? null,
            resitelId: a.resitelId ?? null,
          }))}
          users={orgUsers.map(u => ({ id: u.id, jmeno: u.jmeno }))}
          currentUserId={session!.user.id}
          currentUserJmeno={session!.user.jmeno}
        />
      )}

      {tab === 'dokumenty' && (
        <DokumentyTab dealKod={deal.kod} />
      )}

      {tab === 'fotodokumentace' && (
        <FotodokumentaceTab dealId={deal.id} />
      )}

      {tab === 'servis' && isPlatinum && (
        <ServisTab
          zarizeni={dealZarizeni.map(z => ({
            ...z,
            datumInstalace: z.datumInstalace ? z.datumInstalace.toISOString() : null,
            zarukaDo: z.zarukaDo ? z.zarukaDo.toISOString() : null,
          }))}
          kontrakty={servisKontrakty.map(k => ({
            id: k.id,
            nazev: k.nazev,
            typ: k.typ,
            intervalMesicu: k.intervalMesicu,
            cena: k.cena ? String(k.cena) : null,
            zacatek: k.zacatek.toISOString(),
            konec: k.konec ? k.konec.toISOString() : null,
            aktivni: k.aktivni,
            zarizeni: k.zarizeni ? {
              ...k.zarizeni,
              datumInstalace: k.zarizeni.datumInstalace ? k.zarizeni.datumInstalace.toISOString() : null,
              zarukaDo: k.zarizeni.zarukaDo ? k.zarizeni.zarukaDo.toISOString() : null,
            } : null,
            servisniNavstevy: k.servisniNavstevy.map(n => ({
              id: n.id,
              cisloNavstevy: n.cisloNavstevy ?? null,
              typ: n.typ,
              planovanyTermin: n.planovanyTermin.toISOString(),
              skutecnyTermin: n.skutecnyTermin ? n.skutecnyTermin.toISOString() : null,
              stav: n.stav,
              zprava: n.zprava ?? null,
              nalezeneZavady: n.nalezeneZavady ?? null,
              trvaniMinut: n.trvaniMinut ?? null,
              technik: n.technik ?? null,
            })),
          }))}
          orgUsers={orgUsers}
          dealId={params.id}
        />
      )}
    </div>
  )
}
