import { prisma } from './prisma'
import { getOrgSettings } from './orgSettings'
import { getPlanLimits } from './planLimits'
import { orgLogoDataUrl } from './quoteRenderer'
import { sanitizeDocumentHtml } from './sanitizeHtml'
import { formatDate } from '@/lib/format'

/**
 * Záhlaví/patička PDF dokumentů (puppeteer displayHeaderFooter).
 * Styl per org v OrgSettings.dokumentyStyl: LINKA | PRUH | VLASTNI | ZADNY.
 * VLASTNI (vlastní HTML s placeholdery) jen pro plány s hasWhiteLabel.
 *
 * Pozn. k puppeteer šablonám: jen inline styly, žádné externí zdroje
 * (logo musí být data URL), výchozí font-size je ~0 → vždy nastavit.
 */

export type DokumentChrome = {
  headerTemplate: string
  footerTemplate: string
  marginTop: string
  marginBottom: string
}

// Placeholdery dostupné ve vlastním HTML záhlaví/patičce (dokumentace v UI)
export const CHROME_PLACEHOLDERS: [string, string][] = [
  ['{{logo}}', 'logo organizace (obrázek)'],
  ['{{organizace}}', 'název organizace'],
  ['{{org_ico}}', 'IČO'],
  ['{{org_dic}}', 'DIČ'],
  ['{{org_sidlo}}', 'sídlo'],
  ['{{org_email}}', 'e-mail'],
  ['{{org_telefon}}', 'telefon'],
  ['{{org_web}}', 'web'],
  ['{{barva}}', 'brand barva (hex)'],
  ['{{strana}}', 'číslo aktuální stránky'],
  ['{{stran_celkem}}', 'celkový počet stránek'],
  ['{{datum}}', 'dnešní datum'],
]

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type DokumentChromeOverrides = Partial<{
  dokumentyStyl: string
  dokumentyPaticka: string | null
  dokumentyCislovani: boolean
  dokumentyHeaderHtml: string | null
  dokumentyFooterHtml: string | null
}>

export async function buildDokumentChrome(
  orgId: string,
  plan: string,
  overrides?: DokumentChromeOverrides
): Promise<DokumentChrome | null> {
  const [org, saved] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nazev: true, logo: true, logoBw: true, ico: true, dic: true, sidlo: true, email: true, telefon: true, web: true },
    }),
    getOrgSettings(orgId),
  ])
  if (!org) return null
  const settings = { ...saved, ...overrides }

  let styl = settings.dokumentyStyl
  if (styl === 'VLASTNI' && !getPlanLimits(plan).hasWhiteLabel) styl = 'LINKA'
  if (styl === 'ZADNY') return null

  const barva = settings.primaryColor || '#4CAF50'
  const logo = orgLogoDataUrl(org.logoBw ?? org.logo)
  const logoImg = logo ? `<img src="${logo}" style="height:24px;max-width:140px;object-fit:contain" />` : ''
  const cislovani = settings.dokumentyCislovani
    ? `Strana <span class="pageNumber"></span> z <span class="totalPages"></span>`
    : ''
  const patickaText = esc(
    settings.dokumentyPaticka?.trim() ||
    [org.nazev, org.ico && `IČ ${org.ico}`, org.sidlo, org.email].filter(Boolean).join(' · ')
  )

  if (styl === 'VLASTNI') {
    // sanitizace až PO dosazení placeholderů — {{logo}} vkládá data: img,
    // který musí projít; tenant HTML samotné projít nesmí bez očištění
    const fill = (tpl: string) => sanitizeDocumentHtml(tpl
      .replaceAll('{{logo}}', logoImg)
      .replaceAll('{{organizace}}', esc(org.nazev ?? ''))
      .replaceAll('{{org_ico}}', esc(org.ico ?? ''))
      .replaceAll('{{org_dic}}', esc(org.dic ?? ''))
      .replaceAll('{{org_sidlo}}', esc(org.sidlo ?? ''))
      .replaceAll('{{org_email}}', esc(org.email ?? ''))
      .replaceAll('{{org_telefon}}', esc(org.telefon ?? ''))
      .replaceAll('{{org_web}}', esc(org.web ?? ''))
      .replaceAll('{{barva}}', esc(barva))
      .replaceAll('{{strana}}', '<span class="pageNumber"></span>')
      .replaceAll('{{stran_celkem}}', '<span class="totalPages"></span>')
      .replaceAll('{{datum}}', formatDate(new Date())))
    return {
      headerTemplate: `<div style="font-size:9px;width:100%;-webkit-print-color-adjust:exact">${fill(settings.dokumentyHeaderHtml ?? '')}</div>`,
      footerTemplate: `<div style="font-size:9px;width:100%;-webkit-print-color-adjust:exact">${fill(settings.dokumentyFooterHtml ?? '')}</div>`,
      marginTop: '30mm',
      marginBottom: '24mm',
    }
  }

  if (styl === 'PRUH') {
    return {
      headerTemplate: `
        <div style="-webkit-print-color-adjust:exact;width:100%;margin:0 10mm;background:${barva};border-radius:3px;padding:6px 12px;display:flex;justify-content:space-between;align-items:center;font-size:10px;font-family:Helvetica,Arial,sans-serif;color:#fff">
          <span>${logoImg}</span>
          <span style="font-weight:bold;letter-spacing:0.5px">${esc(org.nazev ?? '')}</span>
        </div>`,
      footerTemplate: `
        <div style="-webkit-print-color-adjust:exact;width:100%;margin:0 10mm;background:${barva};border-radius:3px;padding:5px 12px;display:flex;justify-content:space-between;align-items:center;font-size:8px;font-family:Helvetica,Arial,sans-serif;color:#fff">
          <span>${patickaText}</span>
          <span>${cislovani}</span>
        </div>`,
      marginTop: '28mm',
      marginBottom: '22mm',
    }
  }

  // LINKA (výchozí)
  return {
    headerTemplate: `
      <div style="width:100%;margin:0 10mm;font-size:10px;font-family:Helvetica,Arial,sans-serif;color:#333;border-bottom:1px solid #e0e0e0;padding-bottom:5px;-webkit-print-color-adjust:exact">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>${logoImg}</span>
          <span style="font-weight:bold">${esc(org.nazev ?? '')}</span>
        </div>
      </div>`,
    footerTemplate: `
      <div style="width:100%;margin:0 10mm;font-size:8px;font-family:Helvetica,Arial,sans-serif;color:#666">
        <div style="border-top:1px solid #ccc;padding-top:5px;display:flex;justify-content:space-between">
          <span>${patickaText}</span>
          <span>${cislovani}</span>
        </div>
      </div>`,
    marginTop: '28mm',
    marginBottom: '22mm',
  }
}
