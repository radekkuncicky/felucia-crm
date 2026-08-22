import { prisma } from './prisma'
import { predmetDilaByTechnologie, kategorieByTechnologie } from './sodHelpers'
import { orgLogoDataUrl } from './quoteRenderer'
import { formatDate, formatKc } from '@/lib/format'

export interface SodRenderData {
  cisloSmlouvy: string
  datum: string
  klientJmeno: string
  klientAdresa: string
  klientEmail: string
  klientTelefon: string
  klientIco: string
  klientDic: string
  kontaktniOsoba: string
  kontaktniTelefon: string
  predmet: string
  adresaDila: string
  obchodnik: string
  terminRealizace: string
  terminPrevzeti: string
  pocetDniRealizace: string
  hodnotaZalohy: string
  zalohaSplatnost: string
  konecnaCena: string
  cenaSDph: string
  dphSazba: string
  /** Nezaokrouhlená čísla pro DB (Sod.cenaBezDph/cenaSDph/dphSazba) — konecnaCena/cenaSDph/dphSazba výše jsou jen formátovaný text pro placeholdery. */
  cenaBezDphRaw: number
  cenaSDphRaw: number
  dphSazbaRaw: number
  kodOP: string
  organizace: string
  orgSidlo: string
  orgIco: string
  orgDic: string
  zmenaTerm: string
  technologie: string
  orgLogoBw: string
}

function buildLogoBwHtml(logoBwPath: string | null | undefined): string {
  const dataUrl = orgLogoDataUrl(logoBwPath)
  if (dataUrl) return `<img src="${dataUrl}" alt="logo" style="height:22px;max-width:110px;object-fit:contain;display:block;" />`
  return '<div class="brand-mark"></div>'
}

const fmtKc = formatKc
const fmtKcDecimal = (n: unknown) => n != null ? formatKc(Number(n)) : ''

export function buildSodRenderDataFromSodRecord(
  sod: {
    cislo: string; vytvoreno: Date
    klientJmeno: string; klientAdresa: string | null; klientEmail: string | null
    klientTelefon: string | null; klientIco: string | null; klientDic: string | null
    kontaktniOsoba: string | null; kontaktniTelefon: string | null
    predmetDila: string; adresaDila: string | null
    terminPrevzeti: string | null; pocetDniRealizace: number | null; zmenaTerm: string | null
    cenaBezDph: unknown; cenaSDph: unknown; dphSazba: unknown
    zalohaKc: unknown; zalohaSplatnost: number | null
  },
  org: { nazev: string | null; sidlo: string | null; ico: string | null; dic: string | null; logoBw?: string | null }
): SodRenderData {
  return {
    cisloSmlouvy: sod.cislo,
    datum: formatDate(sod.vytvoreno),
    klientJmeno: sod.klientJmeno ?? '',
    klientAdresa: sod.klientAdresa ?? '',
    klientEmail: sod.klientEmail ?? '',
    klientTelefon: sod.klientTelefon ?? '',
    klientIco: sod.klientIco ?? '',
    klientDic: sod.klientDic ?? '',
    kontaktniOsoba: sod.kontaktniOsoba ?? sod.klientJmeno ?? '',
    kontaktniTelefon: sod.kontaktniTelefon ?? sod.klientTelefon ?? '',
    predmet: sod.predmetDila ?? '',
    adresaDila: sod.adresaDila ?? sod.klientAdresa ?? '',
    obchodnik: '',
    terminRealizace: '',
    terminPrevzeti: sod.terminPrevzeti ?? '',
    pocetDniRealizace: sod.pocetDniRealizace != null ? String(sod.pocetDniRealizace) : '',
    hodnotaZalohy: fmtKcDecimal(sod.zalohaKc),
    zalohaSplatnost: sod.zalohaSplatnost != null ? String(sod.zalohaSplatnost) : '',
    konecnaCena: fmtKcDecimal(sod.cenaBezDph),
    cenaSDph: fmtKcDecimal(sod.cenaSDph),
    dphSazba: sod.dphSazba != null ? String(Number(sod.dphSazba)) : '',
    cenaBezDphRaw: sod.cenaBezDph != null ? Number(sod.cenaBezDph) : 0,
    cenaSDphRaw: sod.cenaSDph != null ? Number(sod.cenaSDph) : 0,
    dphSazbaRaw: sod.dphSazba != null ? Number(sod.dphSazba) : 21,
    kodOP: '',
    organizace: org.nazev ?? '',
    orgSidlo: org.sidlo ?? '',
    orgIco: org.ico ?? '',
    orgDic: org.dic ?? '',
    zmenaTerm: sod.zmenaTerm ?? '',
    technologie: '',
    orgLogoBw: buildLogoBwHtml(org.logoBw),
  }
}

/**
 * Hodnoty z formuláře smlouvy (POST /api/sod) mají přednost před daty z OP —
 * bez tohoto merge by placeholdery jako {{pocet_dni_realizace}} nebo
 * {{zmena_term}} zůstaly v textu prázdné.
 */
export function applySodFormOverrides(data: SodRenderData, form: Record<string, unknown>): SodRenderData {
  const out = { ...data }
  if (form.pocetDniRealizace != null) out.pocetDniRealizace = String(form.pocetDniRealizace)
  if (form.zmenaTerm != null) out.zmenaTerm = String(form.zmenaTerm)
  if (form.terminPrevzeti != null) out.terminPrevzeti = String(form.terminPrevzeti)
  if (form.zalohaSplatnost != null) out.zalohaSplatnost = String(form.zalohaSplatnost)
  if (form.dphSazba != null) out.dphSazba = String(form.dphSazba)
  if (form.zalohaKc != null) out.hodnotaZalohy = fmtKc(Number(form.zalohaKc))
  if (form.cenaBezDph != null) out.konecnaCena = fmtKc(Number(form.cenaBezDph))
  if (form.cenaSDph != null) out.cenaSDph = fmtKc(Number(form.cenaSDph))
  return out
}

