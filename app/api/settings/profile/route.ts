import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { logAction } from '@/lib/auditLog'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await orgPrisma(session.user.orgId).user.findUnique({
    where: { id: session.user.id },
    select: { id: true, jmeno: true, email: true, telefon: true, role: true, avatar: true, vytvoreno: true,
      organization: { select: { nazev: true } } },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jmeno, email, telefon, currentPassword } = await req.json()
  const db = orgPrisma(session.user.orgId)
  const current = await db.user.findFirst({ where: { id: session.user.id }, select: { email: true, hesloHash: true } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const emailChange = typeof email === 'string' && email.trim().toLowerCase() !== current.email.toLowerCase()
  if (emailChange) {
    // E-mail = přihlašovací identita; bez ověření hesla by ho měnil kdokoli s otevřenou session
    if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, current.hesloHash))) {
      return NextResponse.json({ error: 'Pro změnu e-mailu zadejte aktuální heslo', code: 'PASSWORD_REQUIRED' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Neplatný e-mail' }, { status: 400 })
    const exists = await db.user.findFirst({
      where: { orgId: session.user.orgId, email, NOT: { id: session.user.id } },
    })
    if (exists) return NextResponse.json({ error: 'Email je již použit' }, { status: 400 })
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: { jmeno: jmeno ?? undefined, email: emailChange ? email.trim() : undefined, telefon: telefon ?? undefined },
    select: { id: true, jmeno: true, email: true, telefon: true, role: true, avatar: true },
  })
  if (emailChange) {
    await logAction({
      orgId: session.user.orgId, userId: session.user.id, typAkce: 'UPDATE', typZaznamu: 'User',
      zaznamId: session.user.id, zaznamNazev: `${updated.jmeno} (${updated.email})`,
      zmeny: { email: { z: current.email, na: updated.email } },
    })
  }
  return NextResponse.json(updated)
}
