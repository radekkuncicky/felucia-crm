import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { buildSodRenderData, sodPlaceholderValues } from '@/lib/sodRender'
import { formatDate } from '@/lib/format'

// Placeholdery, které se nikdy nevyplňují ručně (auto / nemá smysl je
// ukazovat jako prázdné pole k doplnění).
const NEVYPLNUJ_RUCNE = new Set(['org_logo_bw', 'cislo_smlouvy', 'datum'])

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { searchParams } = new URL(req.url)
  const dealId = searchParams.get('dealId')
  const templateId = searchParams.get('templateId')
  if (!dealId || !templateId) return NextResponse.json({ error: 'Chybí parametry' }, { status: 400 })

  const [template, deal] = await Promise.all([
    db.contractTemplate.findFirst({
      where: { id: templateId, orgId },
      select: { obsah: true, typSablony: true },
    }),
    db.deal.findFirst({
      where: { id: dealId, orgId },
      include: {
        client: true,
        quotes: { where: { aktivni: true }, include: { items: true }, take: 1 },
      },
    }),
  ])

  if (!template) return NextResponse.json({ error: 'Šablona nenalezena' }, { status: 404 })
  if (!deal) return NextResponse.json({ error: 'Zakázka nenalezena' }, { status: 404 })

  const usedInTemplate = new Set(
    Array.from(template.obsah.matchAll(/\{\{(\w+)\}\}/g), m => m[1])
  )

  // Skutečné hodnoty placeholderů (stejná cesta jako generování) → prázdné =
  // ty, které šablona používá, ale po naplnění z OP zůstanou prázdné. Tím
  // sedí počet ve varování s počtem polí k doplnění v modalu.
  const values = sodPlaceholderValues(await buildSodRenderData(dealId, orgId, 'NÁHLED'))
  const emptyPlaceholders = Array.from(usedInTemplate).filter(
    k => !NEVYPLNUJ_RUCNE.has(k) && String(values[k] ?? '').trim() === ''
  )

  const seZalohou = usedInTemplate.has('hodnota_zalohy') || usedInTemplate.has('zaloha_splatnost')

  const quote = deal.quotes[0] ?? null
  const cenaBezDph = quote
    ? Math.round(quote.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100), 0))
    : 0
  const dphSazba = Number(quote?.dphSazba ?? (deal as { dphSazba?: unknown }).dphSazba ?? 21)
  const cenaSDph = Math.round(cenaBezDph * (1 + dphSazba / 100))
  const defaultZaloha = deal.hodnotaZalohy ? Math.round(Number(deal.hodnotaZalohy)) : Math.round(cenaSDph * 0.7)

  return NextResponse.json({
    emptyPlaceholders,
    usedPlaceholders: Array.from(usedInTemplate),
    seZalohou,
    prefill: {
      terminPrevzeti: deal.terminPrevzeti ? formatDate(deal.terminPrevzeti) : '',
      pocetDniRealizace: '',
      zmenaTerm: '',
      kontaktniOsoba: values['kontaktni_osoba'] ?? '',
      kontaktniTelefon: values['kontaktni_telefon'] ?? '',
      zalohaKc: defaultZaloha,
      zalohaSplatnost: 14,
      cenaBezDph,
      cenaSDph,
      dphSazba,
    },
  })
}
