import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { Technologie, StavDealu } from '@prisma/client'
import { checkDealLimit } from '@/lib/checkPlanLimit'
import { logAction } from '@/lib/auditLog'
import { createNotification } from '@/lib/createNotification'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const kodFilter = searchParams.get('kod')
  const qFilter = searchParams.get('q')
  const zobrazitZneplatnene = searchParams.get('zobrazitZneplatnene') === 'true'

  // Single-record lookup by UUID or OP code (used by AI assistant)
  if (qFilter) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(qFilter)
    const deal = await db.deal.findFirst({
      where: { orgId, ...(isUuid ? { id: qFilter } : { kod: qFilter }) },
      select: { id: true, kod: true, predmet: true },
    })
    if (!deal) return NextResponse.json({ error: `Deal ${qFilter} not found` }, { status: 404 })
    return NextResponse.json(deal)
  }

  const deals = await db.deal.findMany({
    where: {
      orgId,
      ...(kodFilter ? { kod: kodFilter } : {}),
      ...(!kodFilter && !zobrazitZneplatnene ? { stav: { not: 'ZNEPLATNENO' } } : {}),
      ...(!kodFilter && search
        ? {
            OR: [
              { predmet: { contains: search, mode: 'insensitive' } },
              { kod: { contains: search, mode: 'insensitive' } },
              { client: { jmeno: { contains: search, mode: 'insensitive' } } },
              { client: { prijmeni: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: { id: true, predmet: true, kod: true, client: { select: { jmeno: true, prijmeni: true } } },
    orderBy: { vytvoreno: 'desc' },
    take: 50,
  })

  return NextResponse.json(deals)
}

async function generateKod(orgId: string): Promise<string> {
  const yr = new Date().getFullYear()
  const yrShort = yr % 100
  const prefix = `OP-${yrShort.toString().padStart(2, '0')}-`
  const last = await orgPrisma(orgId).deal.findFirst({
    where: { orgId, kod: { startsWith: prefix } },
    orderBy: { kod: 'desc' },
    select: { kod: true },
  })
  const lastNum = last?.kod ? parseInt(last.kod.replace(prefix, ''), 10) : 0
  return `${prefix}${(lastNum + 1).toString().padStart(3, '0')}`
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const userId = session.user.id

  const body = await req.json()
  const { clientId, technologie, predmet } = body

  if (!clientId || !technologie) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  const canCreate = await checkDealLimit(orgId)
  if (!canCreate) {
    return NextResponse.json({
      error: 'PLAN_LIMIT_REACHED',
      message: 'Dosáhli jste limitu obchodních případů pro váš plán. Upgradujte na Premium pro neomezený počet.',
      upgradeUrl: '/settings/billing',
    }, { status: 403 })
  }

  const kod = await generateKod(orgId)

  const deal = await db.deal.create({
    data: {
      orgId,
      clientId,
      userId,
      kod,
      technologie: technologie as Technologie,
      stav: StavDealu.NOVY,
      predmet: predmet || null,
    },
  })

  if (deal.userId && deal.userId !== userId) {
    const client = await db.client.findFirst({ where: { id: clientId }, select: { jmeno: true } })
    await createNotification({
      orgId,
      userId: deal.userId,
      typ: 'NOVY_OP',
      zprava: `Nový OP přiřazen: ${deal.kod} · ${client?.jmeno ?? ''}`,
      dealId: deal.id,
    })
  }

  await logAction({
    orgId,
    userId,
    typAkce: 'CREATE',
    typZaznamu: 'Deal',
    zaznamId: deal.id,
    zaznamNazev: `${deal.kod ?? ''} ${deal.predmet ?? 'Nový případ'}`.trim(),
    zmeny: { kod: deal.kod, predmet: deal.predmet, technologie: deal.technologie },
  })

  return NextResponse.json(deal, { status: 201 })
}
