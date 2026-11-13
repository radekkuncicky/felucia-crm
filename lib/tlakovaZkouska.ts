import { generateTlakovaZkouskaHtml } from '@/lib/tlakovaZkouskaHtml'
import type { TlakovaZkouskaVstup } from '@/lib/tlakovaZkouskaData'
import { vytvoritProtokolZakazky } from '@/lib/zakazkaProtokolPdf'
import { formatDate } from '@/lib/format'

/** Protokol o tlakové zkoušce → PDF do Podkladů zakázky + ke stažení. */
export function vytvoritTlakovouZkousku(orgId: string, plan: string, userId: string, zakazkaId: string, vstup: TlakovaZkouskaVstup) {
  return vytvoritProtokolZakazky(orgId, plan, userId, zakazkaId, {
    render: (ctx) => generateTlakovaZkouskaHtml(vstup, ctx),
    soubor: 'Tlakova-zkouska',
    datum: vstup.datum,
    nazev: `Protokol o tlakové zkoušce ${formatDate(vstup.datum)}.pdf`,
  })
}
