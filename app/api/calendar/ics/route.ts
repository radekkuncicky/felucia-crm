import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'
import { verifyCalendarToken } from '@/lib/calendarToken'

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

function vevent(uid: string, dateStr: string, summary: string, description: string, url: string, location?: string): string {
  const lines = [
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}@felucia`),
    `DTSTART;VALUE=DATE:${dateStr.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${addDay(dateStr)}`,
    foldLine(`SUMMARY:${escapeIcal(summary)}`),
    foldLine(`DESCRIPTION:${escapeIcal(description)}`),
    foldLine(`URL:${url}`),
  ]
  if (location) lines.push(foldLine(`LOCATION:${escapeIcal(location)}`))
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

const typLabels: Record<string, string> = {
  HOVOR: 'Hovor', EMAIL: 'Email', SCHUZKA: 'Schůzka', POZNAMKA: 'Poznámka', UKOL: 'Úkol',
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')
  const sig = searchParams.get('sig')

  if (!uid || !sig) return new Response('Missing params', { status: 400 })

  let valid = false
  try { valid = verifyCalendarToken(uid, sig) } catch { valid = false }
  if (!valid) return new Response('Unauthorized', { status: 401 })

  // lookup uživatele před znalostí org — záměrně bez tenant scope
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, orgId: true, jmeno: true, organization: { select: { nazev: true } } },
  })
  if (!user) return new Response('Not found', { status: 404 })

  const orgId = user.orgId
  const db = orgPrisma(orgId)
  const host = req.headers.get('host') ?? 'app.felucia.io'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const base = `${proto}://${host}`

  const [activities, deals, servisNavstevy] = await Promise.all([
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
            client: { select: { jmeno: true, prijmeni: true, telefon: true, email: true } },
          },
        },
      },
      orderBy: { datum: 'asc' },
    }),
    db.deal.findMany({
      where: {
        orgId,
        OR: [
          { terminRealizace: { not: null } },
          { terminPrevzeti: { not: null } },
          { splatnostZalohy: { not: null } },
        ],
      },
      include: { client: { select: { jmeno: true, prijmeni: true } } },
    }),
    db.servisniNavsteva.findMany({
      where: { orgId, stav: { in: ['PLANOVANA', 'POTVRZENA', 'PROBIHA'] } },
      include: { kontrakt: { include: { klient: { select: { jmeno: true, prijmeni: true } } } } },
    }).catch(() => []),
  ])

  const vevents: string[] = []

  for (const a of activities) {
    const dateStr = a.datum.toISOString().split('T')[0]
    const c = a.deal.client
    const klient = `${c.jmeno} ${c.prijmeni}`
    const label = typLabels[a.typ] ?? a.typ
    const dealName = a.deal.predmet ?? a.deal.kod ?? ''

    // Summary: "Hovor - Jan Novák"
    const summary = `${label} - ${klient}`

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
    const klient = `${d.client.jmeno} ${d.client.prijmeni}`
    const predmet = d.predmet ?? d.kod ?? 'Případ'
    if (d.terminRealizace) {
      vevents.push(vevent(`deal-rea-${d.id}`, d.terminRealizace.toISOString().split('T')[0], `Realizace: ${predmet}`, `Klient: ${klient}`, `${base}/deals/${d.id}`))
    }
    if (d.terminPrevzeti) {
      vevents.push(vevent(`deal-pre-${d.id}`, d.terminPrevzeti.toISOString().split('T')[0], `Převzetí: ${predmet}`, `Klient: ${klient}`, `${base}/deals/${d.id}`))
    }
    if (d.splatnostZalohy) {
      vevents.push(vevent(`deal-zal-${d.id}`, d.splatnostZalohy.toISOString().split('T')[0], `Záloha: ${predmet}`, `Klient: ${klient}`, `${base}/deals/${d.id}`))
    }
  }

  for (const n of servisNavstevy) {
    const klient = n.kontrakt ? `${n.kontrakt.klient.jmeno} ${n.kontrakt.klient.prijmeni}` : ''
    vevents.push(vevent(
      `servis-${n.id}`,
      n.planovanyTermin.toISOString().split('T')[0],
      `Servis: ${n.kontrakt?.nazev ?? 'Servisní návštěva'}`,
      `Klient: ${klient}`,
      `${base}/servis/kontrakty`,
    ))
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
