import { prisma } from '@/lib/prisma'
import { buildQuoteHtml } from '@/lib/quoteHtml'
import puppeteer from 'puppeteer'
import { hardenPdfPage } from '@/lib/pdf'
import fs from 'fs'
import path from 'path'
import type { QuoteTemplate, QuoteTemplateConfig, QuoteTemplateHtml } from '@prisma/client'

// ── Types ────────────────────────────────────────────────────────────────────

type QuoteItem = {
  id: string
  kod: string | null
  nazev: string
  mnozstvi: unknown
  jednotka: string
  cenaZaKus: unknown
  sleva: unknown
  poznamky: string | null
  poradi: number
  productId: string | null
}

type QuoteForRender = {
  id: string
  kod: string | null
  nazev: string
  popis: string | null
  dphSazba: number
  templateId: string | null
  items: QuoteItem[]
  deal: {
    kod: string | null
    technologie: string
    adresaDila: string | null
    hodnotaZalohy: unknown
    splatnostZalohy: Date | null
    dphSazba: number
    client: {
      jmeno: string
      prijmeni: string
      email: string | null
      telefon: string | null
      ulice?: string | null
      mesto?: string | null
      psc?: string | null
      ico?: string | null
      dic?: string | null
    }
    user: { jmeno: string; email: string; telefon: string | null } | null
    organization: {
      nazev: string
      slug: string
      sidlo: string | null
      email: string | null
      telefon: string | null
      ico: string | null
      dic?: string | null
      logo?: string | null
    }
  }
}

