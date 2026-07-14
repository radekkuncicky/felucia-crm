import type { PrismaClient } from '@prisma/client'
import { createNotification } from '../lib/createNotification'
import { decryptSecret } from '../lib/secretCrypto'
import { isOrgEmailConfigured, sendOrgEmail, emailPodpisPripominka } from '../lib/email'
import { formatDate } from '../lib/format'

const PRIPOMINKA_PO_DNECH = 3

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

/**
 * Jednorázová e-mailová připomínka klientovi: smlouva odeslaná před
 * PRIPOMINKA_PO_DNECH dny je pořád nepodepsaná a klient ji ani nezobrazil
 * po ověření. Odkaz v e-mailu je tentýž (token dešifrovaný z tokenEnc).
 */
export async function sweepPripominkyPodpisu(prisma: PrismaClient): Promise<number> {
  const hranice = new Date(Date.now() - PRIPOMINKA_PO_DNECH * 24 * 3600_000)
  const cekajici = await prisma.sodPodpisRelace.findMany({
    where: {
      stav: 'AKTIVNI',
      vytvoreno: { lt: hranice },
      tokenEnc: { not: null },
      sod: { stav: 'ODESLANO' },
    },
    select: {
      id: true, orgId: true, sodId: true, email: true, tokenEnc: true, expirace: true,
      sod: {
        select: {
          cislo: true, klientJmeno: true,
          organization: { select: { nazev: true, slug: true } },
        },
      },
    },
  })

  let odeslano = 0
  for (const r of cekajici) {
    const uzPripomenuto = await prisma.sodUdalost.count({
      where: { relaceId: r.id, typ: 'PRIPOMINKA' },
    })
    if (uzPripomenuto > 0) continue
    // bez nastaveného odesílání to zkusíme zase příští hodinu
    if (!(await isOrgEmailConfigured(r.orgId))) continue

    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: r.orgId },
      select: { primaryColor: true },
    })
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
    try {
      const token = decryptSecret(r.tokenEnc!)
      await sendOrgEmail(
        r.orgId,
        r.email,
        `Připomínka: smlouva č. ${r.sod.cislo} čeká na podpis — ${r.sod.organization.nazev}`,
        emailPodpisPripominka({
          orgNazev: r.sod.organization.nazev,
          primaryColor: settings?.primaryColor ?? '#4CAF50',
          klientJmeno: r.sod.klientJmeno,
          cisloSmlouvy: r.sod.cislo,
          url: `https://${r.sod.organization.slug}.${rootDomain}/podpis/${token}`,
          platnostDo: formatDate(r.expirace),
        })
      )
    } catch (e) {
      console.error(`[podpisy] připomínka relace ${r.id} selhala:`, e instanceof Error ? e.message : e)
      continue
    }
    await prisma.sodUdalost.create({
      data: { orgId: r.orgId, sodId: r.sodId, relaceId: r.id, typ: 'PRIPOMINKA' },
    })
    odeslano++
  }
  return odeslano
}
