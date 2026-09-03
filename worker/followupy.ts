import type { PrismaClient } from '@prisma/client'
import { createNotification } from '../lib/createNotification'
import { sendPushToUsers } from '../lib/push'

export const FOLLOWUP_PO_DNECH = 3

/**
 * Follow-up odeslaných nabídek (Felucia Sales): nabídka odešla klientovi
 * před FOLLOWUP_PO_DNECH+ dny, OP je pořád v rané fázi pipeline (klient
 * nereagoval, obchodník stav neposunul) → bell + push obchodníkovi, ať se
 * ozve. Jednorázově — followUpAt na nabídce značí odbavení.
 * Worker jede pod owner rolí (bare prisma), stejně jako ostatní sweepy.
 */
export async function sweepNabidkyFollowUp(prisma: PrismaClient): Promise<number> {
  const hranice = new Date(Date.now() - FOLLOWUP_PO_DNECH * 24 * 3600_000)

  const nabidky = await prisma.quote.findMany({
    where: {
      odeslanoAt: { lt: hranice },
      followUpAt: null,
      deal: { stav: { in: ['NOVY', 'JEDNANI', 'NABIDKA'] } },
    },
    select: {
      id: true, orgId: true, kod: true, nazev: true, odeslanoKanal: true,
      deal: { select: { id: true, kod: true, userId: true, client: { select: { jmeno: true, prijmeni: true } } } },
    },
    take: 200,
  })

  let odeslano = 0
  for (const n of nabidky) {
    // Značka vždy — i bez vlastníka OP se ke stejné nabídce nevracet
    await prisma.quote.update({ where: { id: n.id }, data: { followUpAt: new Date() } })
    if (!n.deal.userId) continue

    const klient = `${n.deal.client.jmeno} ${n.deal.client.prijmeni ?? ''}`.trim()
    const zprava = `Nabídka ${n.kod ?? n.nazev} pro ${klient} je ${FOLLOWUP_PO_DNECH} dny bez reakce — ozvěte se klientovi`

    await createNotification({
      orgId: n.orgId,
      userId: n.deal.userId,
      typ: 'NABIDKA_FOLLOWUP',
      zprava,
      dealId: n.deal.id,
    })
    await sendPushToUsers(n.orgId, [n.deal.userId], {
      title: 'Follow-up nabídky',
      body: zprava,
      data: { type: 'pripad', pripadId: n.deal.id },
    })
    odeslano += 1
  }

  return odeslano
}
