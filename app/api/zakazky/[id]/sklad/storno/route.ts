import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listUsersWithPermValue } from '@/lib/zakazkyHelpers'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { polozkaId, duvod } = await req.json()

  if (!polozkaId || !duvod) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  const polozka = await db.zakazkaPolozka.findFirst({
    where: { id: polozkaId, zakazkaId: params.id, zakazka: { orgId } },
  })
  if (!polozka) return NextResponse.json({ error: 'Položka nenalezena' }, { status: 404 })

  // Notifikovat všechny s plným přístupem ke skladu (příjem/storno)
  const skladUsers = await listUsersWithPermValue(orgId, 'sklad', 'PLNY')

  await db.$transaction([
    db.skladPohyb.create({
      data: {
        orgId,
        zakazkaId: params.id,
        polozkaId,
        typ: 'STORNO',
        nazev: polozka.nazev,
        mnozstvi: polozka.mnozstvi,
        duvod,
        vytvorilId: session.user.id,
      },
    }),
    db.zakazkaPolozka.update({
      where: { id: polozkaId },
      data: { stav: 'CEKA' },
    }),
    db.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'ZakazkaPolozka',
        zaznamId: polozkaId,
        zaznamNazev: polozka.nazev,
        zmeny: { stav: 'CEKA', storno: true, duvod },
      },
    }),
    ...skladUsers.map(u => db.notification.create({
      data: {
        orgId,
        userId: u.id,
        typ: 'STORNO_REZERVACE',
        zprava: `Storno rezervace položky "${polozka.nazev}" v zakázce. Důvod: ${duvod}`,
      },
    })),
  ])

  return NextResponse.json({ ok: true })
}
