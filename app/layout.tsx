import type { Metadata, Viewport } from 'next'
import { Inter, Montserrat, Space_Grotesk } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import CookieConsent from './components/CookieConsent'
import { CONTACT, OPERATOR, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/landing'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION
const bingVerification = process.env.BING_SITE_VERIFICATION

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['software pro montážní firmy', 'software pro servisní firmy', 'CRM pro klimatizace', 'CRM pro tepelná čerpadla', 'řízení zakázek', 'servisní firma', 'montážní firma', 'rekuperace', 'vzduchotechnika', 'předávací protokol', 'aplikace pro techniky'],
  authors: [{ name: OPERATOR.name, url: SITE_URL }],
  creator: OPERATOR.name,
  publisher: OPERATOR.name,
  category: 'business',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  openGraph: {
    title: SITE_TITLE,
    description: 'Od nabídky přes montáž až po pravidelný servis. Propojte kancelář a techniky v jednom systému.',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'cs_CZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  ...(googleVerification || bingVerification
    ? { verification: { ...(googleVerification ? { google: googleVerification } : {}), ...(bingVerification ? { other: { 'msvalidate.01': bingVerification } } : {}) } }
    : {}),
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

// Site-wide entity graph (Organization + WebSite). Produkt/FAQ schema je na homepage (app/page.tsx).
function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: OPERATOR.name,
        legalName: OPERATOR.name,
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
        brand: { '@type': 'Brand', name: SITE_NAME },
        email: CONTACT.email,
        telephone: CONTACT.phone,
        identifier: { '@type': 'PropertyValue', propertyID: 'IČO', value: OPERATOR.ico },
        address: {
          '@type': 'PostalAddress',
          streetAddress: OPERATOR.street,
          addressLocality: OPERATOR.city,
          postalCode: OPERATOR.zip,
          addressCountry: OPERATOR.country,
        },
        contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales', email: CONTACT.email, telephone: CONTACT.phone, availableLanguage: ['cs'] }],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: 'cs',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Nonce z middlewaru — čtení headers() zároveň vynutí dynamické
  // renderování všech stránek (statický prerender by nonce neměl).
  const nonce = headers().get('x-nonce') ?? undefined
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4CAF50" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Felucia" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="grovetech-vibe-verify" content="gtai-verify-orhdm2d0morjzphe" />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className={`${inter.variable} ${montserrat.variable} ${spaceGrotesk.variable} ${inter.className}`}>
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  )
}
