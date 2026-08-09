import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { sha256 } from '@/lib/sodPodpis'
import { buildSodBaseHtml } from '@/lib/sodHtml'

// GET /api/mobile/obchod/sod/[id] — detail smlouvy pro appku (stav, klient,
// cena, podpisy). zhotovitelPodpisPlatny říká, jestli jde smlouvu rovnou
// odeslat klientovi, nebo bude potřeba interní podpis zmocněnce.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const sod = await db.sod.findFirst({
    where: { id: params.id },
    include: {
      deal: { select: { id: true, kod: true, stav: true } },
      organization: {
        select: { nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true },
      },
    },
  })
  if (!sod) return NextResponse.json({ error: 'Smlouva nenalezena' }, { status: 404 })

  const zhotovitelPodpisPlatny = !!sod.zhotovitelPodepsano
    && sod.zhotovitelTextHash === sha256(buildSodBaseHtml(sod))

  return NextResponse.json({
    id: sod.id,
    cislo: sod.cislo,
    stav: sod.stav,
    typ: sod.typ,
    klientJmeno: sod.klientJmeno,
    klientEmail: sod.klientEmail,
    klientTelefon: sod.klientTelefon,
    predmetDila: sod.predmetDila,
    adresaDila: sod.adresaDila,
    terminPrevzeti: sod.terminPrevzeti,
    cenaBezDph: sod.cenaBezDph != null ? Number(sod.cenaBezDph) : null,
    cenaSDph: sod.cenaSDph != null ? Number(sod.cenaSDph) : null,
    dphSazba: Number(sod.dphSazba),
    podepsano: sod.podepsano,
    podepsalJmeno: sod.podepsalJmeno,
    zhotovitelPodepsano: sod.zhotovitelPodepsano,
    zhotovitelPodepsalJmeno: sod.zhotovitelPodepsalJmeno,
    zhotovitelPodpisPlatny,
    vytvoreno: sod.vytvoreno,
    pripad: sod.deal,
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
