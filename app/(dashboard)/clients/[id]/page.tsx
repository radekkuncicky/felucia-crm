import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ClientEditForm from './ClientEditForm'
import ClientHistory from './ClientHistory'

import { stavLabels, stavColors, techLabels, techColors } from '@/lib/constants'
import TabActivator from './TabActivator'
import { NavigateButton } from '@/components/NavigateButton'
import { formatKc } from '@/lib/format'

const ZAKAZKA_STAV_LABELS: Record<string, string> = {
  NOVA: 'Nová',
  PRIRAZENA: 'Přiřazena',
  V_REALIZACI: 'V realizaci',
  PREDANA: 'Předána',
  VYUCTOVANA: 'Vyúčtována',
  HOTOVO: 'Hotovo',
}

const ZAKAZKA_STAV_COLORS: Record<string, string> = {
  NOVA: 'bg-gray-100 text-gray-600',
  PRIRAZENA: 'bg-blue-50 text-blue-700',
  V_REALIZACI: 'bg-orange-50 text-orange-700',
  PREDANA: 'bg-purple-50 text-purple-700',
  VYUCTOVANA: 'bg-yellow-50 text-yellow-700',
  HOTOVO: 'bg-green-50 text-green-700',
}

const fmtKc = formatKc

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const tab = searchParams.tab ?? 'info'

  const client = await prisma.client.findFirst({
    where: { id: params.id, orgId },
    include: {
      deals: {
        include: {
          user: true,
          activities: { orderBy: { datum: 'desc' } },
          quotes: { where: { aktivni: true } },
        },
        orderBy: { vytvoreno: 'desc' },
      },
      zakazky: {
        orderBy: { vytvoreno: 'desc' },
        include: {
          polozky: { select: { prodejniCena: true, nakupniCena: true, mnozstvi: true } },
          vyuctovani: {
            where: { stav: 'SCHVALENO' },
            include: { polozky: { select: { prodejniCena: true, mnozstvi: true } } },
          },
          skladPohyby: {
            where: { typ: 'VYDEJ' },
            select: { nakupniCena: true, mnozstvi: true },
          },
        },
      },
    },
  })

  if (!client) notFound()

  // ─── Finanční agregáty zakázek ────────────────────────────────────────────
  let celkovaHodnota = 0
  let fakturovano = 0
  let vydanyMaterial = 0
  const stavCounts: Record<string, number> = {}

  for (const z of client.zakazky) {
    stavCounts[z.stav] = (stavCounts[z.stav] ?? 0) + 1
    for (const p of z.polozky) {
      if (p.prodejniCena != null) celkovaHodnota += Number(p.prodejniCena) * Number(p.mnozstvi)
    }
    for (const v of z.vyuctovani) {
      for (const p of v.polozky) {
        fakturovano += Number(p.prodejniCena) * Number(p.mnozstvi)
      }
    }
    for (const s of z.skladPohyby) {
      if (s.nakupniCena != null) vydanyMaterial += Number(s.nakupniCena) * Number(s.mnozstvi)
    }
  }
  const zbyvaDofakturovat = Math.max(0, celkovaHodnota - fakturovano)

  // Build history feed
  type HistoryItem = {
    date: Date
    type: 'deal_create' | 'deal_status' | 'activity'
    label: string
    sub: string
    href: string
    icon: string
  }

  const history: HistoryItem[] = []

  for (const deal of client.deals) {
    history.push({
      date: deal.vytvoreno,
      type: 'deal_create',
      label: deal.predmet ?? 'Nový obchodní případ',
      sub: `${deal.kod ?? ''} · Vytvořen · ${stavLabels[deal.stav]}`,
      href: `/deals/${deal.id}`,
      icon: '📋',
    })
    for (const act of deal.activities) {
      const typIcons: Record<string, string> = { HOVOR: '📞', EMAIL: '✉️', SCHUZKA: '🤝', POZNAMKA: '📝', UKOL: '✅' }
      history.push({
        date: act.datum,
        type: 'activity',
        label: act.popis ?? act.typ,
        sub: `${deal.predmet ?? deal.kod ?? 'OP'} · ${act.typ}`,
        href: `/deals/${deal.id}?tab=aktivity`,
        icon: typIcons[act.typ] ?? '•',
      })
    }
  }

  history.sort((a, b) => b.date.getTime() - a.date.getTime())

  const tabs = [
    { key: 'info', label: 'Informace' },
    { key: 'pripady', label: `Obchodní případy (${client.deals.length})` },
    { key: 'zakazky', label: `Zakázky (${client.zakazky.length})` },
    { key: 'historie', label: 'Historie' },
  ]

  return (
    <div className="space-y-4">
      <TabActivator id={client.id} nazev={`${client.jmeno} ${client.prijmeni}`.trim()} />
      <div className="flex items-center gap-3">
        <Link href="/clients" className="text-gray-400 hover:text-gray-600 text-sm">← Klienti</Link>
        <h1 className="text-2xl font-bold text-gray-900">{client.jmeno} {client.prijmeni}</h1>
        {client.typKlienta === 'FIRMA' && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Firma</span>
        )}
        <Link href={`/deals/new?clientId=${client.id}`} className="ml-auto bg-primary hover:bg-primary-hover text-white font-medium px-3 py-1.5 rounded-lg text-sm">
          + Nový případ
        </Link>
      </div>

      {/* Finanční souhrn klienta */}
      {client.zakazky.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Hodnota zakázek</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtKc(celkovaHodnota)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{client.zakazky.length} zakázk{client.zakazky.length === 1 ? 'a' : client.zakazky.length < 5 ? 'y' : ''}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Fakturováno</p>
            <p className="text-xl font-bold text-green-700 mt-0.5">{fmtKc(fakturovano)}</p>
            <p className="text-xs text-gray-400 mt-0.5">schválená vyúčtování</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Zbývá dofakturovat</p>
            <p className={`text-xl font-bold mt-0.5 ${zbyvaDofakturovat > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{fmtKc(zbyvaDofakturovat)}</p>
            <p className="text-xs text-gray-400 mt-0.5">hodnota − fakturováno</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Vydaný materiál</p>
            <p className="text-xl font-bold text-gray-700 mt-0.5">{fmtKc(vydanyMaterial)}</p>
            <p className="text-xs text-gray-400 mt-0.5">nákupní cena, výdeje ze skladu</p>
          </div>
        </div>
      )}

      {/* Stavy zakázek */}
      {client.zakazky.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stavCounts).map(([stav, count]) => (
            <span key={stav} className={`text-xs font-medium px-2.5 py-1 rounded-full ${ZAKAZKA_STAV_COLORS[stav] ?? 'bg-gray-100 text-gray-600'}`}>
              {ZAKAZKA_STAV_LABELS[stav] ?? stav} · {count}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map(t => (
            <Link
              key={t.key}
              href={`/clients/${client.id}?tab=${t.key}`}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === 'info' && (
        <div className="max-w-md space-y-4">
          <ClientEditForm client={{
              id: client.id,
              typKlienta: client.typKlienta as 'FYZICKA_OSOBA' | 'FIRMA',
              jmeno: client.jmeno,
              prijmeni: client.prijmeni,
              telefon: client.telefon ?? '',
              email: client.email ?? '',
              ulice: client.ulice ?? '',
              mesto: client.mesto ?? '',
              psc: client.psc ?? '',
              ico: client.ico ?? '',
              dic: client.dic ?? '',
              poznamka: client.poznamka ?? '',
              anonymizedAt: client.anonymizedAt ? client.anonymizedAt.toISOString() : null,
            }} isAdmin={session!.user.role === 'ADMIN' || !!session!.user.isSuperAdmin} />
          {(client.ulice || client.mesto) && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Navigace</p>
              <NavigateButton
                adresa={[client.ulice, [client.mesto, client.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'pripady' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Kód</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Předmět</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Technologie</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Stav</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Obchodník</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {client.deals.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">Žádné obchodní případy.</td></tr>
              )}
              {client.deals.map(deal => (
                <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{deal.kod ?? '—'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{deal.predmet ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{techLabels[deal.technologie]}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${stavColors[deal.stav]}`}>{stavLabels[deal.stav]}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{deal.user?.jmeno ?? '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/deals/${deal.id}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Detail →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'zakazky' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Číslo</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Název</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Technologie</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Stav</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-6 py-3">Hodnota</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-6 py-3">Fakturováno</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {client.zakazky.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400">Žádné zakázky.</td></tr>
              )}
              {client.zakazky.map(z => {
                const hodnota = z.polozky.reduce((s, p) => s + (p.prodejniCena ? Number(p.prodejniCena) * Number(p.mnozstvi) : 0), 0)
                const fakt = z.vyuctovani.reduce((s, v) => s + v.polozky.reduce((ss, p) => ss + Number(p.prodejniCena) * Number(p.mnozstvi), 0), 0)
                return (
                  <tr key={z.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{z.cislo}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{z.nazev}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {z.technologie ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${techColors[z.technologie as keyof typeof techColors] ?? 'bg-gray-100 text-gray-600'}`}>
                          {techLabels[z.technologie as keyof typeof techLabels] ?? z.technologie}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ZAKAZKA_STAV_COLORS[z.stav] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ZAKAZKA_STAV_LABELS[z.stav] ?? z.stav}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium tabular-nums">{hodnota > 0 ? fmtKc(hodnota) : '—'}</td>
                    <td className="px-6 py-4 text-sm text-right tabular-nums">
                      <span className={fakt > 0 ? 'text-green-700 font-medium' : 'text-gray-400'}>{fakt > 0 ? fmtKc(fakt) : '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/zakazky/${z.id}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Detail →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'historie' && (
        <ClientHistory history={history.map(h => ({ ...h, date: h.date.toISOString() }))} />
      )}
    </div>
  )
}
