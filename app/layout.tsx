import type { Metadata, Viewport } from 'next'
import { Inter, Montserrat, Space_Grotesk } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import CookieConsent from './components/CookieConsent'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: {
    default: 'Felucia CRM — CRM pro HVAC firmy',
    template: '%s | Felucia CRM',
  },
  description: 'Felucia CRM je moderní CRM systém pro firmy v oblasti klimatizací, tepelných čerpadel, rekuperace a vzduchotechniky.',
  keywords: ['CRM', 'HVAC', 'klimatizace', 'tepelná čerpadla', 'rekuperace', 'zakázky'],
  authors: [{ name: 'Felucia', url: 'https://felucia.io' }],
  metadataBase: new URL('https://felucia.io'),
  openGraph: {
    title: 'Felucia CRM',
    description: 'CRM systém pro HVAC firmy',
    url: 'https://felucia.io',
    siteName: 'Felucia CRM',
    locale: 'cs_CZ',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
        <meta name="theme-color" content="#00D4C8" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Felucia" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="grovetech-vibe-verify" content="gtai-verify-orhdm2d0morjzphe" />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Felucia CRM',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              url: 'https://felucia.io',
              description: 'CRM systém pro HVAC firmy — klimatizace, tepelná čerpadla, rekuperace',
              offers: {
                '@type': 'Offer',
                price: '49',
                priceCurrency: 'CZK',
              },
            })
          }}
        />
      </head>
      <body className={`${inter.variable} ${montserrat.variable} ${spaceGrotesk.variable} ${inter.className}`}>
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  )
}
