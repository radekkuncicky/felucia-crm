import { orgPrisma } from './orgPrisma'
import { getPodpisyAccess, PODPISY_MESICNI_LIMIT } from './modulPodpisy'
import { isSmsConfigured, normalizeTelefon } from './sms'
import { isOrgEmailConfigured, sendOrgEmail, emailPodpisVyzadan } from './email'
import { getOrgSettings } from './orgSettings'
import { sha256, logSodUdalost } from './sodPodpis'
import { buildSodBaseHtml } from './sodHtml'
import { odeslatSodKlientovi } from './sodOdeslani'
import { createNotification } from './createNotification'

export type OdeslatSodFlowVysledek =
  | { error: string; status: number }
  | { ok: true; email: string; telefon: string; expirace: Date }
  | { ok: true; cekaNaPodpis: true; zmocnenci: string[] }

/**
 * Kompletní tok odeslání smlouvy k podpisu — sdílený mezi webem
 * (/api/sod/[id]/odeslat) a mobilem (/api/mobile/obchod/sod/[id]/odeslat).
 * Smlouvu musí nejdřív podepsat zmocněnec (User.podepisujeSmlouvy):
 *   1. platný interní podpis → rovnou klientovi
 *   2. odesílá zmocněnec s podpisem v body → podepíše v jednom kroku a odešle
 *   3. jinak → žádost o interní podpis (bell + e-mail zmocněncům),
 *      po podpisu se smlouva odešle klientovi automaticky
 */
