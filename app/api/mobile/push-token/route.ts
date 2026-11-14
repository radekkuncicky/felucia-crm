import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, klientAppky } from '@/lib/mobile-helpers'
import { logAction } from '@/lib/auditLog'

export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  let body: { token?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'Chybí token' }, { status: 400 })
  }

  const db = orgPrisma(session!.user.orgId)
  const pred = await db.user.findFirst({ where: { id: session!.user.id }, select: { pushToken: true } })
  await db.user.update({
    where: { id: session!.user.id },
    data: { pushToken: body.token },
  })

  // jen při změně tokenu (appka ho registruje při každém startu) — platforma + verze appky do auditu
  if (pred?.pushToken !== body.token) {
    await logAction({
      orgId: session!.user.orgId,
      userId: session!.user.id,
      typAkce: 'UPDATE',
      typZaznamu: 'MobilePushToken',
      zaznamId: session!.user.id,
      zaznamNazev: 'Registrace notifikací v appce',
      zmeny: klientAppky(req),
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  await orgPrisma(session!.user.orgId).user.update({
    where: { id: session!.user.id },
    data: { pushToken: null },
  })

  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
