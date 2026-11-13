import { formatDate } from '@/lib/format'
import { pokles, type TlakovaZkouskaVstup } from '@/lib/tlakovaZkouskaData'
import { cislo, protokolHtml, row, sekce, type ProtokolKontext } from '@/lib/protokolPdfZaklad'

/** Protokol o tlakové zkoušce (A4, Puppeteer) — kostra v lib/protokolPdfZaklad.ts. */

export type TlakovaZkouskaKontext = ProtokolKontext

export function generateTlakovaZkouskaHtml(z: TlakovaZkouskaVstup, ctx: TlakovaZkouskaKontext): string {
  const p = z.podlahovka
  const podlahovkaHtml = p ? sekce('Podlahové vytápění — tlaková zkouška dle ČSN EN 1264-4', `
    <table class="kv"><tbody>
      ${row('Potrubí', [p.trubkaTyp, p.trubkaDimenze].filter(Boolean).join(' ') || null)}
      ${row('Počet okruhů', p.pocetOkruhu != null ? String(p.pocetOkruhu) : null)}
      ${row('Celková délka potrubí', cislo(p.delkaM, 'm'))}
      ${row('Rozdělovač', p.rozdelovac || null)}
      ${row('Zkušební médium', p.medium === 'VZDUCH' ? 'Vzduch' : 'Voda')}
      ${row('Zkušební tlak', cislo(p.zkusebniTlak, 'bar'))}
      ${row('Provozní tlak', cislo(p.provozniTlak, 'bar'))}
      ${row('Doba zkoušky', cislo(p.dobaH, 'h'))}
      ${row('Tlak na začátku zkoušky', cislo(p.tlakZacatek, 'bar'))}
      ${row('Tlak na konci zkoušky', cislo(p.tlakKonec, 'bar'))}
      ${row('Pokles tlaku', cislo(pokles(p.tlakZacatek, p.tlakKonec), 'bar'))}
      ${row('Teplota média', cislo(p.teplota, '°C'))}
      ${row('Potrubí pod tlakem při betonáži', p.podTlakemPriBetonazi ? 'Ano' : 'Ne')}
    </tbody></table>`) : ''

  const t = z.tc
  const tcHtml = t ? sekce('Tepelné čerpadlo — otopná soustava', `
    <table class="kv"><tbody>
      ${row('Zkušební tlak', cislo(t.zkusebniTlak, 'bar'))}
      ${row('Doba zkoušky', cislo(t.dobaH, 'h'))}
      ${row('Tlak na začátku zkoušky', cislo(t.tlakZacatek, 'bar'))}
      ${row('Tlak na konci zkoušky', cislo(t.tlakKonec, 'bar'))}
      ${row('Pokles tlaku', cislo(pokles(t.tlakZacatek, t.tlakKonec), 'bar'))}
    </tbody></table>
    ${t.dusik ? `
    <h3>Chladivový okruh (split) — dusíková zkouška a vakuování</h3>
    <table class="kv"><tbody>
      ${row('Tlak dusíku', cislo(t.dusik.tlak, 'bar'))}
      ${row('Doba tlakové zkoušky', cislo(t.dusik.dobaH, 'h'))}
      ${row('Dosažené vakuum', cislo(t.dusik.vakuumPa, 'Pa'))}
      ${row('Doba vakuování', cislo(t.dusik.dobaVakuaMin, 'min'))}
    </tbody></table>` : ''}`) : ''

  const vyhovel = z.vysledek === 'VYHOVEL'
  return protokolHtml({
    titul: 'Protokol o tlakové zkoušce',
    datumLabel: 'Datum zkoušky',
    datum: formatDate(z.datum),
    provedlLabel: 'Zkoušku provedl',
    provedl: z.zkousel,
    telo: podlahovkaHtml + tcHtml,
    vysledek: {
      ok: vyhovel,
      nadpis: `Výsledek zkoušky: ${vyhovel ? 'VYHOVĚL' : 'NEVYHOVĚL'}`,
      text: vyhovel
        ? 'Zkoušená soustava je těsná, během zkoušky nebyl zjištěn únik média.'
        : 'Zkoušená soustava nesplnila požadavky zkoušky — viz poznámka.',
    },
    poznamka: z.poznamka,
  }, ctx)
}
