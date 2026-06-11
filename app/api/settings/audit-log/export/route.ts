import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const logs = await prisma.auditLog.findMany({
    where: { orgId },
    include: { user: { select: { jmeno: true } } },
    orderBy: { vytvoreno: 'desc' },
    take: 5000,
  })

  const header = 'Datum,Uživatel,Typ akce,Typ záznamu,Záznam\n'
  const rows = logs.map(l =>
    [
      new Date(l.vytvoreno).toLocaleString('cs-CZ'),
      l.user?.jmeno ?? 'Systém',
      l.typAkce,
      l.typZaznamu,
      `"${l.zaznamNazev.replace(/"/g, '""')}"`,
    ].join(',')
  ).join('\n')

  return new NextResponse(header + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-log.csv"',
    },
  })
}
