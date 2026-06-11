import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
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

  const { jmeno, email, telefon } = await req.json()

  if (email && email !== session.user.email) {
    const exists = await prisma.user.findFirst({
      where: { orgId: session.user.orgId, email, NOT: { id: session.user.id } },
    })
    if (exists) return NextResponse.json({ error: 'Email je již použit' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { jmeno: jmeno ?? undefined, email: email ?? undefined, telefon: telefon ?? undefined },
    select: { id: true, jmeno: true, email: true, telefon: true, role: true, avatar: true },
  })
  return NextResponse.json(updated)
}
