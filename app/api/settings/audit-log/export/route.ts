import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { formatDateTime } from '@/lib/format'
import { getPerms } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).analytiky) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const logs = await db.auditLog.findMany({
    where: { orgId },
    include: { user: { select: { jmeno: true } } },
    orderBy: { vytvoreno: 'desc' },
    take: 5000,
  })

  // Každé pole v uvozovkách; hodnoty začínající = + - @ \t \r dostanou apostrof,
  // aby je Excel nevyhodnotil jako vzorec (CSV/formula injection z názvu klienta)
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
    return `"${safe.replace(/"/g, '""')}"`
  }
  const header = 'Datum,Uživatel,Typ akce,Typ záznamu,Záznam\n'
  const rows = logs.map(l =>
    [
      formatDateTime(l.vytvoreno),
      l.user?.jmeno ?? 'Systém',
      l.typAkce,
      l.typZaznamu,
      l.zaznamNazev,
    ].map(cell).join(',')
  ).join('\n')

  return new NextResponse(header + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-log.csv"',
    },
  })
}
