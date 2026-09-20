import puppeteer, { Page } from 'puppeteer'
import type { DokumentChrome } from './dokumentyChrome'

// Jediné povolené síťové cíle při renderu PDF — webfonty. Vše ostatní
// (localhost, interní síť, exfiltrace přes img/css) se zahodí.
const ALLOWED_URL_PREFIXES = [
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/',
  'data:',
  'about:',
]

export async function hardenPdfPage(page: Page, { allowJs = false } = {}): Promise<void> {
  if (!allowJs) await page.setJavaScriptEnabled(false)
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    if (ALLOWED_URL_PREFIXES.some(p => url.startsWith(p))) {
      req.continue().catch(() => {})
    } else {
      req.abort().catch(() => {})
    }
  })
}

/**
 * Vloží HTML a počká, až dojdou webfonty (Google Fonts .woff2) — jinak se
 * PDF vyrenderuje s fallback fontem. Puppeteer ≥ 24.43 už u setContent
 * `networkidle0` nepodporuje, proto explicitní waitForNetworkIdle.
 */
export async function setContentAndWait(page: Page, html: string): Promise<void> {
  await page.setContent(html, { waitUntil: 'load' })
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15_000 }).catch(() => {})
}

export async function generatePdf(html: string, chrome?: DokumentChrome | null): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await hardenPdfPage(page)
    await setContentAndWait(page, html)
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      ...(chrome
        ? {
            displayHeaderFooter: true,
            headerTemplate: chrome.headerTemplate,
            footerTemplate: chrome.footerTemplate,
            margin: { top: chrome.marginTop, right: '15mm', bottom: chrome.marginBottom, left: '15mm' },
          }
        : {
            margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
          }),
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
