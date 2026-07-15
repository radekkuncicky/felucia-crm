import { Prisma, SodStav } from '@prisma/client'
import { orgPrisma } from './orgPrisma'
import { generateToken, sha256, logSodUdalost, PODPIS_RELACE_DNI } from './sodPodpis'
import { encryptSecret } from './secretCrypto'
import { buildSodContentHtml, SodHtmlInput } from './sodHtml'
import { sendOrgEmail, emailPodpisSmlouvy } from './email'
import { getOrgSettings } from './orgSettings'

export type SodProOdeslani = SodHtmlInput & {
  id: string
  dealId: string
  stav: SodStav
  podpisZadost: Prisma.JsonValue
  organization: SodHtmlInput['organization'] & { slug: string }
}

export type OdeslaniVysledek =
  | { ok: true; expirace: Date }
  | { ok: false; error: string }

/**
 * Odeslání smlouvy klientovi k podpisu: snapshot verze (vč. platného interního
 * podpisu zhotovitele), podpisová relace a e-mail s odkazem. Když e-mail
 * neodejde, vrátí vše do původního stavu. Sdílené mezi ručním odesláním
 * a auto-odesláním po interním podpisu zmocněnce.
 */
export async function odeslatSodKlientovi(params: {
  sod: SodProOdeslani
  orgId: string
  email: string
  telefon: string
  odeslalId: string
  req?: Request
}): Promise<OdeslaniVysledek> {
  const { sod, orgId, email, telefon, odeslalId, req } = params
  const db = orgPrisma(orgId)

  // Snapshot přesně toho, co klient uvidí a podepíše
  const contentHtml = buildSodContentHtml(sod)

  const token = generateToken()
  const puvodniStav = sod.stav
  const puvodniZadost = sod.podpisZadost
  const expirace = new Date(Date.now() + PODPIS_RELACE_DNI * 24 * 3600_000)

  const relace = await db.$transaction(async tx => {
    // starý odkaz přestává platit — vždy je aktivní max. jedna relace
    await tx.sodPodpisRelace.updateMany({
      where: { sodId: sod.id, stav: 'AKTIVNI' },
      data: { stav: 'ZNEPLATNENA' },
    })
    const posledni = await tx.sodVerze.findFirst({
      where: { sodId: sod.id },
      orderBy: { cislo: 'desc' },
      select: { cislo: true },
    })
    const verze = await tx.sodVerze.create({
      data: {
        orgId,
        sodId: sod.id,
        cislo: (posledni?.cislo ?? 0) + 1,
        textSmlouvy: contentHtml,
        vytvorilId: odeslalId,
      },
    })
    const relace = await tx.sodPodpisRelace.create({
      data: {
        orgId,
        sodId: sod.id,
        verzeId: verze.id,
        tokenHash: sha256(token),
        tokenEnc: encryptSecret(token),
        email,
        telefon,
        expirace,
        odeslalId,
      },
    })
    await tx.sod.update({
      where: { id: sod.id },
      data: { stav: 'ODESLANO', podpisZadost: Prisma.DbNull },
    })
    return relace
  })

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const url = `https://${sod.organization.slug}.${rootDomain}/podpis/${token}`
  const settings = await getOrgSettings(orgId)

  try {
    await sendOrgEmail(
      orgId,
      email,
      `Smlouva č. ${sod.cislo} k podpisu — ${sod.organization.nazev}`,
      emailPodpisSmlouvy({
        orgNazev: sod.organization.nazev,
        primaryColor: settings.primaryColor,
        klientJmeno: sod.klientJmeno,
        cisloSmlouvy: sod.cislo,
        url,
        platnostDni: PODPIS_RELACE_DNI,
      })
    )
  } catch (e) {
    // e-mail nedorazil → relaci zrušit a vrátit původní stav, ať UI nelže
    await db.sodPodpisRelace.update({ where: { id: relace.id }, data: { stav: 'ZNEPLATNENA' } })
    await db.sod.update({
      where: { id: sod.id },
      data: { stav: puvodniStav, podpisZadost: puvodniZadost ?? Prisma.DbNull },
    })
    const msg = e instanceof Error ? e.message : 'neznámá chyba'
    return { ok: false, error: `E-mail se nepodařilo odeslat: ${msg}` }
  }

  await logSodUdalost({
    orgId, sodId: sod.id, typ: 'ODESLANO', relaceId: relace.id,
    userId: odeslalId, meta: { email, telefon }, req,
  })

  return { ok: true, expirace }
}
