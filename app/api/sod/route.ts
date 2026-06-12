import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateSodCislo } from '@/lib/sodHelpers'
import { applySodFormOverrides, buildSodRenderData, renderSodTemplate } from '@/lib/sodRender'
import { isHtmlContent, sanitizeFullDocumentHtml } from '@/lib/sanitizeHtml'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const sods = await db.sod.findMany({
    where: { orgId },
    include: { deal: { include: { client: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(sods)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const { dealId, templateId, typ, ...rest } = body

  if (!dealId) return NextResponse.json({ error: 'dealId je povinný' }, { status: 400 })
  if (!templateId && !typ) return NextResponse.json({ error: 'templateId nebo typ je povinný' }, { status: 400 })

  const deal = await db.deal.findFirst({ where: { id: dealId, orgId } })
  if (!deal) return NextResponse.json({ error: 'Deal nenalezen' }, { status: 404 })

  const cislo = await generateSodCislo(orgId)

  // Template-based generation
  let textSmlouvy: string | null = null
  let resolvedTyp = typ ?? 'DPH_21_SE_ZALOHOU'

  let prefillData: Awaited<ReturnType<typeof buildSodRenderData>> | null = null
  if (templateId) {
    const template = await db.contractTemplate.findFirst({ where: { id: templateId, orgId } })
    if (!template) return NextResponse.json({ error: 'Šablona nenalezena' }, { status: 404 })
    prefillData = await buildSodRenderData(dealId, orgId, cislo)
    textSmlouvy = renderSodTemplate(template.obsah, applySodFormOverrides(prefillData, rest))
    // šablony uložené před zavedením sanitizace
    if (isHtmlContent(textSmlouvy)) textSmlouvy = sanitizeFullDocumentHtml(textSmlouvy)
    if (template.typSablony && template.typSablony !== 'text') {
      resolvedTyp = template.typSablony as string
    }
  }

  const sod = await db.sod.create({
    data: {
      orgId,
      dealId,
      cislo,
      typ: resolvedTyp,
      templateId: templateId ?? null,
      textSmlouvy,
      klientJmeno: rest.klientJmeno ?? prefillData?.klientJmeno ?? '',
      predmetDila: rest.predmetDila ?? prefillData?.predmet ?? '',
      klientAdresa: rest.klientAdresa ?? prefillData?.klientAdresa ?? null,
      klientEmail: rest.klientEmail ?? prefillData?.klientEmail ?? null,
      klientTelefon: rest.klientTelefon ?? prefillData?.klientTelefon ?? null,
      klientIco: rest.klientIco ?? prefillData?.klientIco ?? null,
      klientDic: rest.klientDic ?? prefillData?.klientDic ?? null,
      kontaktniOsoba: rest.kontaktniOsoba ?? prefillData?.kontaktniOsoba ?? null,
      kontaktniTelefon: rest.kontaktniTelefon ?? prefillData?.kontaktniTelefon ?? null,
      adresaDila: rest.adresaDila ?? prefillData?.adresaDila ?? null,
      terminPrevzeti: rest.terminPrevzeti ?? null,
      pocetDniRealizace: rest.pocetDniRealizace ?? null,
      zmenaTerm: rest.zmenaTerm ?? null,
      cenaBezDph: rest.cenaBezDph ?? null,
      cenaSDph: rest.cenaSDph ?? null,
      dphSazba: rest.dphSazba ?? 21,
      zalohaKc: rest.zalohaKc ?? null,
      zalohaSplatnost: rest.zalohaSplatnost ?? 14,
      zalohaKategorie: rest.zalohaKategorie ?? null,
      poznamky: rest.poznamky ?? null,
    },
  })

  return NextResponse.json(sod, { status: 201 })
}