export async function buildSodRenderData(dealId: string, orgId: string, cisloSmlouvy: string): Promise<SodRenderData> {
  const [deal, org] = await Promise.all([
    prisma.deal.findFirst({
      where: { id: dealId, orgId },
      include: {
        client: true,
        user: { select: { jmeno: true } },
        quotes: {
          where: { aktivni: true },
          include: { items: true },
          take: 1,
        },
      },
    }),
    prisma.organization.findFirst({
      where: { id: orgId },
      select: { nazev: true, sidlo: true, ico: true, dic: true, logoBw: true },
    }),
  ])

  if (!deal || !org) throw new Error('Deal nebo organizace nenalezena')

  const quote = deal.quotes[0] ?? null
  const cenaBezDph = quote
    ? quote.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100), 0)
    : 0
  const dphSazba = Number(quote?.dphSazba ?? 21)
  const cenaSDph = cenaBezDph * (1 + dphSazba / 100)

  const klientJmeno = `${deal.client.jmeno} ${deal.client.prijmeni}`.trim()
  const klientAdresa = [deal.client.ulice, deal.client.psc, deal.client.mesto].filter(Boolean).join(', ')
  const adresaDila = deal.adresaDila ?? klientAdresa ?? ''

  const fmtKc = formatKc
  const fmtDate = (d: Date | null | undefined) => d ? formatDate(d) : ''

  return {
    cisloSmlouvy,
    datum: formatDate(new Date()),
    klientJmeno,
    klientAdresa,
    klientEmail: deal.client.email ?? '',
    klientTelefon: deal.client.telefon ?? '',
    klientIco: deal.client.ico ?? '',
    klientDic: deal.client.dic ?? '',
    kontaktniOsoba: deal.kontaktniOsoba ?? klientJmeno,
    kontaktniTelefon: deal.kontaktniTelefon ?? deal.client.telefon ?? '',
    predmet: deal.predmet ?? predmetDilaByTechnologie(deal.technologie ?? ''),
    adresaDila,
    obchodnik: deal.user?.jmeno ?? '',
    terminRealizace: fmtDate(deal.terminRealizace),
    terminPrevzeti: fmtDate(deal.terminPrevzeti),
    pocetDniRealizace: '',
    hodnotaZalohy: deal.hodnotaZalohy ? fmtKc(Number(deal.hodnotaZalohy)) : fmtKc(Math.round(cenaSDph * 0.7)),
    zalohaSplatnost: '14',
    konecnaCena: fmtKc(Math.round(cenaBezDph)),
    cenaSDph: fmtKc(Math.round(cenaSDph)),
    dphSazba: String(dphSazba),
    cenaBezDphRaw: Math.round(cenaBezDph),
    cenaSDphRaw: Math.round(cenaSDph),
    dphSazbaRaw: dphSazba,
    kodOP: deal.kod ?? '',
    organizace: org.nazev ?? '',
    orgSidlo: org.sidlo ?? '',
    orgIco: org.ico ?? '',
    orgDic: org.dic ?? '',
    zmenaTerm: '',
    technologie: kategorieByTechnologie(deal.technologie ?? ''),
    orgLogoBw: buildLogoBwHtml(org.logoBw),
  }
}

// Hodnoty placeholderů klíčované holým názvem (bez {{}}). Sdílí render i
// kontrola prázdných polí (/api/sod/check), aby seznam i text byly konzistentní.
export function sodPlaceholderValues(data: SodRenderData): Record<string, string> {
  return {
    cislo_smlouvy: data.cisloSmlouvy,
    datum: data.datum,
    klient_jmeno: data.klientJmeno,
    klient_adresa: data.klientAdresa,
    klient_email: data.klientEmail,
    klient_telefon: data.klientTelefon,
    klient_ico: data.klientIco,
    klient_dic: data.klientDic,
    kontaktni_osoba: data.kontaktniOsoba,
    kontaktni_telefon: data.kontaktniTelefon,
    predmet: data.predmet,
    adresa_dila: data.adresaDila,
    obchodnik: data.obchodnik,
    termin_realizace: data.terminRealizace,
    termin_prevzeti: data.terminPrevzeti,
    pocet_dni_realizace: data.pocetDniRealizace,
    hodnota_zalohy: data.hodnotaZalohy,
    zaloha_splatnost: data.zalohaSplatnost,
    konecna_cena: data.konecnaCena,
    cena_s_dph: data.cenaSDph,
    dph_sazba: data.dphSazba,
    kod_op: data.kodOP,
    organizace: data.organizace,
    org_sidlo: data.orgSidlo,
    org_ico: data.orgIco,
    org_dic: data.orgDic,
    zmena_term: data.zmenaTerm,
    technologie: data.technologie,
    org_logo_bw: data.orgLogoBw,
  }
}

// overrides: holý název placeholderu -> hodnota (ruční doplnění z modalu),
// má přednost před daty z OP.
export function renderSodTemplate(
  obsah: string,
  data: SodRenderData,
  overrides?: Record<string, string>,
): string {
  const values = { ...sodPlaceholderValues(data) }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v != null && String(v).trim() !== '') values[k] = String(v)
    }
  }

  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value ?? ''),
    obsah
  )
}
