import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { leadProAppku } from '@/lib/leadMobile'

const LEAD_INCLUDE = {
  assignedTo: { select: { id: true, jmeno: true } },
  zdrojPoptavky: { select: { nazev: true } },
} as const

async function nactiLead(req: Request, id: string) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return { err: authErr, ok: null }
  if (session!.user.plan === 'STARTER') return { err: NextResponse.json({ error: 'Leady nejsou v tomto plánu.' }, { status: 403 }), ok: null }
  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const lead = await db.lead.findFirst({ where: { id, orgId }, include: LEAD_INCLUDE })
  if (!lead) return { err: NextResponse.json({ error: 'Lead nenalezen' }, { status: 404 }), ok: null }
  return { err: null, ok: { db, userId, lead } }
}

// GET /api/mobile/obchod/leady/[id] — detail: lead + poznámky + aktivity (hovory/e-maily)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = await nactiLead(req, params.id)
  if (!r.ok) return r.err!
  const { db, lead } = r.ok

  const [poznamky, aktivity, op] = await Promise.all([
    db.leadNote.findMany({
      where: { leadId: lead.id },
      include: { user: { select: { jmeno: true } } },
      orderBy: { vytvoreno: 'desc' },
      take: 100,
    }),
    db.activity.findMany({
      where: { leadId: lead.id },
      include: { user: { select: { id: true, jmeno: true } } },
      orderBy: { datum: 'desc' },
      take: 100,
    }),
    lead.prevedenNaOpId
      ? db.deal.findFirst({ where: { id: lead.prevedenNaOpId }, select: { id: true, kod: true, predmet: true } })
      : null,
  ])

  return NextResponse.json({
    ...leadProAppku(lead),
    strankaUrl: lead.strankaUrl,
    prilohy: lead.prilohy,
    prevedenNaOp: op,
    poznamky: poznamky.map(p => ({ id: p.id, text: p.text, vytvoreno: p.vytvoreno, autor: p.user?.jmeno ?? null })),
    aktivity: aktivity.map(a => ({
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
  })
}

// PATCH /api/mobile/obchod/leady/[id]
// { status?: 'KONTAKTOVAN'|'KVALIFIKOVAN'|'ZRUSEN'|'NOVY', duvodZruseni?, poznamka?, prevzit?: true }
// ZRUSEN = zamítnutí (s důvodem), NOVY jen ze ZRUSEN (znovuotevření). PREVEDEN jde jen přes /prevest.
// poznamka přidá LeadNote; prevzit přiřadí lead volajícímu.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const r = await nactiLead(req, params.id)
  if (!r.ok) return r.err!
  const { db, userId, lead } = r.ok

  let body: { status?: string; duvodZruseni?: string; poznamka?: string; prevzit?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const data: { status?: 'NOVY' | 'KONTAKTOVAN' | 'KVALIFIKOVAN' | 'ZRUSEN'; duvodZruseni?: string | null; assignedToId?: string } = {}
  if (body.status !== undefined) {
    if (lead.status === 'PREVEDEN') return NextResponse.json({ error: 'Převedený lead už nejde měnit.' }, { status: 400 })
    if (body.status === 'ZRUSEN') {
      data.status = 'ZRUSEN'
      data.duvodZruseni = body.duvodZruseni?.trim().slice(0, 500) || null
    } else if (body.status === 'NOVY') {
      if (lead.status !== 'ZRUSEN') return NextResponse.json({ error: 'Znovu otevřít jde jen zamítnutý lead.' }, { status: 400 })
      data.status = 'NOVY'
      data.duvodZruseni = null
    } else if (body.status === 'KONTAKTOVAN' || body.status === 'KVALIFIKOVAN') {
      if (lead.status === 'ZRUSEN') return NextResponse.json({ error: 'Zamítnutý lead nejdřív znovu otevřete.' }, { status: 400 })
      data.status = body.status
    } else {
      return NextResponse.json({ error: 'Neplatný stav' }, { status: 400 })
    }
  }
  if (body.prevzit === true) data.assignedToId = userId

  const poznamka = body.poznamka?.trim().slice(0, 5000)
  await db.$transaction(async tx => {
    if (Object.keys(data).length) await tx.lead.update({ where: { id: lead.id }, data })
    if (poznamka) await tx.leadNote.create({ data: { leadId: lead.id, userId, text: poznamka } })
  })
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
