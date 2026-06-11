import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: userId } = session.user

  const notif = await orgPrisma(session.user.orgId).notification.findFirst({
    where: { id: params.id, userId },
  })
  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await orgPrisma(session.user.orgId).notification.update({
    where: { id: params.id },
    data: { precteno: true },
  })

  return NextResponse.json({ success: true })
}