export async function odeslatSodFlow(params: {
  orgId: string
  userId: string
  plan: string
  sodId: string
  email?: string
  telefon?: string
  podpisSvg?: string
  req?: Request
}): Promise<OdeslatSodFlowVysledek> {
  const { orgId, userId, sodId, req } = params

  const pristup = await getPodpisyAccess(orgId, params.plan)
  if (!pristup.allowed) {
    if (pristup.zdroj === 'MODUL') {
      return {
        error: `Měsíční limit modulu (${PODPISY_MESICNI_LIMIT} odeslaných smluv) je vyčerpán — obnoví se 1. den dalšího měsíce`,
        status: 403,
      }
    }
    return {
      error: pristup.muzeAktivovatModul
        ? 'Aktivujte si modul Online podpis ve Fakturaci, nebo přejděte na plán PROFESSIONAL'
        : 'Online podpis smluv je dostupný v plánu PROFESSIONAL a vyšším',
      status: 403,
    }
  }
  if (!isSmsConfigured()) {
    return { error: 'SMS brána není nakonfigurována — online podpis zatím nelze použít', status: 422 }
  }
  if (!(await isOrgEmailConfigured(orgId))) {
    return { error: 'Nejprve nastavte odesílání e-mailů v Nastavení → Odesílání e-mailů', status: 422 }
  }

  const db = orgPrisma(orgId)
  const sod = await db.sod.findFirst({
    where: { id: sodId, orgId },
    include: {
      organization: {
        select: {
          nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true,
          plan: true, slug: true,
          prilohaVopPath: true, prilohaVzspPath: true, prilohaCenikPath: true,
        },
      },
    },
  })
  if (!sod) return { error: 'Smlouva nenalezena', status: 404 }
  if (sod.stav === 'PODEPSANO') {
    return { error: 'Smlouva už je podepsaná', status: 422 }
  }

  const email = String(params.email ?? sod.klientEmail ?? '').trim()
  const telefonRaw = String(params.telefon ?? sod.klientTelefon ?? '').trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Neplatný e-mail klienta', status: 422 }
  }
  const telefon = normalizeTelefon(telefonRaw)
  if (!telefon) {
    return { error: 'Neplatné české mobilní číslo — na něj přijde ověřovací kód', status: 422 }
  }

  // Za zhotovitele musí smlouvu podepsat zmocněnec — bez něj se neodesílá
  const zmocnenci = await db.user.findMany({
    where: { orgId, aktivni: true, podepisujeSmlouvy: true },
    select: { id: true, jmeno: true, email: true },
  })
  if (zmocnenci.length === 0) {
    return {
      error: 'Nejprve v Nastavení → Uživatelé určete, kdo za firmu podepisuje smlouvy',
      status: 422,
    }
  }

  const baseHash = sha256(buildSodBaseHtml(sod))
  const maPlatnyPodpis = !!sod.zhotovitelPodepsano && sod.zhotovitelTextHash === baseHash
  const jeZmocnenec = zmocnenci.some(z => z.id === userId)

  // 2) odesílá zmocněnec bez platného podpisu → podepíše v jednom kroku
  if (!maPlatnyPodpis && jeZmocnenec) {
    const podpisSvg = typeof params.podpisSvg === 'string' ? params.podpisSvg : ''
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(podpisSvg) || podpisSvg.length > 500_000) {
      return { error: 'Chybí podpis — podepište smlouvu v podpisovém poli', status: 422 }
    }
    const ja = zmocnenci.find(z => z.id === userId)!
    await db.sod.update({
      where: { id: sod.id },
      data: {
        zhotovitelPodpisSvg: podpisSvg,
        zhotovitelPodepsano: new Date(),
        zhotovitelPodepsalJmeno: ja.jmeno,
        zhotovitelPodepsalId: ja.id,
        zhotovitelTextHash: baseHash,
      },
    })
    sod.zhotovitelPodpisSvg = podpisSvg
    sod.zhotovitelPodepsano = new Date()
    sod.zhotovitelPodepsalJmeno = ja.jmeno
    sod.zhotovitelPodepsalId = ja.id
    sod.zhotovitelTextHash = baseHash
    await logSodUdalost({
      orgId, sodId: sod.id, typ: 'PODEPSANO_ZHOTOVITELEM',
      userId: ja.id, meta: { jmeno: ja.jmeno, textHash: baseHash }, req,
    })
  }

  // 1+2) interní podpis existuje → rovnou klientovi
  if (maPlatnyPodpis || jeZmocnenec) {
    const vysledek = await odeslatSodKlientovi({ sod, orgId, email, telefon, odeslalId: userId, req })
    if (!vysledek.ok) return { error: vysledek.error, status: 422 }
    return { ok: true, email, telefon, expirace: vysledek.expirace }
  }

  // 3) odesílá ne-zmocněnec → žádost o interní podpis, klientovi až po něm
  const zadatel = await db.user.findFirst({
    where: { id: userId, orgId },
    select: { jmeno: true },
  })
  const zadatelJmeno = zadatel?.jmeno ?? 'Kolega'

  await db.sod.update({
    where: { id: sod.id },
    data: {
      stav: 'K_INTERNIMU_PODPISU',
      podpisZadost: { email, telefon, userId, jmeno: zadatelJmeno },
    },
  })
  await logSodUdalost({
    orgId, sodId: sod.id, typ: 'PODPIS_VYZADAN',
    userId,
    meta: { email, telefon, zmocnenci: zmocnenci.map(z => z.jmeno) }, req,
  })

  const settings = await getOrgSettings(orgId)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const url = `https://${sod.organization.slug}.${rootDomain}/sod/${sod.id}`
  for (const z of zmocnenci) {
    await createNotification({
      orgId,
      userId: z.id,
      typ: 'SOD_PODPIS_VYZADAN',
      zprava: `${zadatelJmeno} žádá o podpis smlouvy ${sod.cislo} za zhotovitele`,
      dealId: sod.dealId,
      url: `/sod/${sod.id}`,
    })
    await sendOrgEmail(
      orgId, z.email,
      `Smlouva č. ${sod.cislo} čeká na váš podpis`,
      emailPodpisVyzadan({
        orgNazev: sod.organization.nazev,
        primaryColor: settings.primaryColor,
        zmocnenecJmeno: z.jmeno,
        zadatelJmeno,
        cisloSmlouvy: sod.cislo,
        klientJmeno: sod.klientJmeno,
        url,
      })
    ).catch(() => { /* bell notifikace stačí, e-mail je bonus */ })
  }

  return { ok: true, cekaNaPodpis: true, zmocnenci: zmocnenci.map(z => z.jmeno) }
}
