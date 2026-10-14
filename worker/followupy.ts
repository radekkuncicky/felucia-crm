import type { PrismaClient } from '@prisma/client'
import { createNotification } from '../lib/createNotification'
import { sendPushToUsers } from '../lib/push'
import { NABIDKA_VISI_PO_DNECH } from '../lib/quoteStav'

export const FOLLOWUP_PO_DNECH = NABIDKA_VISI_PO_DNECH

/**
 * Follow-up odeslaných nabídek (procesní mapa 4.1): nabídka je FOLLOWUP_PO_DNECH+
 * dní ve stavu ODESLANA (klient nereagoval, nikdo ji neoznačil jako akceptovanou
 * ani odmítnutou) a OP je pořád otevřený → bell + push vlastníkovi OP, ať se ozve.
 * Tatáž nabídka je v přehledu /quotes?filtr=visi. Jen interně — klientovi nic.
 * Jednorázově — followUpAt na nabídce značí odbavení (nové odeslání ji nuluje).
 * Worker jede pod owner rolí (bare prisma), stejně jako ostatní sweepy.
 */
export async function sweepNabidkyFollowUp(prisma: PrismaClient): Promise<number> {
  const hranice = new Date(Date.now() - FOLLOWUP_PO_DNECH * 24 * 3600_000)

  const nabidky = await prisma.quote.findMany({
    where: {
      stav: 'ODESLANA',
      odeslanoAt: { lt: hranice },
      followUpAt: null,
      deal: { stav: { notIn: ['USPECH', 'PAS', 'ZNEPLATNENO'] } },
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
    const zprava = `Nabídka ${n.kod ?? n.nazev} pro ${klient} visí ${FOLLOWUP_PO_DNECH} dní bez reakce — ozvěte se klientovi`

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