type TemplateWithRelations = QuoteTemplate & {
  config: QuoteTemplateConfig | null
  htmlTemplate: QuoteTemplateHtml | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function computeTotals(quote: QuoteForRender) {
  const bezDph = quote.items.reduce(
    (s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100),
    0
  )
  const dphSazba = Number(quote.dphSazba ?? quote.deal.dphSazba)
  const dphCastka = bezDph * (dphSazba / 100)
  const sDph = bezDph + dphCastka
  return { bezDph, dphSazba, dphCastka, sDph }
}

async function getDefaultTemplate(orgId: string): Promise<TemplateWithRelations | null> {
  return prisma.quoteTemplate.findFirst({
    where: { orgId, isDefault: true },
    include: { config: true, htmlTemplate: true },
  })
}

async function getTemplateByMapping(orgId: string, technologie: string | null): Promise<TemplateWithRelations | null> {
  // 1. Try exact technologie match
  const exact = technologie
    ? await prisma.orgTemplateMapping.findUnique({
        where: { orgId_technologie: { orgId, technologie } },
        include: { template: { include: { config: true, htmlTemplate: true } } },
      })
    : null
  if (exact) return exact.template as TemplateWithRelations

  // 2. Try default mapping (technologie=null)
  const defaultMapping = await prisma.orgTemplateMapping.findFirst({
    where: { orgId, technologie: null },
    include: { template: { include: { config: true, htmlTemplate: true } } },
  })
  if (defaultMapping) return defaultMapping.template as TemplateWithRelations

  // 3. Fallback to isDefault template
  return getDefaultTemplate(orgId)
}

async function launchPuppeteer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    // JS off + síť jen na Google Fonts (tenant HTML šablony); page.evaluate níže funguje i tak
    await hardenPdfPage(page)
    // Pipe evaluate() console output to Node/PM2 logs for debugging
    page.on('console', msg => console.log('[pdf-scale]', msg.text()))
    // networkidle0: all Google Font .woff2 files downloaded → correct metrics for layout measurement
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.evaluate(() => {
      const pages = document.querySelectorAll('.page')
      const page2 = pages[1] as HTMLElement | undefined
      if (!page2) return

      const inner  = page2.querySelector('.inner') as HTMLElement | null
      const tbody  = page2.querySelector('.quote-table tbody') as HTMLElement | null
      const zaloha = page2.querySelector('.zaloha-note') as HTMLElement | null
      if (!inner || !tbody || !zaloha) return

      // Use .inner.clientHeight (flex-allocated height) minus its CSS padding.
      // This is the reliable available-content-height: independent of footer position,
      // page getBoundingClientRect, or any absolute coordinates.
      const cs      = window.getComputedStyle(inner)
      const padTop  = parseFloat(cs.paddingTop)    // 30px per CSS
      const padBot  = parseFloat(cs.paddingBottom) // 44px per CSS
      const availH  = inner.clientHeight - padTop - padBot

      // Stable reference: top of the padded content area inside .inner
      const contentTop = inner.getBoundingClientRect().top + padTop

      function fits(): boolean {
        // Content height = distance from first content element to bottom of zaloha-note.
        // Includes all margins, gaps, and spacing implicitly.
        return zaloha!.getBoundingClientRect().bottom - contentTop <= availH + 1
      }

      const initH = Math.round(zaloha.getBoundingClientRect().bottom - contentTop)
      console.log('inner.clientH=' + inner.clientHeight + ' padTop=' + padTop + ' padBot=' + padBot + ' availH=' + Math.round(availH))
      console.log('contentH=' + initH + ' overflow=' + Math.max(0, initH - availH) + 'px fits=' + fits())

      if (fits()) return

      let fontSize = 10 // matches .quote-table base font-size: 10px
      const MIN = 6, STEP = 0.5

      while (!fits() && fontSize > MIN) {
        fontSize -= STEP
        const vPad = Math.max(2, Math.round(5 * (fontSize / 10)))
        tbody!.querySelectorAll('td').forEach(node => {
          const td = node as HTMLElement
          td.style.fontSize      = fontSize + 'px'
          td.style.paddingTop    = vPad + 'px'
          td.style.paddingBottom = vPad + 'px'
        })
      }

      const finalH = Math.round(zaloha.getBoundingClientRect().bottom - contentTop)
      console.log('after scale: fontSize=' + fontSize + 'px contentH=' + finalH + ' fits=' + fits())

      // Fallback: move blue block to page 3 (should not occur with ≤20 items scaled to 6pt)
      if (!fits()) {
        const page3 = pages[2] as HTMLElement | undefined
        if (page3) {
          const p3inner = page3.querySelector('.inner')
          if (p3inner) {
            const ph = p3inner.querySelector('.page-header')
            p3inner.insertBefore(zaloha!, ph ? ph.nextSibling : p3inner.firstChild)
          }
        }
        console.log('fallback: zaloha moved to page 3')
      }
    })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// ── SYSTEM renderer (stávající logika z quoteHtml.ts) ────────────────────────

async function renderSystemTemplate(quote: QuoteForRender): Promise<Buffer> {
  const html = await buildQuoteHtml(quote)
  return launchPuppeteer(html)
}

async function renderSystemTemplateHtml(quote: QuoteForRender): Promise<string> {
  return buildQuoteHtml(quote)
}

// ── BASE renderer ─────────────────────────────────────────────────────────────

function buildBaseHtml(quote: QuoteForRender, config: QuoteTemplateConfig | null): string {
  const { deal } = quote
  const client = deal.client
  const org = deal.organization
  const user = deal.user
  const { bezDph, dphSazba, dphCastka, sDph } = computeTotals(quote)

  const color = '#4CAF50' // BASE — barva pevná
  const today = new Date().toLocaleDateString('cs-CZ')
  const platnostDo = new Date(Date.now() + 30 * 86400000).toLocaleDateString('cs-CZ')

  const klientAdresa = [
    client.ulice,
    [client.mesto, client.psc].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const itemRows = quote.items
    .map((item, idx) => {
      const mnozstvi = Number(item.mnozstvi)
      const cena = Number(item.cenaZaKus)
      const sleva = Number(item.sleva ?? 0)
      const celkem = mnozstvi * cena * (1 - sleva / 100)
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escHtml(item.kod ?? '')}</td>
        <td>${escHtml(item.nazev)}</td>
        <td class="right">${mnozstvi} ${escHtml(item.jednotka)}</td>
        <td class="right">${fmt(cena)} Kč</td>
        <td class="right">${sleva > 0 ? sleva + ' %' : '—'}</td>
        <td class="right"><strong>${fmt(celkem)} Kč</strong></td>
      </tr>`
    })
    .join('')

  const headerText = config?.headerText ? `<p class="header-text">${escHtml(config.headerText)}</p>` : ''
  const footer = [config?.footerLine1, config?.footerLine2, config?.footerLine3]
    .filter(Boolean)
    .map(l => `<p>${escHtml(l!)}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .header { background: ${color}; color: #fff; padding: 18px 24px; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .header .meta { text-align: right; font-size: 11px; opacity: 0.9; }
  .header .meta .kod { font-size: 15px; font-weight: 700; }
  .header-text { margin-bottom: 12px; color: #555; font-size: 11px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .party { border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; }
  .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: ${color}; letter-spacing: 1px; margin-bottom: 6px; }
  .party-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .party-detail { font-size: 10px; color: #666; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
  thead th { background: #1a1a1a; color: #fff; padding: 8px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .right { text-align: right; }
  .totals { margin-left: auto; width: 240px; margin-bottom: 16px; }
  .totals tr td { padding: 4px 8px; font-size: 11px; }
  .totals tr td:first-child { color: #666; }
  .totals tr td:last-child { text-align: right; font-weight: 600; }
  .totals tr.total-row td { font-size: 13px; font-weight: 700; border-top: 2px solid ${color}; color: ${color}; }
  .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 9px; color: #888; line-height: 1.8; }
  .felucia-brand { font-size: 9px; color: #ccc; margin-top: 8px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>CENOVÁ NABÍDKA</h1>
    <div style="font-size:12px;opacity:.85">${escHtml(org.nazev)}</div>
  </div>
  <div class="meta">
    <div class="kod">${escHtml(quote.kod ?? '')}</div>
    <div>Datum: ${today}</div>
    ${config?.showDatumPlatnosti !== false ? `<div>Platnost: ${platnostDo}</div>` : ''}
    ${config?.showOpKod !== false && deal.kod ? `<div>OP: ${escHtml(deal.kod)}</div>` : ''}
  </div>
</div>
${headerText}
<div class="parties">
  <div class="party">
    <div class="party-label">Dodavatel</div>
    <div class="party-name">${escHtml(org.nazev)}</div>
    <div class="party-detail">
      ${org.sidlo ? escHtml(org.sidlo) + '<br>' : ''}
      ${org.ico ? 'IČO: ' + escHtml(org.ico) + '<br>' : ''}
      ${org.dic ? 'DIČ: ' + escHtml(org.dic ?? '') + '<br>' : ''}
      ${org.email ? escHtml(org.email) : ''}
    </div>
  </div>
  <div class="party">
    <div class="party-label">Odběratel</div>
    <div class="party-name">${escHtml(`${client.jmeno} ${client.prijmeni}`.trim())}</div>
    <div class="party-detail">
      ${klientAdresa ? escHtml(klientAdresa) + '<br>' : ''}
      ${client.ico ? 'IČO: ' + escHtml(client.ico) + '<br>' : ''}
      ${client.dic ? 'DIČ: ' + escHtml(client.dic) + '<br>' : ''}
      ${client.telefon ? escHtml(client.telefon) + '<br>' : ''}
      ${client.email ? escHtml(client.email) : ''}
    </div>
  </div>
</div>
${quote.popis && config?.showPoznamka !== false ? `<p style="margin-bottom:12px;font-size:10px;color:#555">${escHtml(quote.popis)}</p>` : ''}
<table>
  <thead>
    <tr>
      <th style="width:30px">#</th>
      <th style="width:70px">Kód</th>
      <th>Název</th>
      <th class="right" style="width:80px">Množství</th>
      <th class="right" style="width:80px">Cena/ks</th>
      <th class="right" style="width:55px">Sleva</th>
      <th class="right" style="width:90px">Celkem</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>
<table class="totals">
  <tr><td>Cena bez DPH</td><td>${fmt(bezDph)} Kč</td></tr>
  <tr><td>DPH ${dphSazba} %</td><td>${fmt(dphCastka)} Kč</td></tr>
  <tr class="total-row"><td>Celkem s DPH</td><td>${fmt(sDph)} Kč</td></tr>
</table>
${user ? `<p style="font-size:10px;color:#666;margin-bottom:16px">Obchodník: <strong>${escHtml(user.jmeno)}</strong>${user.telefon ? ' · ' + escHtml(user.telefon) : ''} · ${escHtml(user.email)}</p>` : ''}
${footer ? `<div class="footer">${footer}</div>` : ''}
<div class="felucia-brand">Vytvořeno v Felucia CRM · felucia.io</div>
</body>
</html>`
}

// ── STANDARD renderer ─────────────────────────────────────────────────────────

function buildStandardHtml(quote: QuoteForRender, config: QuoteTemplateConfig | null): string {
  const { deal } = quote
  const client = deal.client
  const org = deal.organization
  const user = deal.user
  const { bezDph, dphSazba, dphCastka, sDph } = computeTotals(quote)

  const primaryColor = config?.primaryColor ?? '#4CAF50'
  const accentColor = config?.accentColor ?? '#1A2E1B'
  const today = new Date().toLocaleDateString('cs-CZ')
  const platnostDo = new Date(Date.now() + 30 * 86400000).toLocaleDateString('cs-CZ')

  const klientAdresa = [
    client.ulice,
    [client.mesto, client.psc].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const logoHtml = config?.logoUrl
    ? `<img src="${escHtml(config.logoUrl)}" style="height:40px;max-width:160px;object-fit:contain" alt="logo">`
    : `<span style="font-size:20px;font-weight:700;color:#fff">${escHtml(org.nazev)}</span>`

  const itemRows = quote.items
    .map((item, idx) => {
      const mnozstvi = Number(item.mnozstvi)
      const cena = Number(item.cenaZaKus)
      const sleva = Number(item.sleva ?? 0)
      const celkem = mnozstvi * cena * (1 - sleva / 100)
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escHtml(item.kod ?? '')}</td>
        <td>${escHtml(item.nazev)}</td>
        <td class="right">${mnozstvi} ${escHtml(item.jednotka)}</td>
        <td class="right">${fmt(cena)} Kč</td>
        <td class="right">${sleva > 0 ? sleva + ' %' : '—'}</td>
        <td class="right"><strong>${fmt(celkem)} Kč</strong></td>
      </tr>`
    })
    .join('')

  const headerText = config?.headerText ? `<p class="header-text">${escHtml(config.headerText)}</p>` : ''
  const footer = [config?.footerLine1, config?.footerLine2, config?.footerLine3]
    .filter(Boolean)
    .map(l => `<p>${escHtml(l!)}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .header { background: ${primaryColor}; color: #fff; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
  .header .title { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin-top: 8px; }
  .header .meta { text-align: right; font-size: 11px; opacity: 0.9; }
  .header .meta .kod { font-size: 16px; font-weight: 700; }
  .accent-bar { height: 5px; background: ${accentColor}; margin-bottom: 20px; }
  .content { padding: 0 28px 28px; }
  .header-text { margin-bottom: 12px; color: #555; font-size: 11px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .party { border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; border-top: 3px solid ${primaryColor}; }
  .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: ${primaryColor}; letter-spacing: 1px; margin-bottom: 6px; }
  .party-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .party-detail { font-size: 10px; color: #666; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
  thead th { background: ${accentColor}; color: #fff; padding: 8px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .right { text-align: right; }
  .totals { margin-left: auto; width: 240px; margin-bottom: 16px; }
  .totals tr td { padding: 4px 8px; font-size: 11px; }
  .totals tr td:first-child { color: #666; }
  .totals tr td:last-child { text-align: right; font-weight: 600; }
  .totals tr.total-row td { font-size: 14px; font-weight: 700; border-top: 2px solid ${primaryColor}; color: ${primaryColor}; padding-top: 8px; }
  .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 9px; color: #888; line-height: 1.8; }
</style>
</head>
<body>
<div class="header">
  <div>
    ${logoHtml}
    <div class="title">CENOVÁ NABÍDKA</div>
  </div>
  <div class="meta">
    <div class="kod">${escHtml(quote.kod ?? '')}</div>
    <div>Datum: ${today}</div>
    ${config?.showDatumPlatnosti !== false ? `<div>Platnost: ${platnostDo}</div>` : ''}
    ${config?.showOpKod !== false && deal.kod ? `<div>OP: ${escHtml(deal.kod)}</div>` : ''}
  </div>
</div>
<div class="accent-bar"></div>
<div class="content">
${headerText}
<div class="parties">
  <div class="party">
    <div class="party-label">Dodavatel</div>
    <div class="party-name">${escHtml(org.nazev)}</div>
    <div class="party-detail">
      ${org.sidlo ? escHtml(org.sidlo) + '<br>' : ''}
      ${org.ico ? 'IČO: ' + escHtml(org.ico) + '<br>' : ''}
      ${org.dic ? 'DIČ: ' + escHtml(org.dic ?? '') + '<br>' : ''}
      ${org.email ? escHtml(org.email) : ''}
    </div>
  </div>
  <div class="party">
    <div class="party-label">Odběratel</div>
    <div class="party-name">${escHtml(`${client.jmeno} ${client.prijmeni}`.trim())}</div>
    <div class="party-detail">
      ${klientAdresa ? escHtml(klientAdresa) + '<br>' : ''}
      ${client.ico ? 'IČO: ' + escHtml(client.ico) + '<br>' : ''}
      ${client.dic ? 'DIČ: ' + escHtml(client.dic) + '<br>' : ''}
      ${client.telefon ? escHtml(client.telefon) + '<br>' : ''}
      ${client.email ? escHtml(client.email) : ''}
    </div>
  </div>
</div>
${quote.popis && config?.showPoznamka !== false ? `<p style="margin-bottom:12px;font-size:10px;color:#555">${escHtml(quote.popis)}</p>` : ''}
<table>
  <thead>
    <tr>
      <th style="width:30px">#</th>
      <th style="width:70px">Kód</th>
      <th>Název</th>
      <th class="right" style="width:80px">Množství</th>
      <th class="right" style="width:80px">Cena/ks</th>
      <th class="right" style="width:55px">Sleva</th>
      <th class="right" style="width:90px">Celkem</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>
<table class="totals">
  <tr><td>Cena bez DPH</td><td>${fmt(bezDph)} Kč</td></tr>
  <tr><td>DPH ${dphSazba} %</td><td>${fmt(dphCastka)} Kč</td></tr>
  <tr class="total-row"><td>Celkem s DPH</td><td>${fmt(sDph)} Kč</td></tr>
</table>
${user ? `<p style="font-size:10px;color:#666;margin-bottom:16px">Obchodník: <strong>${escHtml(user.jmeno)}</strong>${user.telefon ? ' · ' + escHtml(user.telefon) : ''} · ${escHtml(user.email)}</p>` : ''}
${footer ? `<div class="footer">${footer}</div>` : ''}
</div>
</body>
</html>`
}

// ── TENANT DEFAULT renderer (pro non-NANTO orgs bez konfigurované šablony) ───

export function orgLogoDataUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null
  try {
    const abs = path.join(process.cwd(), 'public', logoPath)
    const buf = fs.readFileSync(abs)
    const ext = path.extname(logoPath).slice(1).toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function buildTenantDefaultHtml(quote: QuoteForRender, primaryColor = '#1a1a2e'): string {
  const { deal } = quote
  const client = deal.client
  const org = deal.organization
  const user = deal.user
  const { bezDph, dphSazba, dphCastka, sDph } = computeTotals(quote)

  const today = new Date().toLocaleDateString('cs-CZ')
  const platnostDo = new Date(Date.now() + 30 * 86400000).toLocaleDateString('cs-CZ')

  const klientAdresa = [
    client.ulice,
    [client.mesto, client.psc].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')

  const logoDataUrl = orgLogoDataUrl(org.logo)
  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" style="height:44px;max-width:180px;object-fit:contain;display:block" alt="${escHtml(org.nazev)}">`
    : `<span style="font-size:19px;font-weight:700;color:#fff;line-height:1.2">${escHtml(org.nazev)}</span>`

  const itemRows = quote.items.map((item, idx) => {
    const mnozstvi = Number(item.mnozstvi)
    const cena = Number(item.cenaZaKus)
    const sleva = Number(item.sleva ?? 0)
    const celkem = mnozstvi * cena * (1 - sleva / 100)
    return `<tr>
      <td class="center">${idx + 1}</td>
      <td>${escHtml(item.nazev)}</td>
      <td class="center">${mnozstvi}</td>
      <td class="center">${escHtml(item.jednotka)}</td>
      <td class="right">${fmt(cena)} Kč</td>
      <td class="right bold">${fmt(celkem)} Kč</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 10px; color: #1a1a1a; background: #fff; }

  .header { background: ${primaryColor}; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
  .header-right { text-align: right; font-size: 9.5px; color: rgba(255,255,255,0.88); line-height: 1.7; }

  .accent-bar { height: 4px; background: rgba(0,0,0,0.18); }

  .content { padding: 18px 28px 24px; }

  .doc-heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; }
  .doc-title { font-size: 18px; font-weight: 700; color: ${primaryColor}; letter-spacing: -0.3px; }
  .doc-meta { font-size: 9px; color: #888; text-align: right; line-height: 1.9; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .party { border: 1px solid #e5e7eb; border-top: 3px solid ${primaryColor}; border-radius: 0 0 4px 4px; padding: 9px 11px; }
  .party-label { font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: ${primaryColor}; letter-spacing: 1.1px; margin-bottom: 4px; }
  .party-name { font-size: 11.5px; font-weight: 600; margin-bottom: 3px; }
  .party-detail { font-size: 9px; color: #555; line-height: 1.65; }

  .note { font-size: 9.5px; color: #555; font-style: italic; margin-bottom: 12px; padding: 8px 10px; background: #f9f9f9; border-left: 3px solid ${primaryColor}; border-radius: 0 3px 3px 0; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.5px; }
  table.items thead th { background: #2d2d2d; color: #fff; padding: 6px 9px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; }
  table.items tbody tr:nth-child(even) { background: #f9f9f9; }
  table.items tbody td { padding: 5.5px 9px; border-bottom: 1px solid #ebebeb; vertical-align: top; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 600; }

  .totals-row { display: flex; justify-content: flex-end; margin-bottom: 16px; }
  table.totals { width: 210px; border-collapse: collapse; font-size: 10px; }
  table.totals td { padding: 3.5px 7px; }
  table.totals td:first-child { color: #666; }
  table.totals td:last-child { text-align: right; font-weight: 600; }
  table.totals tr.grand td { font-size: 12.5px; font-weight: 700; border-top: 2px solid ${primaryColor}; color: ${primaryColor}; padding-top: 6px; }

  .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  .sig-block { font-size: 9px; color: #555; }
  .sig-block .sig-name { font-size: 9.5px; font-weight: 600; color: #222; margin-bottom: 2px; }
  .sig-block .sig-detail { color: #777; line-height: 1.65; margin-bottom: 18px; }
  .sig-line { border-top: 1px solid #bbb; padding-top: 4px; font-size: 8px; color: #aaa; }
</style>
</head>
<body>
<div class="header">
  <div>${logoHtml}</div>
  <div class="header-right">
    <div style="font-weight:600;color:#fff;font-size:10.5px">${escHtml(org.nazev)}</div>
    ${org.sidlo ? `<div>${escHtml(org.sidlo)}</div>` : ''}
    ${org.ico ? `<div>IČO: ${escHtml(org.ico)}${org.dic ? ` &nbsp;·&nbsp; DIČ: ${escHtml(org.dic)}` : ''}</div>` : ''}
    ${org.telefon ? `<div>${escHtml(org.telefon)}</div>` : ''}
    ${org.email ? `<div>${escHtml(org.email)}</div>` : ''}
  </div>
</div>
<div class="accent-bar"></div>
<div class="content">
  <div class="doc-heading">
    <div class="doc-title">CENOVÁ NABÍDKA</div>
    <div class="doc-meta">
      ${quote.kod ? `<div><strong>${escHtml(quote.kod)}</strong></div>` : ''}
      <div>Datum vyhotovení: ${today}</div>
      <div>Platnost nabídky: ${platnostDo}</div>
      ${deal.kod ? `<div>Číslo OP: ${escHtml(deal.kod)}</div>` : ''}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Dodavatel</div>
      <div class="party-name">${escHtml(org.nazev)}</div>
      <div class="party-detail">
        ${org.sidlo ? escHtml(org.sidlo) + '<br>' : ''}
        ${org.ico ? 'IČO: ' + escHtml(org.ico) + '<br>' : ''}
        ${org.dic ? 'DIČ: ' + escHtml(org.dic) + '<br>' : ''}
        ${org.telefon ? escHtml(org.telefon) + '<br>' : ''}
        ${org.email ? escHtml(org.email) : ''}
      </div>
    </div>
    <div class="party">
      <div class="party-label">Odběratel</div>
      <div class="party-name">${escHtml(`${client.jmeno} ${client.prijmeni}`.trim())}</div>
      <div class="party-detail">
        ${klientAdresa ? escHtml(klientAdresa) + '<br>' : ''}
        ${client.ico ? 'IČO: ' + escHtml(client.ico) + '<br>' : ''}
        ${client.dic ? 'DIČ: ' + escHtml(client.dic) + '<br>' : ''}
        ${client.telefon ? escHtml(client.telefon) + '<br>' : ''}
        ${client.email ? escHtml(client.email) : ''}
      </div>
    </div>
  </div>

  ${quote.popis ? `<div class="note">${escHtml(quote.popis)}</div>` : ''}

  <table class="items">
    <thead>
      <tr>
        <th style="width:26px" class="center">#</th>
        <th>Název / popis</th>
        <th style="width:52px" class="center">Mn.</th>
        <th style="width:36px" class="center">MJ</th>
        <th style="width:82px" class="right">Cena/MJ</th>
        <th style="width:88px" class="right">Celkem</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals-row">
    <table class="totals">
      <tr><td>Celkem bez DPH</td><td>${fmt(bezDph)} Kč</td></tr>
      <tr><td>DPH ${dphSazba} %</td><td>${fmt(dphCastka)} Kč</td></tr>
      <tr class="grand"><td>Celkem s DPH</td><td>${fmt(sDph)} Kč</td></tr>
    </table>
  </div>

  <div class="footer">
    <div class="sig-block">
      <div class="sig-name">${escHtml(org.nazev)} — Dodavatel</div>
      <div class="sig-detail">
        ${org.sidlo ? escHtml(org.sidlo) + '<br>' : ''}
        ${org.ico ? 'IČO: ' + escHtml(org.ico) : ''}
        ${user ? '<br>' + escHtml(user.jmeno) + (user.telefon ? ' · ' + escHtml(user.telefon) : '') : ''}
      </div>
      <div class="sig-line">Podpis &amp; razítko</div>
    </div>
    <div class="sig-block">
      <div class="sig-name">${escHtml(`${client.jmeno} ${client.prijmeni}`.trim())} — Objednatel</div>
      <div class="sig-detail">
        ${klientAdresa ? escHtml(klientAdresa) + '<br>' : ''}
        ${client.ico ? 'IČO: ' + escHtml(client.ico) : ''}
      </div>
      <div class="sig-line">Podpis &amp; razítko</div>
    </div>
  </div>
</div>
</body>
</html>`
}

// ── CUSTOM HTML renderer ──────────────────────────────────────────────────────

function buildTemplateData(quote: QuoteForRender) {
  const { deal } = quote
  const client = deal.client
  const org = deal.organization
  const user = deal.user
  const { bezDph, dphSazba, dphCastka, sDph } = computeTotals(quote)
  const today = new Date().toLocaleDateString('cs-CZ')
  const platnostDo = new Date(Date.now() + 30 * 86400000).toLocaleDateString('cs-CZ')
  const klientAdresa = [
    client.ulice,
    [client.mesto, client.psc].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  return {
    simple: {
      firma_nazev: org.nazev,
      firma_adresa: org.sidlo ?? '',
      firma_ico: org.ico ?? '',
      firma_dic: org.dic ?? '',
      firma_telefon: org.telefon ?? '',
      firma_email: org.email ?? '',
      firma_logo_url: org.logo ?? '',
      klient_jmeno: `${client.jmeno} ${client.prijmeni}`.trim(),
      klient_adresa: klientAdresa,
      klient_ico: client.ico ?? '',
      klient_dic: client.dic ?? '',
      klient_telefon: client.telefon ?? '',
      klient_email: client.email ?? '',
      nabidka_kod: quote.kod ?? '',
      nabidka_nazev: quote.nazev,
      datum_vystaveni: today,
      datum_platnosti: platnostDo,
      obchodnik_jmeno: user?.jmeno ?? '',
      obchodnik_inicialy: user?.jmeno ? user.jmeno.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '',
      obchodnik_telefon: user?.telefon ?? '',
      obchodnik_email: user?.email ?? '',
      cena_bez_dph: fmt(bezDph) + ' Kč',
      dph_sazba: String(dphSazba),
      dph_castka: fmt(dphCastka) + ' Kč',
      cena_s_dph: fmt(sDph) + ' Kč',
      kod_op: deal.kod ?? '',
    },
  }
}

function renderCustomHtmlTemplate(quote: QuoteForRender, tpl: QuoteTemplateHtml, css: string | null): string {
  const data = buildTemplateData(quote)
  let html = tpl.htmlContent

  // Inject extra CSS if provided
  if (css && html.includes('</style>')) {
    html = html.replace('</style>', `${css}\n</style>`)
  } else if (css) {
    html = html.replace('</head>', `<style>${css}</style>\n</head>`)
  }

  // Simple placeholder replacement
  for (const [key, val] of Object.entries(data.simple)) {
    html = html.replaceAll(`{{${key}}}`, val ?? '')
  }

  // Items loop: {{#polozky}}...{{/polozky}}
  const loopMatch = html.match(/\{\{#polozky\}\}([\s\S]*?)\{\{\/polozky\}\}/)
  if (loopMatch) {
    const rowTpl = loopMatch[1]
    const rows = quote.items
      .map((item, idx) => {
        const mnozstvi = Number(item.mnozstvi)
        const cena = Number(item.cenaZaKus)
        const sleva = Number(item.sleva ?? 0)
        const celkem = mnozstvi * cena * (1 - sleva / 100)
        let row = rowTpl
        row = row.replaceAll('{{polozka_poradi}}', String(idx + 1))
        row = row.replaceAll('{{polozka_kod}}', escHtml(item.kod ?? ''))
        row = row.replaceAll('{{polozka_nazev}}', escHtml(item.nazev))
        row = row.replaceAll('{{polozka_mnozstvi}}', String(mnozstvi))
        row = row.replaceAll('{{polozka_jednotka}}', escHtml(item.jednotka))
        row = row.replaceAll('{{polozka_cena_kus}}', fmt(cena) + ' Kč')
        row = row.replaceAll('{{polozka_sleva}}', sleva > 0 ? sleva + ' %' : '—')
        row = row.replaceAll('{{polozka_celkem}}', fmt(celkem) + ' Kč')
        return row
      })
      .join('')
    html = html.replace(/\{\{#polozky\}\}[\s\S]*?\{\{\/polozky\}\}/g, rows)
  }

  return html
}

// ── HTML escaping ─────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Plan guard ────────────────────────────────────────────────────────────────

function isTypAllowedForPlan(plan: string, typ: string): boolean {
  if (typ === 'SYSTEM' || typ === 'BASE') return true
  if (typ === 'STANDARD') return ['STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)
  if (typ === 'CUSTOM_HTML') return ['PROFESSIONAL', 'ENTERPRISE'].includes(plan)
  return false
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Renderuje HTML nabídky (bez Puppeteer) — pro preview
 */
export async function renderQuoteHtml(
  quoteId: string,
  orgId: string,
  orgPlan?: string
): Promise<string> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, deal: { orgId } },
    include: {
      items: { orderBy: { poradi: 'asc' } },
      template: { include: { config: true, htmlTemplate: true } },
      deal: {
        include: {
          client: true,
          user: { select: { jmeno: true, email: true, telefon: true } },
          organization: true,
        },
      },
    },
  })

  if (!quote) throw new Error('Quote not found')

  const template =
    (quote.template as TemplateWithRelations | null) ??
    (await getTemplateByMapping(orgId, quote.deal.technologie))

  // Non-NANTO tenant bez nakonfigurované šablony → profesionální tenant template
  const orgSlug = (quote.deal.organization as { slug?: string }).slug
  if (!template && orgSlug && orgSlug !== 'nanto') {
    const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId } }).catch(() => null)
    return buildTenantDefaultHtml(quote, orgSettings?.primaryColor ?? '#1a1a2e')
  }

  const plan = orgPlan ?? 'STARTER'
  const typ = template?.typ ?? 'SYSTEM'

  // Fallback na SYSTEM pokud plán nedovoluje
  if (!isTypAllowedForPlan(plan, typ)) {
    return renderSystemTemplateHtml(quote)
  }

  switch (typ) {
    case 'SYSTEM':
      return renderSystemTemplateHtml(quote)
    case 'BASE':
      return buildBaseHtml(quote, template?.config ?? null)
    case 'STANDARD':
      return buildStandardHtml(quote, template?.config ?? null)
    case 'CUSTOM_HTML': {
      if (!template?.htmlTemplate) return buildBaseHtml(quote, template?.config ?? null)
      return renderCustomHtmlTemplate(quote, template.htmlTemplate, template.htmlTemplate.cssContent ?? null)
    }
    default:
      return renderSystemTemplateHtml(quote)
  }
}

/**
 * Renderuje PDF nabídky (přes Puppeteer)
 */
export async function renderQuotePdf(
  quoteId: string,
  orgId: string,
  orgPlan?: string
): Promise<Buffer> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, deal: { orgId } },
    include: {
      items: { orderBy: { poradi: 'asc' } },
      template: { include: { config: true, htmlTemplate: true } },
      deal: {
        include: {
          client: true,
          user: { select: { jmeno: true, email: true, telefon: true } },
          organization: true,
        },
      },
    },
  })

  if (!quote) throw new Error('Quote not found')

  // 1. Quote has explicit template → use it
  // 2. Else → lookup OrgTemplateMapping per technologie / default
  const template =
    (quote.template as TemplateWithRelations | null) ??
    (await getTemplateByMapping(orgId, quote.deal.technologie))

  // Non-NANTO tenant bez nakonfigurované šablony → profesionální tenant template
  const orgSlug = (quote.deal.organization as { slug?: string }).slug
  if (!template && orgSlug && orgSlug !== 'nanto') {
    const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId } }).catch(() => null)
    return launchPuppeteer(buildTenantDefaultHtml(quote, orgSettings?.primaryColor ?? '#1a1a2e'))
  }

  const plan = orgPlan ?? 'STARTER'
  const typ = template?.typ ?? 'SYSTEM'

  if (!isTypAllowedForPlan(plan, typ)) {
    return renderSystemTemplate(quote)
  }

  switch (typ) {
    case 'SYSTEM':
      return renderSystemTemplate(quote)
    case 'BASE':
      return launchPuppeteer(buildBaseHtml(quote, template?.config ?? null))
    case 'STANDARD':
      return launchPuppeteer(buildStandardHtml(quote, template?.config ?? null))
    case 'CUSTOM_HTML': {
      if (!template?.htmlTemplate) return launchPuppeteer(buildBaseHtml(quote, template?.config ?? null))
      const html = renderCustomHtmlTemplate(quote, template.htmlTemplate, template.htmlTemplate.cssContent ?? null)
      return launchPuppeteer(html)
    }
    default:
      return renderSystemTemplate(quote)
  }
}

function buildMockQuote(): QuoteForRender {
  return {
    id: 'mock',
    kod: 'OP-25-001/N001',
    nazev: 'Ukázková nabídka',
    popis: 'Toto je ukázkový text nabídky pro zobrazení náhledu šablony.',
    dphSazba: 12,
    templateId: null,
    items: [
      { id: '1', kod: 'TC-001', nazev: 'Tepelné čerpadlo ACME 12kW', mnozstvi: 1, jednotka: 'ks', cenaZaKus: 85000, sleva: 0, poznamky: null, poradi: 1, productId: null },
      { id: '2', kod: 'MON-001', nazev: 'Montáž a uvedení do provozu', mnozstvi: 1, jednotka: 'ks', cenaZaKus: 15000, sleva: 10, poznamky: null, poradi: 2, productId: null },
      { id: '3', kod: 'MAT-001', nazev: 'Instalační materiál', mnozstvi: 1, jednotka: 'kpl', cenaZaKus: 5000, sleva: 0, poznamky: null, poradi: 3, productId: null },
    ],
    deal: {
      kod: 'OP-25-001',
      technologie: 'TEPELNE_CERPADLO',
      adresaDila: 'Příkladná 123, Praha',
      hodnotaZalohy: 30000,
      splatnostZalohy: new Date(Date.now() + 7 * 86400000),
      dphSazba: 21,
      client: {
        jmeno: 'Jan',
        prijmeni: 'Novák',
        email: 'jan.novak@example.cz',
        telefon: '+420 777 123 456',
        ulice: 'Příkladná 123',
        mesto: 'Praha',
        psc: '110 00',
        ico: '12345678',
        dic: 'CZ12345678',
      },
      user: { jmeno: 'Marie Obchodníková', email: 'marie@firma.cz', telefon: '+420 605 000 111' },
      organization: {
        nazev: 'Vaše Firma s.r.o.',
        slug: 'demo',
        sidlo: 'Firemní 1, 100 00 Praha',
        email: 'info@firma.cz',
        telefon: '+420 222 333 444',
        ico: '98765432',
        dic: 'CZ98765432',
        logo: null,
      },
    },
  }
}

/**
 * Preview šablony s mock daty (bez existující nabídky v DB)
 */
export async function renderTemplateMockPreview(
  template: TemplateWithRelations,
): Promise<Buffer> {
  const mock = buildMockQuote()
  switch (template.typ) {
    case 'BASE':
      return launchPuppeteer(buildBaseHtml(mock, template.config))
    case 'STANDARD':
      return launchPuppeteer(buildStandardHtml(mock, template.config))
    case 'CUSTOM_HTML': {
      if (!template.htmlTemplate) return launchPuppeteer(buildBaseHtml(mock, template.config))
      const html = renderCustomHtmlTemplate(mock, template.htmlTemplate, template.htmlTemplate.cssContent ?? null)
      return launchPuppeteer(html)
    }
    default:
      return renderSystemTemplate(mock)
  }
}

/**
 * Preview pro dočasný HTML (editor CUSTOM_HTML šablony) s mock daty
 */
export async function renderPreviewFromHtmlMock(
  htmlContent: string,
  cssContent: string | null,
): Promise<Buffer> {
  const mock = buildMockQuote()
  const fakeTpl: QuoteTemplateHtml = {
    id: 'preview',
    templateId: 'preview',
    htmlContent,
    cssContent: cssContent ?? null,
  }
  const html = renderCustomHtmlTemplate(mock, fakeTpl, cssContent)
  return launchPuppeteer(html)
}

/**
 * Preview pro dočasný HTML (editor CUSTOM_HTML šablony)
 */
export async function renderPreviewFromHtml(
  htmlContent: string,
  cssContent: string | null,
  quoteId: string,
  orgId: string
): Promise<Buffer> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, deal: { orgId } },
    include: {
      items: { orderBy: { poradi: 'asc' } },
      deal: {
        include: {
          client: true,
          user: { select: { jmeno: true, email: true, telefon: true } },
          organization: true,
        },
      },
    },
  })

  if (!quote) throw new Error('Quote not found')

  const fakeTpl: QuoteTemplateHtml = {
    id: 'preview',
    templateId: 'preview',
    htmlContent,
    cssContent: cssContent ?? null,
  }

  const html = renderCustomHtmlTemplate(quote, fakeTpl, cssContent)
  return launchPuppeteer(html)
}
