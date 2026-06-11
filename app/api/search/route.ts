import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const [clients, deals] = await Promise.all([
    prisma.client.findMany({
      where: {
        orgId,
        OR: [
          { jmeno: { contains: q, mode: 'insensitive' } },
          { prijmeni: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { telefon: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, jmeno: true, prijmeni: true, email: true },
    }),
    prisma.deal.findMany({
      where: {
        orgId,
        OR: [
          { kod: { contains: q, mode: 'insensitive' } },
          { predmet: { contains: q, mode: 'insensitive' } },
          { client: { jmeno: { contains: q, mode: 'insensitive' } } },
          { client: { prijmeni: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: 5,
      include: { client: { select: { jmeno: true, prijmeni: true } } },
    }),
  ])

  const results = [
    ...clients.map(c => ({
      type: 'client' as const,
      id: c.id,
      label: `${c.jmeno} ${c.prijmeni}`,
      sub: c.email ?? '',
      href: `/clients/${c.id}`,
    })),
    ...deals.map(d => ({
      type: 'deal' as const,
      id: d.id,
      label: d.predmet ?? d.kod ?? 'Bez názvu',
      sub: `${d.kod ?? ''} · ${d.client.jmeno} ${d.client.prijmeni}`.trim().replace(/^·\s*/, ''),
      href: `/deals/${d.id}`,
    })),
  ]

  return NextResponse.json(results)
}
