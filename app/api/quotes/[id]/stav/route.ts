import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import type { QuoteStav } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { forbidden, getPerms } from '@/lib/permissions'
import { canAccessQuote } from '@/lib/zakazkyHelpers'
import { logAction } from '@/lib/auditLog'
import { QUOTE_STAVY, dataOdeslani, lzePrejit, popisZmenyStavu } from '@/lib/quoteStav'

/**
 * POST /api/quotes/[id]/stav — ruční změna stavu nabídky { stav }.
 * ODESLANA = „Označit jako odeslanou“ (poslal mimo Felucii) nebo oprava omylu z AKCEPTOVANA/ODMITNUTA.
 * AKCEPTOVANA nastaví nabídku jako aktivní. ODMITNUTA bez důvodu.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (!perms.obchod) return forbidden()
  if (!(await canAccessQuote(session.user, perms, params.id))) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const na = body.stav as QuoteStav
  if (!(QUOTE_STAVY as readonly string[]).includes(na)) {
    return NextResponse.json({ error: 'Neplatný stav nabídky' }, { status: 400 })
  }

  const { orgId, id: userId } = session.user
  const db = orgPrisma(orgId)
  const quote = await db.quote.findFirst({
    where: { id: params.id },
    select: { id: true, kod: true, nazev: true, stav: true, dealId: true },
  })
  if (!quote) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })
  if (quote.stav === na) return NextResponse.json({ id: quote.id, stav: quote.stav })
  if (!lzePrejit(quote.stav, na)) {
    return NextResponse.json({ error: 'Tuto změnu stavu nabídky nelze provést' }, { status: 400 })
  }

  const now = new Date()
  const updated = await db.$transaction(async tx => {
    if (na === 'AKCEPTOVANA') {
      await tx.quote.updateMany({ where: { dealId: quote.dealId, id: { not: quote.id } }, data: { aktivni: false } })
    }
    const data = quote.stav === 'ROZPRACOVANA' && na === 'ODESLANA'
      ? dataOdeslani(quote.stav, null, now)
      : { stav: na, stavZmenen: now, ...(na === 'AKCEPTOVANA' ? { aktivni: true } : {}) }
    const q = await tx.quote.update({
      where: { id: quote.id },
      data,
      select: { id: true, stav: true, stavZmenen: true, aktivni: true, odeslanoAt: true, odeslanoKanal: true },
    })
    await tx.activity.create({
      data: {
        orgId,
        dealId: quote.dealId,
        userId,
        typ: 'POZNAMKA',
        datum: now,
        popis: popisZmenyStavu(quote.kod, na),
        splneno: true,
        stav: 'DOKONCENA',
      },
    })
    return q
  })

  await logAction({
    orgId,
    userId,
    typAkce: 'UPDATE',
    typZaznamu: 'Quote',
    zaznamId: quote.id,
    zaznamNazev: quote.kod ?? quote.nazev,
    zmeny: { stav: { z: quote.stav, na } },
  })

  return NextResponse.json(updated)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
