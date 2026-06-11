import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'

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

  await orgPrisma(session!.user.orgId).user.update({
    where: { id: session!.user.id },
    data: { pushToken: body.token },
  })

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
