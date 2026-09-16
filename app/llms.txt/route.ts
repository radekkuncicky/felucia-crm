import { CONTACT, FAQS, FEATURE_LIST, OPERATOR, PLANS, SITE_DESCRIPTION, SITE_URL, WORKFLOW_PEREX, WORKFLOW_PHASES, formatPrice } from '@/lib/landing'

// llms.txt (https://llmstxt.org) — stručný, věcný přehled webu pro jazykové
// modely a AI vyhledávače. Generuje se ze stejných dat jako landing a JSON-LD.
function build(): string {
  const plans = PLANS.map(p =>
    p.price === null
      ? `- **${p.name}**: individuální nabídka — ${p.features.join(', ')}`
      : `- **${p.name}**: ${formatPrice(p.price)} Kč/měsíc — ${p.features.join(', ')}`
  ).join('\n')

  const steps = WORKFLOW_PHASES.map(phase => {
    const list = phase.steps
      .map(st => {
        const badge = st.badge ? ` (${st.badge})` : ''
        const bullets = st.bullets.map(b => `   - ${b}`).join('\n')
        return `${st.n}. **${st.title}**${badge} - ${st.desc}\n${bullets}`
      })
      .join('\n')
    return `### Fáze: ${phase.name}\n\n${list}`
  }).join('\n\n')
  const features = FEATURE_LIST.map(f => `- ${f}`).join('\n')
  const faq = FAQS.map(f => `### ${f.q}\n${f.a}`).join('\n\n')

  return `# Felucia

> ${SITE_DESCRIPTION}

Felucia (${SITE_URL}) je český software pro montážní a servisní firmy — typicky menší firmy instalující klimatizace a tepelná čerpadla, kde majitel koordinuje obchod, zakázky a několik techniků v terénu. Propojuje kancelář a techniky: nabídky, podklady k montáži, skutečně použitý materiál i předávací protokoly jsou u konkrétní zakázky. Vyvinuto z každodenní praxe montáží a servisu. Provozuje ${OPERATOR.name} (IČO ${OPERATOR.ico}, ${OPERATOR.city}, Česká republika). Jazyk produktu i webu: čeština.

(English: Felucia is a Czech CRM / job-management system for HVAC installation and service companies — air conditioning and heat pumps — connecting the office with field technicians: quotes, work orders, mobile app for technicians, handover protocols, and follow-up service.)

## Pro koho

- Menší české montážní a servisní firmy (klimatizace, tepelná čerpadla, rekuperace, vzduchotechnika)
- Majitel/vedoucí koordinuje obchod, zakázky a několik techniků
- Primární cesta k produktu: 20minutová osobní ukázka, první firmy se zavádějí osobně a postupně

## Jak Felucia funguje (jedna zakázka od poptávky po servis)

${WORKFLOW_PEREX}

${steps}

Ilustrační příklad: v nabídce je 10 metrů potrubí, při montáži se použije 12. Technik skutečné množství zaznamená do protokolu a kancelář má podklad ke kontrole vyúčtování.

## Funkce

${features}

## Aplikace pro techniky (Felucia Tech)

Technik v telefonu vidí dnešní a nadcházející zakázky, navigaci a kontakty na stavbě, pokyny a dokumenty, odškrtává položky, přidává fotografie a komentáře, vyplní předávací protokol s plánovaným i skutečně použitým množstvím a podpisem zákazníka a odešle ho vedoucímu ke schválení. Servisní zásah: zpráva, závady, doporučení, čas a náklady. Část funkcí vyžaduje připojení k internetu; plně offline provoz není garantován.

## Ceník (Kč/měsíc)

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
