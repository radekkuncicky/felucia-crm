import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { TypAktivity } from '@prisma/client'

const TYPY = Object.values(TypAktivity)

// GET /api/mobile/obchod/aktivity?dealId= — feed aktivit případu
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const dealId = new URL(req.url).searchParams.get('dealId')
  if (!dealId) return NextResponse.json({ error: 'Chybí dealId' }, { status: 400 })

  const deal = await db.deal.findFirst({ where: { id: dealId, ...mobileDealScope(session!) }, select: { id: true } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  const aktivity = await db.activity.findMany({
    where: { dealId },
    include: { user: { select: { id: true, jmeno: true } } },
    orderBy: { datum: 'desc' },
    take: 100,
  })

  return NextResponse.json(
    aktivity.map(a => ({
      id: a.id,
      typ: a.typ,
      popis: a.popis,
      cil: a.cil,
      vysledek: a.vysledek,
      datum: a.datum,
      cas: a.cas,
      splneno: a.splneno,
      stav: a.stav,
      reminderAt: a.reminderAt,
      autor: a.user ? { id: a.user.id, jmeno: a.user.jmeno } : null,
    })),
  )
}

// POST /api/mobile/obchod/aktivity — nová aktivita / follow-up.
// { dealId, typ, datum, cas?, popis?, cil?, misto?, reminderAt?, splneno?, vysledek? }
// splneno: true = aktivita vzniká rovnou jako DOKONCENA (zápis hovoru po zavolání
// z appky) — jeden požadavek, aby to fungovalo i z offline fronty.
export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  let body: {
    dealId?: string
    typ?: string
    datum?: string
    cas?: string
    popis?: string
    cil?: string
    misto?: string
    reminderAt?: string
    splneno?: boolean
    vysledek?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  if (!body.dealId || !body.typ || !body.datum) {
    return NextResponse.json({ error: 'Chybí povinná pole (dealId, typ, datum)' }, { status: 400 })
  }
  if (!TYPY.includes(body.typ as TypAktivity)) {
    return NextResponse.json({ error: 'Neplatný typ aktivity' }, { status: 400 })
  }

  const deal = await db.deal.findFirst({ where: { id: body.dealId, ...mobileDealScope(session!) }, select: { id: true } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })

  const splneno = body.splneno === true
  const aktivita = await db.activity.create({
    data: {
      dealId: deal.id,
      userId,
      typ: body.typ as TypAktivity,
      datum: new Date(body.datum),
      cas: body.cas?.trim() || null,
      popis: body.popis?.trim() || null,
      cil: body.cil?.trim() || null,
      misto: body.misto?.trim() || null,
      reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
      splneno,
      vysledek: splneno ? body.vysledek?.trim() || null : null,
      stav: splneno ? 'DOKONCENA' : 'PLANOVANA',
    },
  })

  return NextResponse.json({ id: aktivita.id }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
