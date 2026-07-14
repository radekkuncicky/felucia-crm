import type { PrismaClient } from '@prisma/client'
import { createNotification } from '../lib/createNotification'

/**
 * Sweep prošlých podpisových relací (odkazy k online podpisu smluv).
 * Doplněk k lazy expiraci při otevření odkazu — pokryje relace, které klient
 * nikdy neotevřel, aby smlouva nevisela v ODESLANO donekonečna.
 * Worker jede pod owner rolí (bare prisma), stejně jako připomínky.
 */
export async function sweepExpirovanePodpisy(prisma: PrismaClient): Promise<number> {
  const prosle = await prisma.sodPodpisRelace.findMany({
    where: { stav: 'AKTIVNI', expirace: { lt: new Date() } },
    select: {
      id: true, orgId: true, sodId: true, odeslalId: true,
      sod: { select: { cislo: true, stav: true, dealId: true } },
    },
  })

  for (const r of prosle) {
    await prisma.$transaction(async tx => {
      await tx.sodPodpisRelace.update({ where: { id: r.id }, data: { stav: 'EXPIROVANA' } })
      if (r.sod.stav === 'ODESLANO') {
        await tx.sod.update({ where: { id: r.sodId }, data: { stav: 'EXPIROVANO' } })
      }
      await tx.sodUdalost.create({
        data: { orgId: r.orgId, sodId: r.sodId, relaceId: r.id, typ: 'EXPIROVANO' },
      })
    })
    if (r.odeslalId) {
      await createNotification({
        orgId: r.orgId,
        userId: r.odeslalId,
        typ: 'SOD_EXPIROVANA',
        zprava: `Odkaz k podpisu smlouvy ${r.sod.cislo} expiroval — klient nepodepsal`,
        dealId: r.sod.dealId,
        url: `/sod/${r.sodId}`,
      })
    }
  }

  return prosle.length
}
