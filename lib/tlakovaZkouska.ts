import { orgPrisma } from '@/lib/orgPrisma'
import { generatePdf } from '@/lib/pdf'
import { buildDokumentChrome } from '@/lib/dokumentyChrome'
import { orgLogoDataUrl } from '@/lib/quoteRenderer'
import { getOrgSettings } from '@/lib/orgSettings'
import { ulozitPodklad } from '@/lib/zakazkaPodklady'
import { generateTlakovaZkouskaHtml } from '@/lib/tlakovaZkouskaHtml'
import type { TlakovaZkouskaVstup } from '@/lib/tlakovaZkouskaData'
import { formatDate } from '@/lib/format'

function asciiSlug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Vygeneruje PDF protokolu o tlakové zkoušce, uloží ho do Podkladů zakázky
 * (ZakázkaDokument) a vrátí PDF ke stažení. Oprávnění řeší volající route.
 */
export async function vytvoritTlakovouZkousku(orgId: string, plan: string, userId: string, zakazkaId: string, vstup: TlakovaZkouskaVstup) {
  const db = orgPrisma(orgId)
  const z = await db.zakazka.findFirst({
    where: { id: zakazkaId, orgId },
    select: {
      cislo: true, nazev: true, mistoStavby: true,
      klient: { select: { jmeno: true, prijmeni: true, ulice: true, mesto: true, psc: true, telefon: true } },
    },
  })
  if (!z) return null

  const [org, settings, chrome] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true, logo: true },
    }),
    getOrgSettings(orgId),
    buildDokumentChrome(orgId, plan),
  ])
  if (!org) return null

  const html = generateTlakovaZkouskaHtml(vstup, {
    zakazka: { cislo: z.cislo, nazev: z.nazev, mistoStavby: z.mistoStavby },
    klient: z.klient,
    org: { ...org, logo: orgLogoDataUrl(org.logo), primaryColor: settings.primaryColor },
  })
  const pdf = await generatePdf(html, chrome)

  const filename = `Tlakova-zkouska-${asciiSlug(z.cislo)}-${vstup.datum}.pdf`
  const url = await ulozitPodklad(zakazkaId, pdf, filename)
  const dokument = await db.zakázkaDokument.create({
    data: {
      orgId, zakazkaId, url, mime: 'application/pdf', nahralId: userId,
      nazev: `Protokol o tlakové zkoušce ${formatDate(vstup.datum)}.pdf`,
    },
    select: { id: true, nazev: true, url: true },
  })
  return { pdf, filename, dokument }
}
