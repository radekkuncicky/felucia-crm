import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { token, newPassword } = await req.json()

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Chybí token nebo heslo' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Heslo musí mít alespoň 8 znaků' }, { status: 400 })
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!record) return NextResponse.json({ error: 'Neplatný odkaz' }, { status: 400 })
  if (record.used) return NextResponse.json({ error: 'Odkaz byl již použit' }, { status: 400 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: 'Odkaz vypršel' }, { status: 400 })

  const hesloHash = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { hesloHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
  ])

  return NextResponse.json({ ok: true })
}
