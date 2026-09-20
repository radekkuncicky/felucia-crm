import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPlanLimits } from '@/lib/planLimits'
import {
  getMobileOrWebSession,
  requireTechnikOrAdmin,
  canAccessServisniZakazka,
  klientAdresa,
} from '@/lib/mobile-helpers'
import { updateServisniZakazka } from '@/lib/servisZakazkaService'

// Stavy, do kterých smí technik zakázku přepnout z mobilu (žádné fakturační).
const POVOLENE_STAVY = ['NAPLANOVANA', 'PROBIHA', 'CEKA', 'DOKONCENA'] as const

async function guard(req: Request, id: string) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return { err: authErr as NextResponse }
  if (!getPlanLimits(session!.user.plan).hasServiceModule) {
    return { err: NextResponse.json({ error: 'Servisní modul není v plánu' }, { status: 403 }) }
  }
  if (!(await canAccessServisniZakazka(session!, id))) {
    return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session: session! }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await guard(req, params.id)
  if (g.err) return g.err
  const { orgId } = g.session.user

  const z = await orgPrisma(orgId).servisniZakazka.findFirst({
    where: { id: params.id, orgId },
    include: {
      kontrakt: { select: { nazev: true, klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } } } },
      klient: { select: { jmeno: true, prijmeni: true, telefon: true, ulice: true, mesto: true, psc: true } },
      zarizeni: { select: { nazev: true, typ: true, vyrobniCislo: true } },
      technik: { select: { id: true, jmeno: true } },
    },
  })
  if (!z) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const klient = z.kontrakt?.klient ?? z.klient

  return NextResponse.json({
    id: z.id,
    cislo: z.cislo,
    typ: z.typ,
    stav: z.stav,
    // Zadání (servis/nova): adresa zásahu má přednost před adresou klienta
    popis: z.popis,
    priorita: z.priorita,
    adresaZasahu: z.adresaZasahu ?? (klient ? klientAdresa(klient) : null),
    kontaktJmeno: z.kontaktJmeno,
    kontaktTelefon: z.kontaktTelefon,
    planovanyTermin: z.planovanyTermin,
    skutecnyTermin: z.skutecnyTermin,
    poznamka: z.poznamka,
    zprava: z.zprava,
    nalezeneZavady: z.nalezeneZavady,
    doporuceni: z.doporuceni,
    cekaDuvod: z.cekaDuvod,
    nakladyCas: z.nakladyCas != null ? Number(z.nakladyCas) : null,
    nakladyMaterial: z.nakladyMaterial != null ? Number(z.nakladyMaterial) : null,
    fotky: (z.fotky as string[]) ?? [],
    podpisKlienta: z.podpisKlienta,
    protokolDokoncen: z.protokolDokoncen,
    technik: z.technik ? { id: z.technik.id, jmeno: z.technik.jmeno } : null,
    zarizeni: z.zarizeni
      ? { nazev: z.zarizeni.nazev, typ: z.zarizeni.typ, vyrobniCislo: z.zarizeni.vyrobniCislo ?? null }
      : null,
    klient: klient
      ? {
          jmeno: `${klient.jmeno} ${klient.prijmeni}`,
          telefon: klient.telefon ?? null,
          adresa: klientAdresa(klient),
        }
      : null,
  })
}

// PATCH - technik vyplní protokol (zpráva/závady/doporučení/náklady/podpis)
// a může zakázku posunout ve stavu. Bílá listina polí: žádné přiřazení
// technika, typ ani fakturační stavy.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guard(req, params.id)
  if (g.err) return g.err
  const { orgId } = g.session.user

  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  for (const k of ['zprava', 'nalezeneZavady', 'doporuceni', 'poznamka', 'cekaDuvod', 'podpisKlienta'] as const) {
    if (body[k] !== undefined) allowed[k] = body[k]
  }
  for (const k of ['nakladyCas', 'nakladyMaterial', 'trvaniMinut'] as const) {
    if (body[k] !== undefined) allowed[k] = body[k] == null ? null : Number(body[k])
  }
  if (body.stav !== undefined) {
    if (!POVOLENE_STAVY.includes(body.stav)) {
      return NextResponse.json({ error: 'Nepovolený přechod stavu' }, { status: 422 })
    }
    allowed.stav = body.stav
  }

  const result = await updateServisniZakazka(orgId, params.id, allowed)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
