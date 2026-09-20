import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { forbidden, getPerms } from '@/lib/permissions'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const zarizeni = await db.zarizeni.findFirst({ where: { id: params.id, orgId } })
  if (!zarizeni) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Return existing token or generate new one
  if (zarizeni.qrToken) {
    return NextResponse.json({ qrToken: zarizeni.qrToken })
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '')
  const token = await new SignJWT({ zarizeniId: zarizeni.id, orgId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10y')
    .sign(secret)

  const updated = await db.zarizeni.update({
    where: { id: params.id },
    data: { qrToken: token },
  })

  return NextResponse.json({ qrToken: updated.qrToken })
}

// Obnova QR tokenu — stará nálepka přestane fungovat (např. po prodeji nemovitosti)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).servisDispecink) return forbidden()
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const zarizeni = await db.zarizeni.findFirst({ where: { id: params.id, orgId } })
  if (!zarizeni) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '')
  const token = await new SignJWT({ zarizeniId: zarizeni.id, orgId, v: Date.now() })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10y')
    .sign(secret)
  const updated = await db.zarizeni.update({ where: { id: params.id }, data: { qrToken: token } })
  return NextResponse.json({ qrToken: updated.qrToken })
}
