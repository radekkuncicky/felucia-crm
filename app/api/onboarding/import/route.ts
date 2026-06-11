import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface ParsedProduct {
  nazev: string
  kod: string
  kategorie: string
  jednotka: string
  standardniCena: number
  dphSazba: number
}

function parseExcel(buffer: ArrayBuffer): ParsedProduct[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  return rows.slice(0, 2000).map(row => ({
    nazev: String(row['Název'] ?? row['nazev'] ?? row['name'] ?? row['NÁZEV'] ?? '').trim(),
    kod: String(row['Kód'] ?? row['kod'] ?? row['KÓD'] ?? row['code'] ?? '').trim(),
    kategorie: String(row['Kategorie'] ?? row['kategorie'] ?? row['KATEGORIE'] ?? '').trim(),
    jednotka: String(row['Jednotka'] ?? row['jednotka'] ?? row['ks'] ?? 'ks').trim() || 'ks',
    standardniCena: Number(row['Cena'] ?? row['cena'] ?? row['CENA'] ?? row['Cena bez DPH'] ?? 0) || 0,
    dphSazba: Number(row['DPH'] ?? row['dph'] ?? row['Sazba DPH'] ?? 12) || 12,
  })).filter(p => p.nazev)
}

// Preview endpoint — GET with file upload as multipart
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = session.user

  const formData = await req.formData()
  const action = formData.get('action') as string // 'preview' | 'import'
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Soubor chybí' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const products = parseExcel(buffer)

  if (products.length === 0) {
    return NextResponse.json({ error: 'Soubor neobsahuje žádné produkty nebo má neočekávaný formát.' }, { status: 400 })
  }

  const categories = Array.from(new Set(products.map(p => p.kategorie).filter(Boolean)))

  if (action === 'preview') {
    return NextResponse.json({ count: products.length, categories: categories.length, categoryNames: categories.slice(0, 5) })
  }

  // Import
  const categoryCache = new Map<string, string>()
  async function getOrCreateCategory(nazev: string): Promise<string | null> {
    if (!nazev) return null
    if (categoryCache.has(nazev)) return categoryCache.get(nazev)!
    let cat = await prisma.category.findFirst({ where: { orgId, nazev } })
    if (!cat) {
      const count = await prisma.category.count({ where: { orgId } })
      cat = await prisma.category.create({ data: { orgId, nazev, barva: '#6B7280', poradi: count } })
    }
    categoryCache.set(nazev, cat.id)
    return cat.id
  }

  let imported = 0
  for (const p of products) {
    const catId = p.kategorie ? await getOrCreateCategory(p.kategorie) : null
    const effectiveKod = p.kod || p.nazev.toLowerCase().replace(/\s+/g, '-').substring(0, 30)

    await prisma.product.upsert({
      where: { orgId_effectiveKod: { orgId, effectiveKod } } as never,
      update: {
        nazev: p.nazev,
        standardniCena: p.standardniCena,
        dphSazba: p.dphSazba,
        jednotka: p.jednotka,
        ...(catId ? { categories: { set: [{ id: catId }] } } : {}),
      },
      create: {
        orgId,
        nazev: p.nazev,
        kod: p.kod || null,
        jednotka: p.jednotka,
        standardniCena: p.standardniCena,
        dphSazba: p.dphSazba,
        ...(catId ? { categories: { connect: [{ id: catId }] } } : {}),
      },
    }).catch(() => {
      // Skip duplicates/errors
    })
    imported++
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { onboardingStep: 7 },
  })

  return NextResponse.json({ ok: true, imported })
}
