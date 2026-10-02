import { CONTACT, FAQS, OPERATOR, PLANS, SITE_DESCRIPTION, SITE_URL, formatPrice } from '@/lib/landing'
import { FUNKCE, JAK, KROKY, PATICKA, TECHNICI } from '@/components/marketing/homepage/content'
import { planSouhrn, podpisDostupnostVeta, servisPlany } from '@/components/marketing/homepage/planSouhrn'
import { formatDasaDostupnost } from '@/lib/dasaLimits'

// llms.txt (https://llmstxt.org) - stručný, věcný přehled webu pro jazykové
// modely a AI vyhledávače. Generuje se ze stejných dat jako homepage a JSON-LD.
function build(): string {
  const plans = PLANS.map(p =>
    p.price === null
      ? `- **${p.name}**: individuální nabídka. ${planSouhrn(p.id)}`
      : `- **${p.name}**: ${formatPrice(p.price)} Kč bez DPH za firmu a měsíc. ${planSouhrn(p.id)}`
  ).join('\n')

  const steps = KROKY.map(k =>
    `${k.cislo}. **${k.nazev}** (${k.kdo})\n${k.body.map(b => `   - ${b}`).join('\n')}\n   - Přechází dál: ${k.dal}`
  ).join('\n')
  const features = FUNKCE.map(f => `- **${f.titulek}**: ${f.text}`).join('\n')
  const faq = FAQS.map(f => `### ${f.q}\n${f.a}`).join('\n\n')

  return `# Felucia

> ${SITE_DESCRIPTION}

Felucia (${SITE_URL}) je český systém pro montážní a servisní firmy (tepelná čerpadla, klimatizace, rekuperace, podlahové vytápění, vzduchotechnika). Drží jednu zakázku v jednom záznamu od poptávky přes smlouvu, sklad a práci technika až po vyúčtování a servis: co obchodník prodal, to technik namontuje; co technik skutečně použil, to se vyúčtuje; co se namontovalo, to se servisuje. ${PATICKA.puvod} Provozuje ${OPERATOR.name} (IČO ${OPERATOR.ico}, ${OPERATOR.city}, Česká republika). Jazyk produktu i webu: čeština.

(English: Felucia is a Czech job-management system for HVAC installation and service companies: one job record from inquiry through contract, stock and technician work to billing and recurring service.)

## Pro koho

- Montážní a servisní firmy o 3 až 30 lidech, kancelář plus technici v terénu
- Primární cesta k produktu: 20minutová osobní ukázka, první firmy se zavádějí osobně a postupně

## Jak Felucia funguje (${JAK.h2.toLowerCase()})

${JAK.podtitulek}

${steps}

Příklad: v nabídce je 10 m potrubí, při montáži se použije 12 m. Technik skutečné množství zapíše do předávacího protokolu, Manažer zakázek ho schválí a vyúčtování vznikne z protokolu s 12 m.

Elektronický podpis ověřený SMS kódem: ${podpisDostupnostVeta()}
Servisní modul: plány ${servisPlany()}.
AI asistentka Dáša: ${formatDasaDostupnost()}.

## Funkce

${features}

## Aplikace pro techniky (Felucia Tech)

${TECHNICI.body.map(b => `- ${b}`).join('\n')}
- Bez signálu: ${TECHNICI.offline}
- Aplikace je pro iOS. ${TECHNICI.android}

## Ceník

${plans}

## Časté otázky

${faq}

## Kontakt

- Web: ${SITE_URL}
- Ukázka / poptávka: ${SITE_URL}/#ukazka
- E-mail: ${CONTACT.email}
- Telefon: ${CONTACT.phoneDisplay} (+420)
- Podpora: ${SITE_URL}/support
- Obchodní podmínky: ${SITE_URL}/terms
- Ochrana osobních údajů: ${SITE_URL}/privacy

## Odkazy

- [Domovská stránka](${SITE_URL}/): pozice produktu, průchod zakázkou, aplikace pro techniky, servis, ceník, FAQ, formulář na ukázku
- [Podpora](${SITE_URL}/support): kontakty na podporu
- [Všeobecné obchodní podmínky](${SITE_URL}/terms)
- [Zásady ochrany osobních údajů](${SITE_URL}/privacy)
`
}

export function GET() {
  return new Response(build(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
