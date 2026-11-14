import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { vratZakazkuZPredane } from '@/lib/zakazkaStavFlow'
import { ZakazkaStav } from '@prisma/client'
import { getPerms, forbidden } from '@/lib/permissions'
import { sendPushToUsers } from '@/lib/push'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!getPerms(session.user).zakazkySchvalovani) return forbidden()

  const { duvod } = await req.json()
  if (!duvod?.trim()) return NextResponse.json({ error: 'Důvod odmítnutí je povinný' }, { status: 400 })

  const predavak = await db.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (predavak.stav !== 'PODPISAN') {
    return NextResponse.json({ error: 'Lze odmítnout pouze podepsaný protokol' }, { status: 422 })
  }

  let zakazkaNovyStav: ZakazkaStav | null = null

  await db.$transaction(async tx => {
    await tx.predavak.update({
      where: { id: params.id },
      data: { stav: 'ODMITNUTO', odmitnutoDuvod: duvod },
    })

    // Podpis protokolu zakázku posunul na PREDANA — odmítnutím ji vrať zpět do realizace
    zakazkaNovyStav = await vratZakazkuZPredane(tx, predavak.zakazkaId, params.id)

    await tx.notification.create({
      data: {
        orgId,
        userId: predavak.technikId,
        typ: 'PREDAVAK_ODMITNUTO',
        zprava: `Protokol ${predavak.cislo} byl odmítnut: ${duvod}`,
        url: `/zakazky/${predavak.zakazkaId}/predavaky/${predavak.id}`,
      },
    })

    await tx.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Predavak',
        zaznamId: params.id,
        zaznamNazev: predavak.cislo,
        zmeny: { stavPred: 'PODPISAN', stavPo: 'ODMITNUTO', duvod, zakazkaNovyStav },
      },
    })
  })

  // Technik je v terénu s appkou — bell na webu by neviděl (audit APP_TECHNIK J)
  void sendPushToUsers(orgId, [predavak.technikId], {
    title: 'Předávák vrácen k opravě',
    body: `${predavak.cislo}: ${String(duvod).trim().slice(0, 140)}`,
    data: { type: 'zakazka', zakazkaId: predavak.zakazkaId },
  })

  return NextResponse.json({ ok: true, zakazkaNovyStav })
}
