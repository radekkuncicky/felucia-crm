import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { isWebhookEvent, validateWebhookUrl } from '@/lib/webhooks'
import { Prisma } from '@prisma/client'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = orgPrisma(session.user.orgId)

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body.nazev === 'string') data.nazev = body.nazev.trim().slice(0, 100) || 'Bez názvu'
  if (typeof body.aktivni === 'boolean') data.aktivni = body.aktivni
  if (typeof body.url === 'string') {
    const url = body.url.trim()
    const urlError = validateWebhookUrl(url)
    if (urlError) return NextResponse.json({ error: urlError }, { status: 400 })
    data.url = url
  }
  if (Array.isArray(body.events)) {
    const events = body.events.filter(isWebhookEvent)
    if (events.length === 0) return NextResponse.json({ error: 'Vyber alespoň jednu událost.' }, { status: 400 })
    data.events = events
  }

  try {
    const endpoint = await db.webhookEndpoint.update({
      where: { id: params.id },
      data,
      select: {
        id: true, nazev: true, url: true, events: true, aktivni: true,
        lastSuccessAt: true, lastErrorAt: true, lastError: true, vytvoreno: true,
      },
    })
    return NextResponse.json(endpoint)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Webhook nenalezen' }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = orgPrisma(session.user.orgId)

  try {
    await db.webhookEndpoint.delete({ where: { id: params.id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Webhook nenalezen' }, { status: 404 })
    }
    throw err
  }
  return NextResponse.json({ ok: true })
}
