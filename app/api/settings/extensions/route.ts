import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const { nazev, aktivni, apiKlic } = await req.json()

  const ext = await prisma.extension.upsert({
    where: { orgId_nazev: { orgId, nazev } },
    update: { aktivni, apiKlic: apiKlic || null },
    create: { orgId, nazev, aktivni, apiKlic: apiKlic || null },
  })
  return NextResponse.json(ext)
}
