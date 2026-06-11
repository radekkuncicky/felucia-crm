/**
 * Import produktů z Raynet CRM Excel exportu do FELUCIA CRM
 *
 * Použití:
 *   npx tsx prisma/import-raynet.ts ./cesta/k/souboru.xlsx
 *   # nebo s ts-node:
 *   npx ts-node --skip-project prisma/import-raynet.ts ./cesta/k/souboru.xlsx
 *
 * Struktura Raynet exportu (XLSX):
 *   Row 6 (index 5) = záhlaví sloupců
 *   Row 8 (index 7) = první datový řádek
 *
 *   Col 0:  Kód
 *   Col 1:  Název produktu
 *   Col 2:  Produktová řada
 *   Col 3:  Kategorie
 *   Col 4:  Jednotka (normalizovat: "1" → "ks")
 *   Col 5:  Popis
 *   Col 6:  Platnost od (ignorovat)
 *   Col 7:  Platnost do (ignorovat)
 *   Col 8:  Sazba DPH (číslo: 12.0 → 12)
 *   Col 9:  kategorie systémový panel (ignorovat)
 *   Col 10: Náklad (nakladovaCena)
 *   Col 11: Standardní cena
 *   Col 12+: Ceníky ve formátu "[KOD] Název [Kč]"
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const s = String(val).replace(/\s/g, '').replace(',', '.')
  return parseFloat(s) || 0
}

function parseNumOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

/** Normalise unit: "1" → "ks", empty → "ks" */
function normalizeJednotka(val: string): string {
  const v = val.trim()
  if (!v || v === '1') return 'ks'
  return v
}

/**
 * Parse ceník column header from Raynet format:
 *   "[CN-LOW_COST] CN REKU - LOW COST [Kč]"
 *   → { kod: "CN-LOW_COST", nazev: "CN REKU - LOW COST" }
 */
