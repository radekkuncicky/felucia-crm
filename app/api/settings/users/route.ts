import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { checkUserLimit } from '@/lib/checkPlanLimit'
import { logAction } from '@/lib/auditLog'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const users = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, jmeno: true, email: true, role: true, aktivni: true, vytvoreno: true },
    orderBy: { vytvoreno: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const body = await req.json()
  const { jmeno, email, heslo, role } = body

  if (!jmeno || !email || !heslo) {
    return NextResponse.json({ error: 'Jméno, email a heslo jsou povinné' }, { status: 400 })
  }

  const canAdd = await checkUserLimit(orgId)
  if (!canAdd) {
    return NextResponse.json({
      error: 'PLAN_LIMIT_REACHED',
      message: 'Dosáhli jste limitu uživatelů pro váš plán.',
      upgradeUrl: '/settings/billing',
    }, { status: 403 })
  }

  const exists = await prisma.user.findFirst({ where: { orgId, email } })
  if (exists) return NextResponse.json({ error: 'Email již existuje' }, { status: 400 })

  const hesloHash = await bcrypt.hash(heslo, 12)
  const user = await prisma.user.create({
    data: { orgId, jmeno, email, hesloHash, role: (role as Role) || Role.OBCHODNIK },
    select: { id: true, jmeno: true, email: true, role: true, aktivni: true, vytvoreno: true },
  })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'CREATE',
    typZaznamu: 'User',
    zaznamId: user.id,
    zaznamNazev: `${user.jmeno} (${user.email})`,
    zmeny: { jmeno, email, role: user.role },
  })

  return NextResponse.json(user, { status: 201 })
}
