import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await orgPrisma(session!.user.orgId).zakazka.findFirst({
    where: { id: params.id, orgId: session!.user.orgId },
    select: { pokyny: true },
  })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dokumenty = await orgPrisma(session!.user.orgId).zakázkaDokument.findMany({
    where: { zakazkaId: params.id },
    select: { id: true, nazev: true, mime: true, url: true, vytvoreno: true, nahral: { select: { jmeno: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json({
    pokyny: zakazka.pokyny,
    dokumenty: dokumenty.map(d => ({
      id: d.id,
      nazev: d.nazev,
      mime: d.mime,
      url: d.url,
      vytvoreno: d.vytvoreno.toISOString(),
      nahral: d.nahral.jmeno,
    })),
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}
