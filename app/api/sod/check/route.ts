import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

// Placeholdery které lze doplnit při generování a mohou být prázdné
const CHECKABLE: Array<{ key: string; prefillFn: (deal: Deal) => string }> = [
  { key: 'termin_prevzeti', prefillFn: d => d.terminPrevzeti ? new Date(d.terminPrevzeti).toLocaleDateString('cs-CZ') : '' },
  { key: 'pocet_dni_realizace', prefillFn: () => '' },
  { key: 'zmena_term', prefillFn: () => '' },
  { key: 'hodnota_zalohy', prefillFn: d => d.hodnotaZalohy ? String(d.hodnotaZalohy) : '' },
  { key: 'zaloha_splatnost', prefillFn: () => '14' },
  { key: 'klient_adresa', prefillFn: d => [d.client?.ulice, d.client?.psc, d.client?.mesto].filter(Boolean).join(', ') },
  { key: 'klient_email', prefillFn: d => d.client?.email ?? '' },
  { key: 'klient_telefon', prefillFn: d => d.client?.telefon ?? '' },
  { key: 'klient_ico', prefillFn: d => d.client?.ico ?? '' },
  { key: 'klient_dic', prefillFn: d => d.client?.dic ?? '' },
]

type Deal = {
  terminPrevzeti: Date | null
  hodnotaZalohy: unknown
  client: {
    ulice: string | null; psc: string | null; mesto: string | null
    email: string | null; telefon: string | null; ico: string | null; dic: string | null
  }
  quotes: Array<{ dphSazba: unknown; items: Array<{ mnozstvi: unknown; cenaZaKus: unknown; sleva: unknown }> }>
  dphSazba?: unknown
}

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

  const emptyPlaceholders = CHECKABLE
    .filter(({ key, prefillFn }) => usedInTemplate.has(key) && !prefillFn(deal as Deal))
    .map(({ key }) => key)

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
      terminPrevzeti: deal.terminPrevzeti ? new Date(deal.terminPrevzeti).toLocaleDateString('cs-CZ') : '',
      pocetDniRealizace: '',
      zmenaTerm: '',
      zalohaKc: defaultZaloha,
      zalohaSplatnost: 14,
      cenaBezDph,
      cenaSDph,
      dphSazba,
    },
  })
}
