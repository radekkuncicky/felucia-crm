import { cn } from '@/lib/cn'
import { literata, sometypeMono } from './fonts'
import './marketing.css'

/** Kořen marketingové stránky: zapne tokeny .mk a písma webu (fonts.ts). */
export function MarketingRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mk min-h-screen', literata.variable, sometypeMono.variable, className)}>{children}</div>
}
