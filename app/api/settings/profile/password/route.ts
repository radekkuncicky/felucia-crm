import { getServerSession } from 'next-auth'
import { invalidatePermsCache } from '@/lib/permsSnapshot'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { current, newPassword } = await req.json()

  if (!current || !newPassword) {
    return NextResponse.json({ error: 'Vyplňte všechna pole' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return NextResponse.json({ error: 'Heslo musí mít alespoň 10 znaků' }, { status: 400 })
  }

  const user = await orgPrisma(session.user.orgId).user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ok = await bcrypt.compare(current, user.hesloHash)
  if (!ok) return NextResponse.json({ error: 'Aktuální heslo není správné' }, { status: 400 })

  const sameAsOld = await bcrypt.compare(newPassword, user.hesloHash)
  if (sameAsOld) return NextResponse.json({ error: 'Nové heslo musí být jiné než aktuální' }, { status: 400 })

  const hesloHash = await bcrypt.hash(newPassword, 12)
  await orgPrisma(session.user.orgId).user.update({ where: { id: session.user.id }, data: { hesloHash, sessionVersion: { increment: 1 } } })
  invalidatePermsCache(session.user.id)

  return NextResponse.json({ ok: true })
}
