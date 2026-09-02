import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { TypAktivity } from '@prisma/client'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden('Nemáte oprávnění upravovat aktivity')
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const activity = await db.activity.findFirst({
    where: { id: params.id, deal: { orgId } },
  })
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Backward compat: splneno=true → stav=DOKONCENA
  let stav = body.stav ?? activity.stav
  if (body.splneno === true && !body.stav) stav = 'DOKONCENA'
  if (body.splneno === false && !body.stav) stav = 'PLANOVANA'
  const splneno = stav === 'DOKONCENA'

  // Validate resitelId belongs to same org
  if (body.resitelId !== undefined && body.resitelId !== null) {
    const resitel = await db.user.findFirst({ where: { id: body.resitelId, orgId } })
    if (!resitel) return NextResponse.json({ error: 'Řešitel nebyl nalezen' }, { status: 400 })
  }

  const updated = await db.activity.update({
    where: { id: params.id },
    data: {
      stav,
      splneno,
      typ: body.typ ? (body.typ as TypAktivity) : activity.typ,
      datum: body.datum ? new Date(body.datum) : activity.datum,
      cas: body.cas !== undefined ? (body.cas || null) : activity.cas,
      trvaniMin: body.trvaniMin !== undefined ? (body.trvaniMin != null ? Number(body.trvaniMin) : null) : activity.trvaniMin,
      popis: body.popis !== undefined ? (body.popis || null) : activity.popis,
      cil: body.cil !== undefined ? (body.cil || null) : activity.cil,
      vysledek: body.vysledek !== undefined ? (body.vysledek || null) : activity.vysledek,
      misto: body.misto !== undefined ? (body.misto || null) : activity.misto,
      resitelId: body.resitelId !== undefined ? (body.resitelId || null) : activity.resitelId,
      reminderAt: body.reminderAt !== undefined ? (body.reminderAt ? new Date(body.reminderAt) : null) : activity.reminderAt,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden('Nemáte oprávnění upravovat aktivity')
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const activity = await db.activity.findFirst({
    where: { id: params.id, deal: { orgId } },
  })
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.activity.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
