import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { TypAktivity } from '@prisma/client'
import { parseCas, parseTrvani } from '@/lib/casAktivity'
import { idempotentne, parseMobileId, MobileIdKolize } from '@/lib/mobileIdempotence'
import { leadUzavren, typPovolen } from '@/lib/activities'

const TYPY = Object.values(TypAktivity)

// GET /api/mobile/obchod/aktivity?dealId= | ?leadId= — feed aktivit případu / leadu
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const sp = new URL(req.url).searchParams
  const dealId = sp.get('dealId')
  const leadId = sp.get('leadId')
  if (!dealId && !leadId) return NextResponse.json({ error: 'Chybí dealId' }, { status: 400 })

  if (dealId) {
    const deal = await db.deal.findFirst({ where: { id: dealId, ...mobileDealScope(session!) }, select: { id: true } })
    if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })
  } else {
    const lead = await db.lead.findFirst({ where: { id: leadId!, orgId: session!.user.orgId }, select: { id: true } })
    if (!lead) return NextResponse.json({ error: 'Lead nenalezen' }, { status: 404 })
  }

  const aktivity = await db.activity.findMany({
    where: dealId ? { dealId } : { leadId: leadId! },
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
      trvaniMin: a.trvaniMin,
      misto: a.misto,
      splneno: a.splneno,
      stav: a.stav,
      reminderAt: a.reminderAt,
      autor: a.user ? { id: a.user.id, jmeno: a.user.jmeno } : null,
    })),
  )
}

// POST /api/mobile/obchod/aktivity — nová aktivita / follow-up.
// { dealId | leadId, typ, datum, cas?, popis?, cil?, misto?, reminderAt?, splneno?, vysledek? }
// U leadu jen HOVOR/EMAIL; uskutečněný hovor posune NOVY lead na KONTAKTOVAN.
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
    leadId?: string
    typ?: string
    datum?: string
    cas?: string
    trvaniMin?: number
    popis?: string
    cil?: string
    misto?: string
    reminderAt?: string
    splneno?: boolean
    vysledek?: string
    mobileId?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  if (!body.dealId === !body.leadId || !body.typ || !body.datum) {
    return NextResponse.json({ error: 'Chybí povinná pole (dealId nebo leadId, typ, datum)' }, { status: 400 })
  }
  if (!TYPY.includes(body.typ as TypAktivity)) {
    return NextResponse.json({ error: 'Neplatný typ aktivity' }, { status: 400 })
  }

  let rodic: { dealId: string; leadId: null } | { dealId: null; leadId: string }
  if (body.dealId) {
    const deal = await db.deal.findFirst({ where: { id: body.dealId, ...mobileDealScope(session!) }, select: { id: true } })
    if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })
    rodic = { dealId: deal.id, leadId: null }
  } else {
    const lead = await db.lead.findFirst({ where: { id: body.leadId!, orgId }, select: { id: true, status: true } })
    if (!lead) return NextResponse.json({ error: 'Lead nenalezen' }, { status: 404 })
    if (!typPovolen(body.typ as TypAktivity, { leadId: lead.id })) {
      return NextResponse.json({ error: 'U leadu jde zapsat jen hovor nebo e-mail' }, { status: 400 })
    }
    rodic = { dealId: null, leadId: lead.id }
  }

  const splneno = body.splneno === true
  const mobileId = parseMobileId(body.mobileId)
  const datum = new Date(body.datum)
  const vytvor = async () => {
    // lead převedený mezitím (offline fronta) → zápis patří k jeho OP
    if (rodic.leadId) {
      const l = await db.lead.findFirst({ where: { id: rodic.leadId }, select: { status: true, prevedenNaOpId: true } })
      if (l?.status === 'PREVEDEN' && l.prevedenNaOpId) rodic = { dealId: l.prevedenNaOpId, leadId: null }
      else if (l && leadUzavren(l.status)) throw new LeadUzavren()
    }
    const a = await db.activity.create({ data: {
      mobileId,
      orgId,
      dealId: rodic.dealId,
      leadId: rodic.leadId,
      userId,
      typ: body.typ as TypAktivity,
      datum,
      cas: parseCas(body.cas),
      ...(parseTrvani(body.trvaniMin) ? { trvaniMin: parseTrvani(body.trvaniMin)! } : {}),
      popis: body.popis?.trim() || null,
      cil: body.cil?.trim() || null,
      misto: body.misto?.trim() || null,
      reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
      splneno,
      vysledek: splneno ? body.vysledek?.trim() || null : null,
      stav: splneno ? 'DOKONCENA' : 'PLANOVANA',
    } })
    if (rodic.leadId && splneno && body.typ === 'HOVOR') {
      await db.lead.updateMany({ where: { id: rodic.leadId, status: 'NOVY' }, data: { status: 'KONTAKTOVAN' } })
    }
    return a
  }

  try {
    // opakované odeslání z offline fronty → 200 s už uloženou aktivitou
    const { zaznam, novy } = await idempotentne(
      mobileId,
      m => db.activity.findFirst({ where: { mobileId: m }, select: { id: true } }),
      vytvor,
    )
    return NextResponse.json({ id: zaznam.id }, { status: novy ? 201 : 200 })
  } catch (e) {
    if (e instanceof MobileIdKolize) return NextResponse.json({ error: 'Neplatné mobileId' }, { status: 422 })
    if (e instanceof LeadUzavren) return NextResponse.json({ error: 'Lead je uzavřený' }, { status: 400 })
    throw e
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

class LeadUzavren extends Error {}
