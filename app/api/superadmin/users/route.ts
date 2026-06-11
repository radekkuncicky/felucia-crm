import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // SECURITY FIX: Explicitly select fields to exclude hesloHash from the response
  const users = await prisma.user.findMany({
    orderBy: [{ lastLoginAt: 'desc' }, { vytvoreno: 'desc' }],
    select: {
      id: true,
      jmeno: true,
      email: true,
      role: true,
      aktivni: true,
      orgId: true,
      lastLoginAt: true,
      vytvoreno: true,
      organization: { select: { nazev: true, plan: true } },
    },
  })

  return NextResponse.json(users)
}
