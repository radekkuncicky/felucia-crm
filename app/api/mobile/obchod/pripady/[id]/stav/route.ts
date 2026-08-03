import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { logAction } from '@/lib/auditLog'
import { createNotification } from '@/lib/createNotification'
import { DuvodProhry, StavDealu } from '@prisma/client'

// Stavy dosažitelné z mobilu — ZNEPLATNENO je jen pro web/admin
const POVOLENE_STAVY: StavDealu[] = ['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM', 'USPECH', 'PAS']
const DUVODY = Object.values(DuvodProhry)

// POST /api/mobile/obchod/pripady/[id]/stav — změna stavu pipeline s auditem.
// { stav, duvodProhryKod?, duvodProhry? } — u PAS je duvodProhryKod povinný.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({
    where: { id: params.id },
    select: { id: true, kod: true, predmet: true, stav: true, userId: true },
  })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  let body: { stav?: string; duvodProhryKod?: string; duvodProhry?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const novyStav = body.stav as StavDealu
  if (!novyStav || !POVOLENE_STAVY.includes(novyStav)) {
    return NextResponse.json({ error: 'Neplatný stav' }, { status: 400 })
  }

  const data: Record<string, unknown> = { stav: novyStav }
  if (novyStav === 'PAS') {
    if (!body.duvodProhryKod || !DUVODY.includes(body.duvodProhryKod as DuvodProhry)) {
      return NextResponse.json(
        { error: 'U prohry je povinný důvod (duvodProhryKod: CENA/KONKURENCE/ODLOZENO/NEREAGOVAL/JINE)' },
        { status: 400 },
      )
    }
    data.duvodProhryKod = body.duvodProhryKod
    data.duvodProhry = typeof body.duvodProhry === 'string' ? body.duvodProhry.trim() || null : null
  } else {
    data.duvodProhryKod = null
    data.duvodProhry = null
  }

  await db.deal.update({ where: { id: params.id }, data })

  await logAction({
    orgId,
    userId,
    typAkce: 'UPDATE',
    typZaznamu: 'Deal',
    zaznamId: deal.id,
    zaznamNazev: `${deal.kod ?? ''} ${deal.predmet ?? ''}`.trim(),
    zmeny: {
      stav: { z: deal.stav, na: novyStav },
      ...(novyStav === 'PAS' ? { duvodProhryKod: data.duvodProhryKod, duvodProhry: data.duvodProhry } : {}),
      zdroj: 'mobile-obchod',
    },
  })

  // Vlastník OP dostane zvonek, když mu stav změnil někdo jiný
  if (deal.userId && deal.userId !== userId) {
    await createNotification({
      orgId,
      userId: deal.userId,
      typ: 'OP_STAV',
      zprava: `${deal.kod ?? 'OP'}: stav změněn na ${novyStav}`,
      dealId: deal.id,
    })
  }

  return NextResponse.json({ id: deal.id, stav: novyStav })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
