import { Literata, Sometype_Mono } from 'next/font/google'

// Písmo webu (jen homepage, CRM má dál Inter/Space Grotesk z root layoutu):
// - nadpisy Literata (TypeTogether, Veronika Burian) - variabilní vč. optické velikosti,
// - text Atkinson Hyperlegible Next - Next 14 ho v next/font/google nemá, hostujeme ho
//   v public/marketing/fonts/atkinson (mimo middleware) (@font-face v marketing.css),
// - štítky dokladů Sometype Mono.
export const literata = Literata({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
  variable: '--mk-font-serif',
  display: 'swap',
})

export const sometypeMono = Sometype_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--mk-font-mono',
  display: 'swap',
  // Jen štítky dokladů - nepřednačítat, ať nekonkuruje písmům nad ohybem (LCP).
  preload: false,
})
