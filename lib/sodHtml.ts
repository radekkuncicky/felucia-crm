import { Prisma, SodTyp } from '@prisma/client'
import { generateSodHtml } from './sodDocument'
import { renderSodContractHtml } from './sodContractHtml'
import { sha256, sodPodpisBlockHtml, sodZhotovitelBlockHtml, appendPodpisBlock } from './sodPodpis'
import { formatDate } from './format'

/**
 * Čisté sestavení HTML smlouvy (bez Puppeteeru) — použitelné i ze server
 * komponent. PDF vrstva je v lib/sodPdf.ts.
 */

export interface SodHtmlInput {
  cislo: string
  typ: SodTyp
  vytvoreno: Date
  textSmlouvy: string | null
  klientJmeno: string
  klientAdresa: string | null
  klientEmail: string | null
  klientTelefon: string | null
  klientIco: string | null
  klientDic: string | null
  kontaktniOsoba: string | null
  kontaktniTelefon: string | null
  predmetDila: string
  adresaDila: string | null
  terminPrevzeti: string | null
  pocetDniRealizace: number | null
  zmenaTerm: string | null
  cenaBezDph: Prisma.Decimal | null
  cenaSDph: Prisma.Decimal | null
  dphSazba: Prisma.Decimal
  zalohaKc: Prisma.Decimal | null
  zalohaSplatnost: number | null
  zalohaKategorie: string | null
  podpisSvg: string | null
  podepsano: Date | null
  podepsalJmeno: string | null
  podpisTextHash: string | null
  zhotovitelPodpisSvg: string | null
  zhotovitelPodepsano: Date | null
  zhotovitelPodepsalJmeno: string | null
  zhotovitelTextHash: string | null
  organization: {
    nazev: string
    sidlo: string | null
    ico: string | null
    dic: string | null
    email: string | null
    telefon: string | null
  }
}

/** HTML těla smlouvy bez podpisových bloků — z něj se počítá otisk interního podpisu */
export function buildSodBaseHtml(sod: SodHtmlInput): string {
  return sod.textSmlouvy
    ? renderSodContractHtml(sod.textSmlouvy)
    : generateSodHtml({
        cislo: sod.cislo,
        typ: sod.typ,
        datum: formatDate(sod.vytvoreno),
        klientJmeno: sod.klientJmeno,
        klientAdresa: sod.klientAdresa,
        klientEmail: sod.klientEmail,
        klientTelefon: sod.klientTelefon,
        klientIco: sod.klientIco,
        klientDic: sod.klientDic,
        kontaktniOsoba: sod.kontaktniOsoba,
        kontaktniTelefon: sod.kontaktniTelefon,
        predmetDila: sod.predmetDila,
        adresaDila: sod.adresaDila,
        terminPrevzeti: sod.terminPrevzeti,
        pocetDniRealizace: sod.pocetDniRealizace,
        zmenaTerm: sod.zmenaTerm,
        cenaBezDph: sod.cenaBezDph != null ? Number(sod.cenaBezDph) : null,
        cenaSDph: sod.cenaSDph != null ? Number(sod.cenaSDph) : null,
        dphSazba: Number(sod.dphSazba),
        zalohaKc: sod.zalohaKc != null ? Number(sod.zalohaKc) : null,
        zalohaSplatnost: sod.zalohaSplatnost,
        zalohaKategorie: sod.zalohaKategorie,
        org: sod.organization,
      })
}

/** Platí interní podpis pro aktuální text smlouvy? Editace po podpisu ho zneplatní. */
export function zhotovitelPodpisPlatny(sod: SodHtmlInput): boolean {
  return !!sod.zhotovitelPodepsano
    && !!sod.zhotovitelTextHash
    && sod.zhotovitelTextHash === sha256(buildSodBaseHtml(sod))
}

/** HTML těla smlouvy vč. podpisových bloků (interní podpis jen s platným otiskem) */
export function buildSodContentHtml(sod: SodHtmlInput): string {
  const base = buildSodBaseHtml(sod)
  let html = base
  if (sod.zhotovitelTextHash && sod.zhotovitelTextHash === sha256(base)) {
    html = appendPodpisBlock(html, sodZhotovitelBlockHtml(sod))
  }
  return appendPodpisBlock(html, sodPodpisBlockHtml(sod))
}
