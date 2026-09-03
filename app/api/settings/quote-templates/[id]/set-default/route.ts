import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const template = await db.quoteTemplate.findFirst({
    where: { id: params.id, orgId },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.$transaction([
    db.quoteTemplate.updateMany({
      where: { orgId, isDefault: true },
      data: { isDefault: false },
    }),
    db.quoteTemplate.update({
      where: { id: params.id },
      data: { isDefault: true },
    }),
  ])

  return NextResponse.json({ ok: true })
}
