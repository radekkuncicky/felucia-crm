import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka, toAbsoluteUrl } from '@/lib/mobile-helpers'
import { nactiZamereniPrehled } from '@/lib/zamereniPrehled'

// Podklady technika: pokyny + dokumenty zakázky; z obchodu (OP) navíc fotky
// a zaměření z appky Sales (opFotky, zamereni — jen čtení, přidaná pole)

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await orgPrisma(session!.user.orgId).zakazka.findFirst({
    where: { id: params.id, orgId: session!.user.orgId },
    select: { pokyny: true, opId: true },
  })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const orgId = session!.user.orgId
  const db = orgPrisma(orgId)

  const [dokumenty, opFotky, zamereni] = await Promise.all([
    db.zakázkaDokument.findMany({
      where: { zakazkaId: params.id, protokolTyp: null },
      select: { id: true, nazev: true, mime: true, url: true, vytvoreno: true, nahral: { select: { jmeno: true } } },
      orderBy: { vytvoreno: 'desc' },
    }),
    zakazka.opId
      ? db.photo.findMany({ where: { orgId, dealId: zakazka.opId }, select: { id: true, nazev: true, cesta: true, popis: true }, orderBy: { vytvoreno: 'desc' } })
      : Promise.resolve([]),
    zakazka.opId ? nactiZamereniPrehled(db, orgId, zakazka.opId, null) : Promise.resolve([]),
  ])

  return NextResponse.json({
    pokyny: zakazka.pokyny,
    dokumenty: dokumenty.map(d => ({
      id: d.id,
      nazev: d.nazev,
      mime: d.mime,
      url: toAbsoluteUrl(d.url, origin) as string,
      vytvoreno: d.vytvoreno.toISOString(),
      nahral: d.nahral.jmeno,
    })),
    opFotky: opFotky.map(f => ({ id: f.id, nazev: f.nazev, popis: f.popis ?? null, url: toAbsoluteUrl(f.cesta, origin) as string })),
    zamereni: zamereni.map(z => ({
      id: z.id, typ: z.typ, stav: z.stav, datum: z.datum, autor: z.autor, sekce: z.sekce,
      fotky: z.fotky.map(f => ({ ...f, url: toAbsoluteUrl(f.url, origin) as string })),
    })),
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}
