import { generateZaregulovaniVztHtml } from '@/lib/zaregulovaniVztHtml'
import type { ZaregulovaniVztVstup } from '@/lib/zaregulovaniVztData'
import { vytvoritProtokolZakazky } from '@/lib/zakazkaProtokolPdf'
import { formatDate } from '@/lib/format'

/** Protokol o zaregulování VZT → PDF do Podkladů zakázky + ke stažení. */
export function vytvoritZaregulovaniVzt(orgId: string, plan: string, userId: string, zakazkaId: string, vstup: ZaregulovaniVztVstup) {
  return vytvoritProtokolZakazky(orgId, plan, userId, zakazkaId, {
    render: (ctx) => generateZaregulovaniVztHtml(vstup, ctx),
    soubor: 'Zaregulovani-VZT',
    datum: vstup.datum,
    nazev: `Protokol o zaregulování VZT ${formatDate(vstup.datum)}.pdf`,
  })
}