function parseCenikHeader(header: string): { kod: string; nazev: string } | null {
  // Pattern: [KOD] Název [Kč]  (Kč may be optional, bracket may not close perfectly)
  const match = header.match(/^\[([^\]]+)\]\s*(.*?)\s*(?:\[Kč\])?\s*$/)
  if (!match) return null
  return {
    kod: match[1].trim(),
    nazev: match[2].trim(),
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Chybí cesta k souboru!')
    console.error('Použití: npx tsx prisma/import-raynet.ts ./soubor.xlsx')
    process.exit(1)
  }

  const resolved = path.resolve(filePath)
  console.log(`📂 Čtu soubor: ${resolved}`)

  const wb = XLSX.readFile(resolved)
  const ws = wb.Sheets[wb.SheetNames[0]]

  // Read all rows as arrays (header: 1 means no key mapping, just arrays)
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

  if (allRows.length < 8) {
    console.error(`Soubor má jen ${allRows.length} řádků (očekáváno min. 8)`)
    process.exit(1)
  }

  // Row 6 (index 5) = záhlaví
  const headerRow = allRows[5] as unknown[]
  console.log(`📋 Záhlaví (řádek 6): ${headerRow.slice(0, 5).join(' | ')} ...`)

  // Detect ceník columns (cols 12+)
  const cenikCols: { idx: number; kod: string; nazev: string }[] = []
  for (let i = 12; i < headerRow.length; i++) {
    const header = String(headerRow[i] ?? '').trim()
    if (!header) continue

    const parsed = parseCenikHeader(header)
    if (parsed) {
      cenikCols.push({ idx: i, ...parsed })
    } else {
      // Fallback: use header text as-is (no bracket format)
      cenikCols.push({ idx: i, kod: header, nazev: header })
    }
  }

  // Data rows start at row 8 (index 7)
  const dataRows = allRows.slice(7).filter(r => {
    const row = r as unknown[]
    // Skip empty rows
    return String(row[1] ?? '').trim().length > 0
  })

  console.log(`\n📊 Statistiky souboru:`)
  console.log(`  Datové řádky: ${dataRows.length}`)
  console.log(`  Ceníkové sloupce (${cenikCols.length}): ${cenikCols.map(c => c.kod).join(', ') || 'žádné'}`)

  // ── Find organization ──────────────────────────────────────────────────────
  let org = await prisma.organization.findFirst({ where: { slug: 'felucia' } })
  if (!org) org = await prisma.organization.findFirst()
  if (!org) {
    console.error('Organizace nenalezena v databázi!')
    process.exit(1)
  }
  console.log(`\n🏢 Organizace: ${org.nazev} (${org.id})`)

  const orgId = org.id

  // ── Caches ────────────────────────────────────────────────────────────────
  const categoryCache = new Map<string, string>()
  const cenikCache = new Map<string, string>()
  const productIdCache = new Map<string, string>() // kod or _nazev → productId

  let importedProducts = 0
  let updatedProducts = 0
  let importedCategories = 0
  let importedCeniky = 0
  let importedPolozky = 0
  let updatedPolozky = 0
  const errors: string[] = []

  // ── Helpers with cache ────────────────────────────────────────────────────

  async function getOrCreateCategory(nazev: string): Promise<string | null> {
    if (!nazev) return null
    if (categoryCache.has(nazev)) return categoryCache.get(nazev)!
    let cat = await prisma.category.findFirst({ where: { orgId, nazev } })
    if (!cat) {
      cat = await prisma.category.create({ data: { orgId, nazev, barva: '#6B7280' } })
      importedCategories++
      process.stdout.write(`  + Kategorie: ${nazev}\n`)
    }
    categoryCache.set(nazev, cat.id)
    return cat.id
  }

  async function getOrCreateCenik(kod: string, nazev: string): Promise<string> {
    if (cenikCache.has(kod)) return cenikCache.get(kod)!
    let cenik = await prisma.cenik.findFirst({ where: { orgId, kod } })
    if (!cenik) {
      cenik = await prisma.cenik.create({ data: { orgId, kod, nazev } })
      importedCeniky++
      console.log(`  + Ceník: [${kod}] ${nazev}`)
    }
    cenikCache.set(kod, cenik.id)
    return cenik.id
  }

  // ── Process rows ──────────────────────────────────────────────────────────
  console.log(`\n🔄 Importuji produkty...`)

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const r = dataRows[rowIdx] as unknown[]

    const nazev = String(r[1] ?? '').trim()
    if (!nazev) continue

    const kod = String(r[0] ?? '').trim() || null
    const produktovaRada = String(r[2] ?? '').trim() || null
    const kategorieStr = String(r[3] ?? '').trim() || null
    const jednotka = normalizeJednotka(String(r[4] ?? ''))
    const popis = String(r[5] ?? '').trim() || null
    const dphSazba = Math.round(parseNum(r[8])) || 12
    const nakladovaCena = parseNumOrNull(r[10])
    const standardniCena = parseNum(r[11])

    try {
      const categoryId = kategorieStr ? await getOrCreateCategory(kategorieStr) : null

      const productData = {
        nazev,
        produktovaRada,
        kategorie: kategorieStr,
        categoryId,
        jednotka,
        popis,
        dphSazba,
        nakladovaCena,
        standardniCena,
        aktivni: true,
      }

      let product: { id: string } | null = null
      const cacheKey = kod ?? `_${nazev}`

      if (kod) {
        product = await prisma.product.findFirst({ where: { orgId, kod } })
        if (product) {
          product = await prisma.product.update({ where: { id: product.id }, data: productData })
          updatedProducts++
        } else {
          product = await prisma.product.create({ data: { orgId, kod, ...productData } })
          importedProducts++
        }
      } else {
        // No code - match by exact name
        product = await prisma.product.findFirst({ where: { orgId, nazev } })
        if (product) {
          product = await prisma.product.update({ where: { id: product.id }, data: productData })
          updatedProducts++
        } else {
          product = await prisma.product.create({ data: { orgId, kod: null, ...productData } })
          importedProducts++
        }
      }

      productIdCache.set(cacheKey, product.id)

      // Progress every 50 rows
      if ((rowIdx + 1) % 50 === 0) {
        process.stdout.write(`  Zpracováno ${rowIdx + 1}/${dataRows.length}...\n`)
      }

      // ── Ceník prices ────────────────────────────────────────────────────
      for (const col of cenikCols) {
        const cellVal = r[col.idx]
        if (cellVal === '' || cellVal === null || cellVal === undefined) continue
        const cena = parseNum(cellVal)
        if (cena <= 0) continue

        const cenikId = await getOrCreateCenik(col.kod, col.nazev)

        const existing = await prisma.cenikPolozka.findFirst({
          where: { cenikId, productId: product.id },
        })
        if (existing) {
          await prisma.cenikPolozka.update({ where: { id: existing.id }, data: { cena } })
          updatedPolozky++
        } else {
          await prisma.cenikPolozka.create({ data: { cenikId, productId: product.id, cena } })
          importedPolozky++
        }
      }
    } catch (e) {
      const msg = `Řádek ${rowIdx + 8} (${nazev}): ${String(e)}`
      errors.push(msg)
      console.error(`  ❌ ${msg}`)
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n✅ Import dokončen!`)
  console.log(`   Nové produkty:      ${importedProducts}`)
  console.log(`   Aktualizované:      ${updatedProducts}`)
  console.log(`   Nové kategorie:     ${importedCategories}`)
  console.log(`   Nové ceníky:        ${importedCeniky}`)
  console.log(`   Nové pol. ceníků:   ${importedPolozky}`)
  console.log(`   Aktual. pol. cen.:  ${updatedPolozky}`)

  if (errors.length > 0) {
    console.log(`\n⚠️  Chyby (${errors.length}):`)
    errors.forEach(e => console.log(`  - ${e}`))
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Kritická chyba:', e)
  process.exit(1)
})
