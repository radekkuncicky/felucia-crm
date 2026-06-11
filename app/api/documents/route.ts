import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = session.user

  const docs = await prisma.document.findMany({
    where: { orgId },
    orderBy: { vytvoreno: 'desc' },
    include: { uploadedBy: { select: { jmeno: true } } },
  })

  return NextResponse.json(docs.map(d => ({
    id: d.id,
    nazev: d.nazev,
    originalName: d.originalName,
    velikost: d.velikost.toString(),
    mimeType: d.mimeType,
    cesta: d.cesta,
    popis: d.popis,
    vytvoreno: d.vytvoreno.toISOString(),
    uploadedBy: d.uploadedBy.jmeno,
  })))
}
