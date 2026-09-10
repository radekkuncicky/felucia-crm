import type { OrgPrismaClient } from '@/lib/orgPrisma'
import { generateSodCislo } from '@/lib/sodHelpers'
import { applySodFormOverrides, buildSodRenderData, renderSodTemplate } from '@/lib/sodRender'
import { isHtmlContent, sanitizeFullDocumentHtml } from '@/lib/sanitizeHtml'

const SOD_TYP_VALUES = ['DPH_12_BEZ_ZALOHY', 'DPH_12_SE_ZALOHOU', 'DPH_21_BEZ_ZALOHY', 'DPH_21_SE_ZALOHOU', 'PDP_BEZ_ZALOHY', 'PDP_SE_ZALOHOU']

export type SodCreateForm = Record<string, unknown>

/**
 * Vytvoření SOD z OP — sdílené jádro webového /api/sod a mobilního
 * /api/mobile/obchod/pripady/[id]/sod. Ceny a klient se předvyplní
 * z aktivní nabídky OP (buildSodRenderData), `form` (pole formuláře)
 * a `overrides` (holé placeholdery) mají přednost.
 */
export async function createSodFromDeal(
  db: OrgPrismaClient,
  orgId: string,
  params: {
    dealId: string
    templateId?: string | null
    typ?: string | null
    overrides?: Record<string, string>
    form?: SodCreateForm
  },
) {
  const { dealId, templateId } = params
  const overrides = params.overrides ?? {}
  const rest = params.form ?? {}
  const ov = (k: string) => {
    const v = overrides[k]
    return v != null && String(v).trim() !== '' ? String(v) : undefined
  }

  const cislo = await generateSodCislo(orgId)

  let textSmlouvy: string | null = null
  let resolvedTyp = params.typ ?? 'DPH_21_SE_ZALOHOU'

  // Vždy spočítat z aktivní nabídky OP — i mimo šablonový flow je to fallback
  // pro cenaBezDph/cenaSDph/dphSazba níže, ať DB sloupce sedí s vygenerovanou
  // smlouvou (dřív se u šablon vůbec nepoužilo, Cena v přehledu SOD zůstala prázdná).
  const prefillData = await buildSodRenderData(dealId, orgId, cislo)
  if (templateId) {
    const template = await db.contractTemplate.findFirst({ where: { id: templateId, orgId } })
    if (!template) return { error: 'Šablona nenalezena' as const }
    textSmlouvy = renderSodTemplate(template.obsah, applySodFormOverrides(prefillData, rest), overrides)
    // šablony uložené před zavedením sanitizace
    if (isHtmlContent(textSmlouvy)) textSmlouvy = sanitizeFullDocumentHtml(textSmlouvy)
    if (template.typSablony && SOD_TYP_VALUES.includes(template.typSablony)) {
      resolvedTyp = template.typSablony
    }
  }

  const sod = await db.sod.create({
    data: {
      orgId,
      dealId,
      cislo,
      typ: resolvedTyp as never,
      templateId: templateId ?? null,
      textSmlouvy,
      klientJmeno: (rest.klientJmeno as string) ?? ov('klient_jmeno') ?? prefillData?.klientJmeno ?? '',
      predmetDila: (rest.predmetDila as string) ?? ov('predmet') ?? prefillData?.predmet ?? '',
      klientAdresa: (rest.klientAdresa as string) ?? ov('klient_adresa') ?? prefillData?.klientAdresa ?? null,
      klientEmail: (rest.klientEmail as string) ?? ov('klient_email') ?? prefillData?.klientEmail ?? null,
      klientTelefon: (rest.klientTelefon as string) ?? ov('klient_telefon') ?? prefillData?.klientTelefon ?? null,
      klientIco: (rest.klientIco as string) ?? ov('klient_ico') ?? prefillData?.klientIco ?? null,
      klientDic: (rest.klientDic as string) ?? ov('klient_dic') ?? prefillData?.klientDic ?? null,
      kontaktniOsoba: (rest.kontaktniOsoba as string) ?? ov('kontaktni_osoba') ?? prefillData?.kontaktniOsoba ?? null,
      kontaktniTelefon: (rest.kontaktniTelefon as string) ?? ov('kontaktni_telefon') ?? prefillData?.kontaktniTelefon ?? null,
      adresaDila: (rest.adresaDila as string) ?? ov('adresa_dila') ?? prefillData?.adresaDila ?? null,
      terminPrevzeti: (rest.terminPrevzeti as string) ?? null,
      pocetDniRealizace: (rest.pocetDniRealizace as number) ?? null,
      zmenaTerm: (rest.zmenaTerm as string) ?? null,
      cenaBezDph: (rest.cenaBezDph as number) ?? prefillData.cenaBezDphRaw,
      cenaSDph: (rest.cenaSDph as number) ?? prefillData.cenaSDphRaw,
      dphSazba: (rest.dphSazba as number) ?? prefillData.dphSazbaRaw,
      zalohaKc: (rest.zalohaKc as number) ?? null,
      zalohaSplatnost: (rest.zalohaSplatnost as number) ?? 14,
      zalohaKategorie: (rest.zalohaKategorie as string) ?? null,
      poznamky: (rest.poznamky as string) ?? null,
      ...(rest.prilohaNabidka !== undefined ? { prilohaNabidka: Boolean(rest.prilohaNabidka) } : {}),
      ...(rest.prilohaVop !== undefined ? { prilohaVop: Boolean(rest.prilohaVop) } : {}),
      ...(rest.prilohaVzsp !== undefined ? { prilohaVzsp: Boolean(rest.prilohaVzsp) } : {}),
      ...(rest.prilohaCenik !== undefined ? { prilohaCenik: Boolean(rest.prilohaCenik) } : {}),
    },
  })

  // Termín realizace vybraný v kalendáři (ISO od–do) se propíše do OP:
  // terminRealizace = začátek (předání staveniště), terminPrevzeti = konec (předání díla)
  // → kalendář pak ukáže realizaci jako pruh od–do.
  const od = parseIsoDate(rest.terminRealizaceOd)
  const doo = parseIsoDate(rest.terminRealizaceDo)
  if (od || doo) {
    await db.deal.update({
      where: { id: dealId },
      data: {
        ...(od ? { terminRealizace: od } : {}),
        ...(doo ? { terminPrevzeti: doo } : {}),
      },
    })
  }

  return { sod }
}

function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}
