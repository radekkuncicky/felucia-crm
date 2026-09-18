import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'
import { orgLogoDataUrl } from './quoteRenderer'
import { buildDokumentChrome } from './dokumentyChrome'
import { generatePdf } from './pdf'
import { generateObjednavkaHtml } from './objednavkaPdf'
import { OBJEDNAVKA_INCLUDE, type ObjednavkaFull } from './objednavky'

/**
 * PDF objednávky — sdílené mezi stažením a e-mailem dodavateli.
 * Ceny se tisknou jen když je zapnutý přepínač na objednávce A volající je smí vidět.
 */
export async function renderObjednavkaPdf(orgId: string, plan: string, objednavka: ObjednavkaFull, smiVidetCeny: boolean) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true, logo: true },
  })
  if (!org) throw new Error('Organizace nenalezena')

  const zobrazitCeny = objednavka.zobrazitCeny && smiVidetCeny
  const html = generateObjednavkaHtml({
    cislo: objednavka.cislo,
    stav: objednavka.stav,
    vytvoreno: objednavka.vytvoreno.toISOString(),
    pozadovanyTermin: objednavka.pozadovanyTermin?.toISOString() ?? null,
    poznamka: objednavka.poznamka,
    vytvoril: objednavka.vytvoril,
    zobrazitCeny,
    odberatel: { ...org, logo: orgLogoDataUrl(org.logo) },
    dodavatel: objednavka.dodavatel,
    zakazka: objednavka.zakazka ? { cislo: objednavka.zakazka.cislo, nazev: objednavka.zakazka.nazev, mistoStavby: objednavka.zakazka.mistoStavby } : null,
    polozky: objednavka.polozky.map(p => ({
      objednaciKod: p.objednaciKod,
      nazev: p.nazev,
      mnozstvi: Number(p.mnozstvi),
      jednotka: p.jednotka,
      nakupniCena: zobrazitCeny && p.nakupniCena !== null ? Number(p.nakupniCena) : null,
    })),
  })
  const chrome = await buildDokumentChrome(orgId, plan)
  return generatePdf(html, chrome)
}

export async function loadObjednavkaFull(orgId: string, id: string) {
  return orgPrisma(orgId).objednavka.findFirst({ where: { id, orgId }, include: OBJEDNAVKA_INCLUDE })
}
