import puppeteer from 'puppeteer'
import type { DokumentChrome } from './dokumentyChrome'

export async function generatePdf(html: string, chrome?: DokumentChrome | null): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
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
