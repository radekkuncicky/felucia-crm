import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import FeluciaLanding from './FeluciaLanding'
import { CONTACT, FAQS, FEATURE_LIST, PLANS, SITE_NAME, SITE_TITLE, SITE_URL, WORKFLOW_HEADING, WORKFLOW_PEREX, WORKFLOW_PHASES } from '@/lib/landing'

const TITLE = SITE_TITLE
const DESCRIPTION =
  'Od nabídky přes montáž až po pravidelný servis. Felucia propojí kancelář a techniky v jednom CRM — pro montážní a servisní firmy v oboru klimatizací a tepelných čerpadel.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: 'Nabídky, podklady k montáži, skutečně použitý materiál i předávací protokoly u jedné zakázky. Domluvte si 20minutovou ukázku.',
    url: '/',
    siteName: SITE_NAME,
    locale: 'cs_CZ',
    type: 'website',
  },
}

function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: `${SITE_URL}/`,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'cs',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#software` },
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: SITE_NAME,
        alternateName: 'Felucia CRM',
        url: `${SITE_URL}/`,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'CRM / řízení montáží a servisu',
        operatingSystem: 'Web',
        inLanguage: 'cs',
        description: DESCRIPTION,
        featureList: FEATURE_LIST,
        audience: {
          '@type': 'BusinessAudience',
          audienceType: 'Montážní a servisní firmy — klimatizace, tepelná čerpadla, rekuperace, vzduchotechnika',
          geographicArea: { '@type': 'Country', name: 'Česká republika' },
        },
        publisher: { '@id': `${SITE_URL}/#organization` },
        offers: PLANS.filter(p => p.price !== null).map(p => ({
          '@type': 'Offer',
          name: `Felucia ${p.name}`,
          price: String(p.price),
          priceCurrency: 'CZK',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: String(p.price),
            priceCurrency: 'CZK',
            unitText: 'měsíc',
          },
          description: p.features.join(', '),
          url: `${SITE_URL}/#ceny`,
          availability: 'https://schema.org/InStock',
        })),
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        inLanguage: 'cs',
        mainEntity: FAQS.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        // Průchod zakázkou ze sekce #jak-to-funguje - 9 kroků ve 4 fázích.
        // Zdroj textů: WORKFLOW_PHASES v lib/landing.ts.
        '@type': 'HowTo',
        '@id': `${SITE_URL}/#jak-to-funguje`,
        name: WORKFLOW_HEADING,
        description: WORKFLOW_PEREX,
        inLanguage: 'cs',
        totalTime: 'P1D',
        step: WORKFLOW_PHASES.map((phase, i) => ({
          '@type': 'HowToSection',
          position: i + 1,
          name: phase.name,
          itemListElement: phase.steps.map(st => ({
            '@type': 'HowToStep',
            position: st.n,
            name: st.title,
            text: st.desc,
            url: `${SITE_URL}/#jak-to-funguje`,
            itemListElement: st.bullets.map(b => ({ '@type': 'HowToDirection', text: b })),
          })),
        })),
      },
      {
        '@type': 'ContactPoint',
        '@id': `${SITE_URL}/#contact`,
        contactType: 'sales',
        email: CONTACT.email,
        telephone: CONTACT.phone,
        availableLanguage: ['cs'],
        areaServed: 'CZ',
      },
    ],
  }
}

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session && !session.user.isDemo) redirect('/dashboard')
  const nonce = headers().get('x-nonce') ?? undefined
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()).replace(/</g, '\\u003c') }}
      />
      <FeluciaLanding />
    </>
  )
}
