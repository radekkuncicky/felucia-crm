import { prisma } from '@/lib/prisma'
import { dealScopeWhere, resolvePermissions, servisScopeWhere } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { verifyCalendarToken } from '@/lib/calendarToken'
import {
  AKTIVITA_DOPLNEK, DOPLNEK, SERVIS_DOPLNEK, calendarTitle, dateRange, klientJmeno, servisTechnologie, technologieLabel, utcDateStr,
} from '@/lib/calendarEvents'

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function foldLine(line: string): string {
  if (line.length <= 75) return line
  let result = ''
  while (line.length > 75) {
    result += line.slice(0, 75) + '\r\n '
    line = line.slice(75)
  }
  return result + line
}

function formatIcalDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function addDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return formatIcalDate(d)
}

/**
 * Celodenní událost; `dateTo` (včetně) u vícedenních akcí → DTEND je den po konci
 * (v iCal je DTEND exkluzivní).
 */
function vevent(uid: string, dateStr: string, summary: string, description: string, url: string, location?: string, dateTo?: string): string {
  const lines = [
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}@felucia`),
    `DTSTART;VALUE=DATE:${dateStr.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${addDay(dateTo && dateTo > dateStr ? dateTo : dateStr)}`,
    foldLine(`SUMMARY:${escapeIcal(summary)}`),
    foldLine(`DESCRIPTION:${escapeIcal(description)}`),
    foldLine(`URL:${url}`),
  ]
  if (location) lines.push(foldLine(`LOCATION:${escapeIcal(location)}`))
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')
  const sig = searchParams.get('sig')

  if (!uid || !sig) return new Response('Missing params', { status: 400 })

  // lookup uživatele před znalostí org — záměrně bez tenant scope
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: {
      id: true, orgId: true, jmeno: true, aktivni: true, role: true, permissions: true, calendarTokenVersion: true,
      organization: { select: { nazev: true, aktivni: true, plan: true } },
    },
  })
  if (!user) return new Response('Unauthorized', { status: 401 })

  let valid = false
  try { valid = verifyCalendarToken(uid, user.calendarTokenVersion, sig) } catch { valid = false }
  if (!valid) return new Response('Unauthorized', { status: 401 })
  // Deaktivovaný uživatel / org: odkaz v kalendáři přestane fungovat
  if (!user.aktivni || !user.organization.aktivni) return new Response('Unauthorized', { status: 401 })

  // Stejný rozsah jako v UI — technik nedostane OP celé org, obchodník bez obchodCiziOP jen vlastní
  const perms = resolvePermissions(user.role, user.permissions, user.organization.plan)
  const dealScope = dealScopeWhere(perms, uid)
  const servisScope = servisScopeWhere(perms, uid)

  const orgId = user.orgId
  const db = orgPrisma(orgId)
  const host = req.headers.get('host') ?? 'app.felucia.io'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const base = `${proto}://${host}`

  const [activities, deals, servisNavstevy, montazZakazky] = await Promise.all([
    db.activity.findMany({
      where: {
        deal: { orgId },
        OR: [{ userId: uid }, { resitelId: uid }],
      },
      include: {
        deal: {
          select: {
            id: true,
            predmet: true,
            kod: true,
            technologie: true,
            client: { select: { jmeno: true, prijmeni: true, telefon: true, email: true } },
          },
        },
      },
      orderBy: { datum: 'asc' },
    }),
    dealScope === null ? Promise.resolve([]) : db.deal.findMany({
      where: {
        orgId,
        ...dealScope,
        OR: [
          { terminRealizace: { not: null } },
          { terminPrevzeti: { not: null } },
          { splatnostZalohy: { not: null } },
        ],
      },
      include: { client: { select: { jmeno: true, prijmeni: true } } },
    }),
    servisScope === null ? Promise.resolve([]) : db.servisniZakazka.findMany({
      where: { orgId, ...servisScope, stav: { in: ['NAPLANOVANA', 'PROBIHA'] }, planovanyTermin: { not: null } },
      include: {
        kontrakt: { select: { nazev: true, klient: { select: { jmeno: true, prijmeni: true } }, zarizeni: { select: { nazev: true, typ: true } } } },
        klient: { select: { jmeno: true, prijmeni: true } },
        zarizeni: { select: { nazev: true, typ: true } },
        technik: { select: { jmeno: true } },
      },
    }),
    // Montáže, na které je uživatel přiřazen jako technik
    db.zakazka.findMany({
      where: {
        orgId,
        techniciRel: { some: { technikId: uid } },
        OR: [
          { montazOd: { not: null } },
          { etapy: { some: { montazOd: { not: null } } } },
        ],
      },
      include: {
        klient: { select: { jmeno: true, prijmeni: true } },
        techniciRel: { include: { technik: { select: { jmeno: true } } } },
        etapy: { where: { montazOd: { not: null } }, orderBy: { cislo: 'asc' } },
      },
    }),
  ])

  const vevents: string[] = []

  for (const a of activities) {
    const dateStr = utcDateStr(a.datum)
    const c = a.deal.client
    const klient = klientJmeno(c)
    const dealName = a.deal.predmet ?? a.deal.kod ?? ''

    // Summary: "Jan Novák – Klimatizace – hovor"
    const summary = calendarTitle(klient, technologieLabel(a.deal.technologie), AKTIVITA_DOPLNEK[a.typ] ?? a.typ.toLowerCase())

    // Build description lines
    const descLines: string[] = []

    // Contact info by type
    if (a.typ === 'HOVOR' && c.telefon) descLines.push(`📞 ${c.telefon}`)
    if (a.typ === 'EMAIL' && c.email)   descLines.push(`✉️ ${c.email}`)
    if (a.typ === 'SCHUZKA' && a.misto) descLines.push(`📍 ${a.misto}`)

    if (dealName) descLines.push(`Případ: ${dealName}`)
    if (a.popis)  descLines.push(a.popis)
    if (a.cil)    descLines.push(`Cíl: ${a.cil}`)
    if (a.vysledek) descLines.push(`Výsledek: ${a.vysledek}`)

    const description = descLines.join('\n')
    const location = a.typ === 'SCHUZKA' ? (a.misto ?? undefined) : undefined

    vevents.push(vevent(`act-${a.id}`, dateStr, summary, description, `${base}/deals/${a.deal.id}?tab=aktivity`, location))
  }

  for (const d of deals) {
    const klient = klientJmeno(d.client)
    const tech = technologieLabel(d.technologie)
    const predmet = d.predmet ?? d.kod ?? ''
    const desc = [`Klient: ${klient}`, predmet ? `Případ: ${predmet}` : ''].filter(Boolean).join('\n')
    if (d.terminRealizace) {
      // Realizace od termínu realizace do termínu převzetí (pokud je pozdější) → vícedenní událost
      const konec = d.terminPrevzeti && d.terminPrevzeti > d.terminRealizace ? d.terminPrevzeti : null
      const r = dateRange(d.terminRealizace, konec)
      vevents.push(vevent(`deal-rea-${d.id}`, r.date, calendarTitle(klient, tech, DOPLNEK.REALIZACE), desc, `${base}/deals/${d.id}`, undefined, r.dateTo))
    }
    if (d.terminPrevzeti) {
      vevents.push(vevent(`deal-pre-${d.id}`, utcDateStr(d.terminPrevzeti), calendarTitle(klient, tech, DOPLNEK.PREVZETI), desc, `${base}/deals/${d.id}`))
    }
    if (d.splatnostZalohy) {
      vevents.push(vevent(`deal-zal-${d.id}`, utcDateStr(d.splatnostZalohy), calendarTitle(klient, tech, DOPLNEK.ZALOHA), desc, `${base}/deals/${d.id}`))
    }
  }

  for (const n of servisNavstevy) {
    if (!n.planovanyTermin) continue
    const klient = klientJmeno(n.kontrakt?.klient ?? n.klient)
    const tech = servisTechnologie(n.zarizeni ?? n.kontrakt?.zarizeni)
    const desc = [
      `Klient: ${klient}`,
      n.cislo ? `Servisní zakázka: ${n.cislo}` : '',
      n.kontrakt?.nazev ? `Kontrakt: ${n.kontrakt.nazev}` : '',
      n.zarizeni?.nazev ? `Zařízení: ${n.zarizeni.nazev}` : '',
      n.technik ? `Technik: ${n.technik.jmeno}` : '',
    ].filter(Boolean).join('\n')
    vevents.push(vevent(
      `servis-${n.id}`,
      utcDateStr(n.planovanyTermin),
      calendarTitle(klient, tech, SERVIS_DOPLNEK[n.typ] ?? DOPLNEK.SERVIS),
      desc,
      `${base}/servis/zakazky/${n.id}`,
    ))
  }

  for (const z of montazZakazky) {
    const klient = klientJmeno(z.klient)
    const tech = technologieLabel(z.technologie) || z.nazev
    const technici = z.techniciRel.map(t => t.technik.jmeno)
    const desc = [`Klient: ${klient}`, `Zakázka: ${z.cislo}`, technici.length ? `Technici: ${technici.join(', ')}` : ''].filter(Boolean).join('\n')
    const url = `${base}/zakazky/${z.id}`
    const etapy = z.etapy.filter(e => e.montazOd)
    if (etapy.length >= 2 || (etapy.length === 1 && !z.montazOd)) {
      for (const e of etapy) {
        const etapaLabel = e.nazev ? `${e.cislo}. etapa – ${e.nazev}` : `${e.cislo}. etapa`
        const r = dateRange(e.montazOd!, e.montazDo)
        vevents.push(vevent(`montaz-${z.id}-etapa-${e.id}`, r.date, calendarTitle(klient, tech, `${DOPLNEK.MONTAZ}, ${etapaLabel}`), desc, url, undefined, r.dateTo))
      }
      continue
    }
    if (!z.montazOd) continue
    const r = dateRange(z.montazOd, z.montazDo)
    vevents.push(vevent(`montaz-${z.id}`, r.date, calendarTitle(klient, tech, DOPLNEK.MONTAZ), desc, url, undefined, r.dateTo))
  }

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Felucia CRM//CS`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Felucia — ${user.jmeno} (${user.organization.nazev})`,
    'X-WR-TIMEZONE:Europe/Prague',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="felucia.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
