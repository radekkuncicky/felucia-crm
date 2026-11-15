'use client'

import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Obsah záložky „Etapy“. Data etap má layout zakázky (sdílí je s pruhem postupu
 * v hlavičce), takže sekci vykreslí layout a tenhle obal ji ukáže jen na
 * `?tab=etapy` hlavní stránky zakázky — bez dalšího dotazu do DB.
 */
export default function EtapyZalozka({ zakazkaId, children }: { zakazkaId: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const tab = useSearchParams().get('tab')
  if (pathname !== `/zakazky/${zakazkaId}` || tab !== 'etapy') return null
  return <>{children}</>
}
