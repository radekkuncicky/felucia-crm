import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'
import { generateSodHtml } from './sodDocument'
import { generatePdf } from './pdf'
import { buildDokumentChrome } from './dokumentyChrome'
import { renderSodContractHtml } from './sodContractHtml'
import { renderQuotePdf } from './quoteRenderer'
import { mergePdfs } from './mergePdfs'
import { sodPodpisBlockHtml, appendPodpisBlock } from './sodPodpis'
import { formatDate } from './format'
import fs from 'fs'
import path from 'path'

type SodWithOrg = NonNullable<Awaited<ReturnType<typeof loadSod>>>

async function loadSod(sodId: string, orgId: string) {
  return orgPrisma(orgId).sod.findFirst({
    where: { id: sodId, orgId },
    include: {
      organization: {
        select: {
          nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true, plan: true,
          prilohaVopPath: true, prilohaVzspPath: true, prilohaCenikPath: true,
        },
      },
    },
  })
}

/** HTML těla smlouvy (textSmlouvy nebo výchozí dokument) vč. podpisového bloku, je-li podepsáno */
export function buildSodContentHtml(sod: SodWithOrg): string {
  const html = sod.textSmlouvy
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
  return appendPodpisBlock(html, sodPodpisBlockHtml(sod))
}

/**
 * Kompletní PDF smlouvy vč. záhlaví/patičky a příloh (nabídka, VOP, VZSP,
 * ceník). Bez session — plan se bere z organizace; použitelné i z veřejné
 * routy po podpisu a z e-mailů.
 */
export async function buildSodPdf(
  sodId: string,
  orgId: string
): Promise<{ pdf: Buffer; cislo: string } | null> {
  const sod = await loadSod(sodId, orgId)
  if (!sod) return null

  // Podepsaná smlouva se renderuje ze snapshotu podepsané verze — pozdější
  // editace textu nesmí změnit dokument, pod kterým je podpis a hash.
  let html: string | null = null
  if (sod.stav === 'PODEPSANO') {
    const db = orgPrisma(orgId)
    const relace = await db.sodPodpisRelace.findFirst({
      where: { sodId, stav: 'PODEPSANA' },
      orderBy: { vytvoreno: 'desc' },
      select: { verzeId: true },
    })
    const verze = relace?.verzeId
      ? await db.sodVerze.findFirst({ where: { id: relace.verzeId, orgId } })
      : null
    if (verze) html = appendPodpisBlock(verze.textSmlouvy, sodPodpisBlockHtml(sod))
  }
  if (!html) html = buildSodContentHtml(sod)
  const chrome = await buildDokumentChrome(orgId, sod.organization.plan)
  const sodPdf = await generatePdf(html, chrome)

  const pdfParts: Buffer[] = [sodPdf]

  // Cenová nabídka
  if (sod.prilohaNabidka && sod.dealId) {
    try {
      const activeQuote = await prisma.quote.findFirst({
        where: { dealId: sod.dealId, orgId, aktivni: true },
        select: { id: true },
      })
      if (activeQuote) {
        pdfParts.push(await renderQuotePdf(activeQuote.id, orgId, sod.organization.plan))
      }
    } catch { /* skip if quote PDF fails */ }
  }

  // Statické přílohy (VOP, VZSP, Ceník)
  const attachDefs: { flag: boolean; pathField: string | null | undefined }[] = [
    { flag: sod.prilohaVop,   pathField: sod.organization.prilohaVopPath },
    { flag: sod.prilohaVzsp,  pathField: sod.organization.prilohaVzspPath },
    { flag: sod.prilohaCenik, pathField: sod.organization.prilohaCenikPath },
  ]
  for (const { flag, pathField } of attachDefs) {
    if (!flag || !pathField) continue
    try {
      pdfParts.push(fs.readFileSync(path.join(process.cwd(), 'public', pathField)))
    } catch { /* file missing — skip */ }
  }

  const pdf = pdfParts.length > 1 ? await mergePdfs(pdfParts) : pdfParts[0]
  return { pdf, cislo: sod.cislo }
}
