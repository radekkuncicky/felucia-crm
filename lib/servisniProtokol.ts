import { orgPrisma } from '@/lib/orgPrisma'
import { generateServisniProtokolHtml } from '@/lib/servisniProtokolHtml'
import { generatePdf } from '@/lib/pdf'
import { buildDokumentChrome } from '@/lib/dokumentyChrome'
import { orgLogoDataUrl } from '@/lib/quoteRenderer'
import { getOrgSettings } from '@/lib/orgSettings'
import { isOrgEmailConfigured, sendOrgEmail, emailServisniProtokolKlientovi } from '@/lib/email'
import { checkRateLimit } from '@/lib/rateLimit'
import { formatDate } from '@/lib/format'

const KLIENT_SELECT = {
  jmeno: true, prijmeni: true, telefon: true, email: true, ulice: true, mesto: true, psc: true,
} as const

/**
 * Servisní protokol jako PDF — sdílené pro stažení (web), odeslání klientovi
 * e-mailem (web i mobil). `scope` = servisScopeWhere oprávnění volajícího
 * (technik s VLASTNI vidí jen své zakázky); null scope řeší volající (403).
 */
export async function renderServisniProtokol(
  orgId: string,
  plan: string,
  id: string,
  scope: Record<string, unknown>,
) {
  const db = orgPrisma(orgId)
  const z = await db.servisniZakazka.findFirst({
    where: { id, orgId, ...scope },
    include: {
      technik: { select: { jmeno: true } },
      zarizeni: {
        select: { nazev: true, typ: true, vyrobniCislo: true, datumInstalace: true, zarukaDo: true },
      },
      klient: { select: KLIENT_SELECT },
      // Zakázky ze servisní smlouvy mají klienta často jen na kontraktu (stejně jako detail)
      kontrakt: { select: { klient: { select: KLIENT_SELECT } } },
      polozky: {
        orderBy: { poradi: 'asc' },
        select: { typ: true, popis: true, mnozstvi: true, jednotka: true, krytoKontraktem: true },
      },
    },
  })
  if (!z) return null
  const klient = z.klient ?? z.kontrakt?.klient ?? null

  const [org, settings, chrome] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true, logo: true },
    }),
    getOrgSettings(orgId),
    buildDokumentChrome(orgId, plan),
  ])
  if (!org) return null

  // Logo jako data URL - relativní cesta se v hardened PDF (síť jen fonty) nenačte.
  const html = generateServisniProtokolHtml(z, z.zarizeni, klient, {
    ...org,
    logo: orgLogoDataUrl(org.logo),
    primaryColor: settings.primaryColor,
  })
  const pdf = await generatePdf(html, chrome)

  const cislo = z.cislo ?? z.id.slice(0, 8).toUpperCase()
  const prijmeni = klient?.prijmeni ? `-${asciiSlug(klient.prijmeni)}` : ''
  return {
    pdf,
    filename: `Servisni-protokol-${asciiSlug(cislo)}${prijmeni}.pdf`,
    zakazka: z,
    klient,
    orgNazev: org.nazev,
    orgEmail: org.email,
    primaryColor: settings.primaryColor,
  }
}

/** Bezpečný název souboru (hlavička Content-Disposition, přílohy) */
function asciiSlug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

export type OdeslatProtokolResult =
  | { ok: true; to: string; protokolOdeslan: Date }
  | { ok: false; status: number; error: string }

/**
 * Odešle servisní protokol klientovi (PDF v příloze) a zapíše protokolOdeslan + audit.
 * Výchozí adresa = e-mail klienta (zakázky nebo kontraktu). Jde i bez podpisu klienta.
 * Oprávnění (plán, scope) ověřuje volající route.
 */
export async function odeslatServisniProtokol(params: {
  orgId: string
  plan: string
  userId: string
  id: string
  scope: Record<string, unknown>
  to?: unknown
  zprava?: unknown
}): Promise<OdeslatProtokolResult> {
  const { orgId, plan, userId, id, scope } = params
  if (!(await isOrgEmailConfigured(orgId))) {
    return { ok: false, status: 422, error: 'Odesílání e-mailů není nastaveno. Nastavte SMTP v Nastavení → E-mail.' }
  }
  const rl = checkRateLimit(`servis-protokol-email:${userId}`, 30, 60 * 60 * 1000)
  if (rl.limited) return { ok: false, status: 429, error: 'Příliš mnoho odeslaných e-mailů, zkuste to později.' }

  const zprava = typeof params.zprava === 'string' && params.zprava.trim() ? params.zprava.trim().slice(0, 2000) : null

  let res
  try {
    res = await renderServisniProtokol(orgId, plan, id, scope)
  } catch (err) {
    console.error('[servis-protokol-odeslat] pdf error:', err)
    return { ok: false, status: 500, error: 'Chyba při generování PDF.' }
  }
  if (!res) return { ok: false, status: 404, error: 'Not found' }
  const z = res.zakazka

  const to = (typeof params.to === 'string' && params.to.trim()) || res.klient?.email
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, status: 400, error: 'Klient nemá e-mail — zadejte adresu ručně.' }
  }

  const cislo = z.cislo ?? z.id.slice(0, 8).toUpperCase()
  const datum = z.skutecnyTermin ?? z.planovanyTermin
  try {
    const html = emailServisniProtokolKlientovi({
      orgNazev: res.orgNazev,
      primaryColor: res.primaryColor,
      cislo,
      datumZasahu: datum ? formatDate(datum) : null,
      zarizeni: z.zarizeni?.nazev ?? null,
      zprava,
      odpovedEmail: res.orgEmail,
    })
    await sendOrgEmail(orgId, to, `Servisní protokol ${cislo} — ${res.orgNazev}`, html, [{ filename: res.filename, content: res.pdf }])
  } catch (err) {
    console.error('[servis-protokol-odeslat] error:', err)
    return { ok: false, status: 502, error: 'E-mail se nepodařilo odeslat. Zkontrolujte SMTP nastavení.' }
  }

  const db = orgPrisma(orgId)
  const protokolOdeslan = new Date()
  await db.$transaction([
    db.servisniZakazka.update({ where: { id: z.id }, data: { protokolOdeslan, protokolOdeslanNa: to } }),
    db.auditLog.create({
      data: { orgId, userId, typAkce: 'UPDATE', typZaznamu: 'ServisniZakazka', zaznamId: z.id, zaznamNazev: cislo, zmeny: { protokolOdeslanNa: to } },
    }),
  ])
  return { ok: true, to, protokolOdeslan }
}
