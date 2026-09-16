/**
 * Desktop snímky CRM pro marketingový web — reálné obrazovky ukázkové org
 * (scripts/seed-ukazka.ts, hrdina příběhu Petr Horák). Spouští
 * scripts/marketing-shots.sh v izolovaném prostředí; přímo nikdy — bere
 * E2E_DB_URL (nanto_crm_test) pro dohledání ID a E2E_BASE_URL pro server.
 *
 * Výstup: public/marketing/crm-<name>.jpg, 1440×900 @1.5×, světlý režim.
 * Argumenty: názvy snímků, které pořídit (bez argumentů všechny).
 */
import { chromium, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import path from 'path'
import 'dotenv/config'

const DB_URL = process.env.E2E_DB_URL ?? ''
if (!/nanto_crm_test/.test(DB_URL)) throw new Error('marketing-shots: E2E_DB_URL musí mířit na nanto_crm_test')
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const OUT = path.join(process.cwd(), 'public', 'marketing')
const ADMIN_EMAIL = 'admin.applereview@felucia.io'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD
if (!ADMIN_PASSWORD) throw new Error('marketing-shots: chybí SEED_ADMIN_PASSWORD')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL }) })

type Shot = { name: string; url: string; prepare?: (page: Page) => Promise<void> }

/** Odscrolluje tak, aby prvek s daným textem byl `offset` px pod horním okrajem
 *  (pod sticky lištou záložek zakázky, která má ~110 px). */
const scrollTo = (text: string, offset = 130) => async (page: Page) => {
  const box = await page.getByText(text, { exact: true }).first().boundingBox()
  if (!box) throw new Error(`scrollTo: "${text}" nenalezeno`)
  await page.mouse.move(720, 450)
  await page.mouse.wheel(0, Math.max(0, box.y - offset))
  await page.waitForTimeout(400)
}

async function resolveShots(): Promise<Shot[]> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: 'applereview' } })
  const deal = await prisma.deal.findFirstOrThrow({ where: { orgId: org.id, kod: 'OP-26-101' } })
  const sod = await prisma.sod.findFirstOrThrow({ where: { orgId: org.id, dealId: deal.id } })
  const zakazka = await prisma.zakazka.findFirstOrThrow({ where: { orgId: org.id, cislo: '26-901' } })
  const predavak = await prisma.predavak.findFirstOrThrow({ where: { orgId: org.id, cislo: 'PP-26-032' } })
  const vyuctovani = await prisma.vyuctovani.findFirstOrThrow({ where: { orgId: org.id, cislo: 'VYU-26-032' } })
  return [
    { name: 'op',         url: `/deals/${deal.id}?tab=prehled` },
    { name: 'nabidka',    url: `/deals/${deal.id}?tab=nabidky` },
    { name: 'smlouva',    url: `/sod/${sod.id}` },
    { name: 'zakazka',    url: `/zakazky/${zakazka.id}` },
    { name: 'material',   url: `/zakazky/${zakazka.id}`, prepare: scrollTo('Položky (5)') },
    { name: 'predavak',   url: `/zakazky/${zakazka.id}/predavaky/${predavak.id}`, prepare: scrollTo('PP-26-032', 250) },
    { name: 'vyuctovani', url: `/zakazky/${zakazka.id}/vyuctovani/${vyuctovani.id}`, prepare: scrollTo('VYU-26-032', 250) },
    { name: 'servis',     url: `/deals/${deal.id}?tab=servis` },
    { name: 'servis-nastenka', url: `/servis` },
    { name: 'dashboard',  url: `/dashboard` },
    { name: 'kalendar',   url: `/calendar` },
  ]
}

async function main() {
  const only = new Set(process.argv.slice(2))
  const shots = (await resolveShots()).filter(s => only.size === 0 || only.has(s.name))

  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    baseURL: BASE, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5,
    colorScheme: 'light', locale: 'cs-CZ', timezoneId: 'Europe/Prague',
  })
  // bannery, které do snímku nepatří
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('cookie_consent', 'accepted')
      localStorage.setItem('felucia_onboarding_banner_count', '99')
      localStorage.setItem('theme', 'light')
    } catch {}
  })
  const page = await ctx.newPage()
  // Plovoucí widgety (Dáša, nápověda) překrývají obsah — do snímků nepatří.
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = '.dasha-fab, .dasha-panel, button[title="Klávesové zkratky"] { display: none !important; }'
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })

  await page.goto('/auth/signin')
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD!)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 20_000 })

  for (const s of shots) {
    await page.goto(s.url, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(600)
    if (s.prepare) await s.prepare(page)
    const file = path.join(OUT, `crm-${s.name}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 })
    console.log(`  ✓ ${s.name} → ${path.relative(process.cwd(), file)}  (${s.url})`)
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
