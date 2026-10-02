import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { HomePage } from '@/components/marketing/homepage/HomePage'
import { FUNKCE, HERO } from '@/components/marketing/homepage/content'
import { planSouhrn } from '@/components/marketing/homepage/planSouhrn'
import { CONTACT, FAQS, PLANS, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/landing'

const TITLE = SITE_TITLE
const DESCRIPTION = SITE_DESCRIPTION
const OG_ALT = `Felucia: ${HERO.h1}`

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    locale: 'cs_CZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

// Organization a WebSite jsou site-wide v app/layout.tsx; tady produkt, ceník a FAQ.
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
        primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}/opengraph-image`, caption: OG_ALT },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Řízení zakázek, montáží a servisu',
        operatingSystem: 'Web, iOS',
        inLanguage: 'cs',
        description: DESCRIPTION,
        featureList: FUNKCE.map(f => f.titulek),
        audience: {
          '@type': 'BusinessAudience',
          audienceType: 'Montážní a servisní firmy: tepelná čerpadla, klimatizace, rekuperace, podlahové vytápění, vzduchotechnika',
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
            valueAddedTaxIncluded: false,
            unitText: 'firma a měsíc',
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
          },
          description: planSouhrn(p.id),
          url: `${SITE_URL}/#ceny`,
          availability: 'https://schema.org/InStock',
          seller: { '@id': `${SITE_URL}/#organization` },
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
      <HomePage />
    </>
  )
}
