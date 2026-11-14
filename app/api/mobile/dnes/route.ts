import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { zakazkyScopeWhere, servisScopeWhere } from '@/lib/permissions'
import { getPlanLimits } from '@/lib/planLimits'
import { getOrgSettings } from '@/lib/orgSettings'
import { denniOkno } from '@/lib/dnesniVyjezdy'
import { getMobileOrWebSession, requireTechnikOrAdmin, klientAdresa, toAbsoluteUrl } from '@/lib/mobile-helpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapZakazka(z: any, origin: string) {
  const titulniFotoUrl = toAbsoluteUrl(z.titulniFotoUrl, origin)
  return {
    id: z.id,
    cislo: z.cislo,
    nazev: z.nazev,
    stav: z.stav,
    montazOd: z.montazOd,
    montazDo: z.montazDo,
    kdykoliv: z.kdykoliv,
    adresa: klientAdresa(z.klient),
    mistoStavby: z.mistoStavby ?? null,
    titulniFotoUrl,
    klient: {
      jmeno: z.klient.jmeno,
      prijmeni: z.klient.prijmeni,
      telefon: z.klient.telefon ?? null,
    },
    polozky: {
      celkem: z.polozky.length,
      hotovo: z.polozky.filter((p: { hotovo: boolean }) => p.hotovo).length,
    },
    technici: z.techniciRel.map((t: { technik: { id: string; jmeno: string } }) => ({ id: t.technik.id, jmeno: t.technik.jmeno })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapServis(z: any) {
  const k = z.kontrakt?.klient ?? z.klient ?? null
  return {
    id: z.id,
    cislo: z.cislo,
    typ: z.typ,
    stav: z.stav,
    popis: z.popis,
    priorita: z.priorita,
    planovanyTermin: z.planovanyTermin,
    klient: k ? `${k.jmeno} ${k.prijmeni}`.trim() : null,
    zarizeni: z.zarizeni?.nazev ?? null,
    // adresa zásahu má přednost před adresou klienta, kontakt na místě před telefonem klienta
    adresaZasahu: z.adresaZasahu ?? (k ? klientAdresa(k) : null),
    kontaktJmeno: z.kontaktJmeno ?? null,
    kontaktTelefon: z.kontaktTelefon ?? k?.telefon ?? null,
  }
}

export async function GET(req: Request) {
  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin

  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { id: userId, orgId } = session!.user
  const db = orgPrisma(orgId)

  // Pražský den (jako nástěnka): montáže uložené jako UTC půlnoc, vícedenní montáž je v Dnes každý den rozsahu
  const { denOd, denDo, servisOd, servisDo, vRozsahu } = denniOkno()
  const in60Days = new Date(denOd.getTime() + 60 * 24 * 60 * 60 * 1000)

  const scope = zakazkyScopeWhere(session!.user.perms, userId)
  if (scope === null) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const technikFilter = scope
  const include = {
    klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
    polozky: { select: { id: true, hotovo: true } },
    techniciRel: { include: { technik: { select: { id: true, jmeno: true } } } },
  }

  // Servisy na dnešek (i dokončené — appka z nich počítá „1 / 3 hotovo“). Nové pole `servisy`:
  // starší verze appky ho ignorují, stávající pole se nemění.
  const settings = await getOrgSettings(orgId)
  const servisScope = getPlanLimits(session!.user.plan).hasServiceModule && settings.modulServis
    ? servisScopeWhere(session!.user.perms, userId)
    : null

  const [dnesZakazky, upcomingZakazky, bezTerminuZakazky, dnesServisy] = await Promise.all([
    db.zakazka.findMany({
      where: { orgId, AND: [{ OR: [vRozsahu, { etapy: { some: vRozsahu } }] }, technikFilter] },
      include,
      orderBy: { montazOd: 'asc' },
    }),
    db.zakazka.findMany({
      where: {
        orgId,
        montazOd: { gte: denDo, lte: in60Days },
        stav: { notIn: ['HOTOVO', 'VYUCTOVANA'] },
        ...technikFilter,
      },
      include,
      orderBy: { montazOd: 'asc' },
    }),
    db.zakazka.findMany({
      where: {
        orgId,
        montazOd: null,
        stav: { notIn: ['HOTOVO', 'VYUCTOVANA'] },
        ...technikFilter,
      },
      include,
      orderBy: { cislo: 'asc' },
    }),
    !servisScope ? Promise.resolve([]) : db.servisniZakazka.findMany({
      where: {
        orgId,
        AND: [servisScope],
        stav: { in: ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'CEKA', 'DOKONCENA'] },
        planovanyTermin: { gte: servisOd, lt: servisDo },
      },
      include: {
        klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
        kontrakt: { select: { klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } } } },
        zarizeni: { select: { nazev: true } },
      },
      orderBy: { planovanyTermin: 'asc' },
      take: 30,
    }),
  ])

  const dnesIds = new Set(dnesZakazky.map(z => z.id))

  return NextResponse.json({
    date: denOd.toISOString().split('T')[0],
    zakazky: dnesZakazky.map(z => mapZakazka(z, origin)),
    upcoming: upcomingZakazky.filter(z => !dnesIds.has(z.id)).map(z => mapZakazka(z, origin)),
    bezTerminu: bezTerminuZakazky.map(z => mapZakazka(z, origin)),
    servisy: dnesServisy.map(mapServis),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
