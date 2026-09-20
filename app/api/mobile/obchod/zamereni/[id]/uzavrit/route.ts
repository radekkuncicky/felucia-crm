import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { getDefiniceProZamereni, chybejiciOtazky, chybejiciTagy } from '@/lib/zamereniDefinice'
import { logAction } from '@/lib/auditLog'

// POST /api/mobile/obchod/zamereni/[id]/uzavrit — uzavření zaměření.
// Bez kompletních povinných otázek a povinné sady foto tagů vrací 400
// se seznamem toho, co chybí (appka to zobrazí jako checklist).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const zamereni = await db.zamereni.findFirst({
    where: { id: params.id, deal: mobileDealScope(session!) },
    include: { fotky: { select: { tag: true } }, deal: { select: { kod: true } } },
  })
  if (!zamereni) return NextResponse.json({ error: 'Zaměření nenalezeno' }, { status: 404 })
  if (zamereni.stav === 'UZAVRENE') return NextResponse.json({ id: zamereni.id, stav: 'UZAVRENE' })

  const definice = await getDefiniceProZamereni(db, zamereni)
  const odpovedi = (zamereni.odpovedi ?? {}) as Record<string, unknown>

  const chybiOtazky = chybejiciOtazky(definice.schemaJson, odpovedi)
  const chybiTagy = chybejiciTagy(definice.povinneTagy, zamereni.fotky)

  if (chybiOtazky.length > 0 || chybiTagy.length > 0) {
    return NextResponse.json({
      error: 'Zaměření není kompletní',
      chybejiciOtazky: chybiOtazky.map(o => ({ klic: o.klic, popisek: o.popisek })),
      chybejiciTagy: chybiTagy,
    }, { status: 400 })
  }

  await db.zamereni.update({
    where: { id: params.id },
    data: {
      stav: 'UZAVRENE',
      // Zafixuj definici, se kterou bylo uzavřeno (u defaultu z kódu zůstává null + verze 0)
      definiceId: definice.id,
      definiceVerze: definice.verze,
    },
  })

  await logAction({
    orgId,
    userId,
    typAkce: 'UPDATE',
    typZaznamu: 'Zamereni',
    zaznamId: zamereni.id,
    zaznamNazev: `Zaměření ${zamereni.deal.kod ?? ''} (${zamereni.typ})`.trim(),
    zmeny: { stav: { z: 'ROZPRACOVANE', na: 'UZAVRENE' } },
  })

  return NextResponse.json({ id: zamereni.id, stav: 'UZAVRENE' })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
