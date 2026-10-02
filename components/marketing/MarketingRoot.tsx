import { cn } from '@/lib/cn'
import { literata, sometypeMono } from './fonts'
import './marketing.css'

/** Kořen marketingové stránky: zapne tokeny .mk a písma webu (fonts.ts). */
export function MarketingRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mk min-h-screen', literata.variable, sometypeMono.variable, className)}>
      {/* Text webu (Atkinson, @font-face v marketing.css) - přednačíst, ať se vymění dřív (CLS, LCP).
          Čeština potřebuje nad ohybem obě sady znaků. */}
      <link rel="preload" href="/marketing/fonts/atkinson/latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="preload" href="/marketing/fonts/atkinson/latin-ext.woff2" as="font" type="font/woff2" crossOrigin="" />
      {children}
    </div>
  )
}
