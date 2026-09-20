import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/auditLog'
import { hashAuthToken } from '@/lib/authTokens'
import { invalidatePermsCache } from '@/lib/permsSnapshot'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { token, newPassword } = await req.json()

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Chybí token nebo heslo' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return NextResponse.json({ error: 'Heslo musí mít alespoň 10 znaků' }, { status: 400 })
  }

  if (typeof token !== 'string') return NextResponse.json({ error: 'Neplatný odkaz' }, { status: 400 })
  // V DB je jen hash tokenu
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: hashAuthToken(token) },
    include: { user: true },
  })

  if (!record) return NextResponse.json({ error: 'Neplatný odkaz' }, { status: 400 })
  if (record.used) return NextResponse.json({ error: 'Odkaz byl již použit' }, { status: 400 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: 'Odkaz vypršel' }, { status: 400 })

  const hesloHash = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { hesloHash, sessionVersion: { increment: 1 } } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
  ])
  invalidatePermsCache(record.userId)
  await logAction({
    orgId: record.user.orgId, userId: record.userId, typAkce: 'UPDATE', typZaznamu: 'User',
    zaznamId: record.userId, zaznamNazev: `${record.user.jmeno} (${record.user.email})`, zmeny: { akce: 'reset-hesla' },
  })

  return NextResponse.json({ ok: true })
}
