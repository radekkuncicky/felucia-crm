import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'
import { VYKAZ_INCLUDE, serializeZaznam, zakazkaZaznamu } from '@/lib/vykazPrace'
import { dnesniVyjezdy, dnesPraha } from '@/lib/dnesniVyjezdy'
import { getOrgSettings } from '@/lib/orgSettings'

type Polozka = {
  typ: 'zakazka' | 'servis'
  id: string
  cislo: string
  titulek: string
  klient: string
  cas: string | null
  zaznamy: ReturnType<typeof serializeZaznam>[]
}

const MAX_ZPET_DNI = 6

/**
 * GET /api/mobile/vykaz/den?datum=YYYY-MM-DD — obrazovka „Konec dne“ v appce (audit APP_TECHNIK A):
 * výjezdy technika toho dne (montáže v rozsahu od–do, servisy; i dokončené) + jeho záznamy výjezdů
 * k nim. Zakázky, ke kterým technik ten den zapsal, i když nebyly v plánu, se přidají taky.
 * Zápis jde přes stávající POST /api/mobile/vykaz po řádcích.
 */
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId, perms, plan } = session!.user
  const db = orgPrisma(orgId)

  const dnes = dnesPraha()
  const raw = new URL(req.url).searchParams.get('datum')
  const datum = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : dnes
  const den = new Date(`${datum}T00:00:00.000Z`)
  const dnesD = new Date(`${dnes}T00:00:00.000Z`)
  const rozdil = Math.round((dnesD.getTime() - den.getTime()) / 86_400_000)
  if (Number.isNaN(den.getTime()) || rozdil < 0 || rozdil > MAX_ZPET_DNI) {
    return NextResponse.json({ error: `Den jde vybrat jen dnes a ${MAX_ZPET_DNI} dní zpět` }, { status: 400 })
  }

  const settings = await getOrgSettings(orgId)
  // poledne toho dne v UTC → dnesPraha() i okno servisu vyjdou na správný pražský den
  const now = new Date(`${datum}T12:00:00.000Z`)
  const [vyjezdy, zaznamy, user] = await Promise.all([
    dnesniVyjezdy(db, { orgId, userId, perms, plan, modulServis: settings.modulServis, now, vcetneDokoncenych: true }),
    db.vykazPrace.findMany({
      where: { orgId, userId, datum: den, typ: 'VYJEZD' },
      include: VYKAZ_INCLUDE,
      orderBy: { vytvoreno: 'asc' },
    }),
    db.user.findFirst({ where: { id: userId, orgId }, select: { vykazPouzivat: true } }),
  ])

  const polozky = new Map<string, Polozka>()
  for (const v of vyjezdy) {
    polozky.set(v.id, {
      typ: v.typ === 'servis' ? 'servis' : 'zakazka',
      id: v.id, cislo: v.cislo, titulek: v.titulek, klient: v.klient, cas: v.cas, zaznamy: [],
    })
  }
  for (const z of zaznamy) {
    const cil = zakazkaZaznamu(z)
    if (!cil.id) continue
    let p = polozky.get(cil.id)
    if (!p) {
      p = { typ: cil.druh === 'SERVIS' ? 'servis' : 'zakazka', id: cil.id, cislo: cil.cislo, titulek: cil.nazev, klient: '', cas: null, zaznamy: [] }
      polozky.set(cil.id, p)
    }
    p.zaznamy.push(serializeZaznam(z))
  }

  return NextResponse.json({
    datum,
    dnes,
    pouzivat: user?.vykazPouzivat !== false,
    vyjezdy: Array.from(polozky.values()),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
