import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { isWebhookEvent, validateWebhookUrl } from '@/lib/webhooks'
import crypto from 'crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = orgPrisma(session.user.orgId)

  const endpoints = await db.webhookEndpoint.findMany({
    orderBy: { vytvoreno: 'desc' },
    select: {
      id: true, nazev: true, url: true, events: true, aktivni: true,
      lastSuccessAt: true, lastErrorAt: true, lastError: true, vytvoreno: true,
    },
  })
  return NextResponse.json(endpoints)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json().catch(() => ({}))
  const nazev: string = (body.nazev || 'Bez názvu').trim().slice(0, 100)
  const url: string = (body.url || '').trim()
  const events: string[] = Array.isArray(body.events) ? body.events.filter(isWebhookEvent) : []

  const urlError = validateWebhookUrl(url)
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 })
  if (events.length === 0) return NextResponse.json({ error: 'Vyber alespoň jednu událost.' }, { status: 400 })

  const secret = 'whsec_' + crypto.randomBytes(32).toString('hex')
  const endpoint = await db.webhookEndpoint.create({
    data: { orgId, nazev, url, secret, events },
    select: { id: true, nazev: true, url: true, events: true, aktivni: true, vytvoreno: true },
  })

  // secret se vrací jen jednou, při vytvoření — dál už se nikde nezobrazuje
  return NextResponse.json({ ...endpoint, secret })
}
