import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { sendPushToUsers } from '@/lib/push'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { technikId } = await req.json()

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const technik = await db.user.findFirst({ where: { id: technikId, orgId } })
  if (!technik) return NextResponse.json({ error: 'Technik nenalezen' }, { status: 400 })

  const rel = await db.technikZakazka.create({
    data: { zakazkaId: params.id, technikId },
    include: { technik: { select: { id: true, jmeno: true, email: true } } },
  })

  // Auto state: NOVA → PRIRAZENA when first technician is assigned
  if (zakazka.stav === 'NOVA') {
    await db.$transaction([
      db.zakazka.update({
        where: { id: params.id },
        data: { stav: 'PRIRAZENA' },
      }),
      db.auditLog.create({
        data: {
          orgId,
          userId: session.user.id,
          typAkce: 'UPDATE',
          typZaznamu: 'Zakazka',
          zaznamId: params.id,
          zaznamNazev: zakazka.nazev,
          zmeny: { from: 'NOVA', to: 'PRIRAZENA', duvod: 'Přiřazení technika' },
        },
      }),
    ])
  }

  await sendPushToUsers(orgId, [technikId], {
    title: 'Nová zakázka',
    body: `${zakazka.cislo} — ${zakazka.nazev}`,
    data: { type: 'zakazka', zakazkaId: zakazka.id },
  })

  return NextResponse.json({ ...rel, zakazkaNovyStav: zakazka.stav === 'NOVA' ? 'PRIRAZENA' : null }, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { technikId } = await req.json()

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.technikZakazka.deleteMany({
    where: { zakazkaId: params.id, technikId },
  })

  return NextResponse.json({ ok: true })
}
