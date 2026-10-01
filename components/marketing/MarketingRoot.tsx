import { cn } from '@/lib/cn'
import { geistMono } from './fonts'
import './marketing.css'

/** Kořen marketingové stránky: zapne tokeny .mk a lokální Geist Mono. */
export function MarketingRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mk min-h-screen', geistMono.variable, className)}>{children}</div>
}
