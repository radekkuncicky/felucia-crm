import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import crypto from 'crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const keys = await db.apiKey.findMany({
    where: { orgId },
    orderBy: { vytvoreno: 'desc' },
    select: { id: true, nazev: true, klic: true, aktivni: true, allowedOrigins: true, lastUsedAt: true, vytvoreno: true },
  })

  return NextResponse.json(keys.map(k => ({ ...k, klic: k.klic.slice(0, 8) + '…' })))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json().catch(() => ({}))
  const nazev: string = (body.nazev || 'Bez názvu').trim().slice(0, 100)
  const allowedOrigins: string | null = body.allowedOrigins?.trim() || null

  const klic = 'nk_' + crypto.randomBytes(32).toString('hex')
  const key = await db.apiKey.create({
    data: { orgId, nazev, klic, allowedOrigins },
  })

  return NextResponse.json({ ...key, klicPlain: klic, klic: klic.slice(0, 8) + '…' })
}
