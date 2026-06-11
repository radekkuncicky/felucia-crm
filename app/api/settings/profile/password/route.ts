import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { current, newPassword } = await req.json()

  if (!current || !newPassword) {
    return NextResponse.json({ error: 'Vyplňte všechna pole' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Heslo musí mít alespoň 8 znaků' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ok = await bcrypt.compare(current, user.hesloHash)
  if (!ok) return NextResponse.json({ error: 'Aktuální heslo není správné' }, { status: 400 })

  const sameAsOld = await bcrypt.compare(newPassword, user.hesloHash)
  if (sameAsOld) return NextResponse.json({ error: 'Nové heslo musí být jiné než aktuální' }, { status: 400 })

  const hesloHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: session.user.id }, data: { hesloHash } })

  return NextResponse.json({ ok: true })
}
