import localFont from 'next/font/local'

// Geist Mono pro štítky dokladů - lokálně z app/fonts (bez dotazu na Google).
// Inter a Space Grotesk načítá root layout (proměnné --font-inter, --font-space-grotesk).
export const geistMono = localFont({
  src: '../../app/fonts/GeistMonoVF.woff',
  variable: '--mk-font-mono',
  weight: '100 900',
  display: 'swap',
  // Jen štítky dokladů - nepřednačítat, ať nekonkuruje písmům nad ohybem (LCP).
  preload: false,
})
