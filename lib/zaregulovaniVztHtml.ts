import { formatCislo, formatDate } from '@/lib/format'
import { cislo, esc, protokolHtml, row, sekce, type ProtokolKontext } from '@/lib/protokolPdfZaklad'
import {
  KONTROLY, nerovnovaha, odchylka, soucet, teplotniUcinnost, vTolerance,
  type ZaregulovaniVztVstup,
} from '@/lib/zaregulovaniVztData'

/** Protokol o zaregulování VZT (A4, Puppeteer) — kostra v lib/protokolPdfZaklad.ts. */

const procento = (n: number | null) => (n == null ? null : `${n > 0 ? '+' : ''}${formatCislo(n)} %`)
const m3 = (n: number | null) => cislo(n, 'm³/h')
const bunka = (s: string | null) => (s ? esc(s) : '<span class="muted">—</span>')

const CSS = `
  .grid2 { width: 100%; }
  .grid2 > tbody > tr > td { width: 50%; padding-right: 10px; }
  .grid2 > tbody > tr > td + td { padding-right: 0; padding-left: 10px; }
  .mt { font-size: 8.5pt; }
  .mt th { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: #6b7280;
           padding: 3px 5px; border-bottom: 1px solid #d1d5db; }
  .mt td { padding: 2.5px 5px; border-bottom: 1px solid #f0f0f0; }
  .mt .n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .mt tr.sum td { font-weight: 700; border-top: 1px solid #d1d5db; border-bottom: none; }
  .mt tr { break-inside: avoid; }
  .ko-cell { color: #b91c1c; font-weight: 700; }
  .ok-cell { color: #15803d; }
  .chk { display: inline-block; width: 49%; font-size: 9pt; padding: 1.5px 0; }
  .box { display: inline-block; width: 9px; height: 9px; border: 1px solid #374151; border-radius: 2px;
         margin-right: 6px; vertical-align: -1px; position: relative; }
  .box.on { background: #374151; }
  .box.on::after { content: ''; position: absolute; left: 2.5px; top: 0.5px; width: 2.5px; height: 5px;
                   border: solid #fff; border-width: 0 1.2px 1.2px 0; transform: rotate(45deg); }
  .pozn-norma { font-size: 7.5pt; color: #6b7280; margin-top: 4px; }
`

export function generateZaregulovaniVztHtml(z: ZaregulovaniVztVstup, ctx: ProtokolKontext): string {
  const { jednotka: j, pristroj: p, celkem: c, teploty: t, tolerance } = z

  const jednotkaHtml = sekce('Vzduchotechnická jednotka a měření', `
    <table class="grid2"><tbody><tr>
      <td><table class="kv"><tbody>
        ${row('Jednotka (výrobce, typ)', j.typ || null)}
        ${row('Výrobní číslo', j.vyrobniCislo || null)}
        ${row('Umístění', j.umisteni || null)}
        ${row('Nastavený režim / stupeň', j.rezim || null)}
      </tbody></table></td>
      <td><table class="kv"><tbody>
        ${row('Měřicí přístroj', p.typ || null)}
        ${row('Výrobní číslo přístroje', p.vyrobniCislo || null)}
        ${row('Datum kalibrace', p.kalibrace ? formatDate(p.kalibrace) : null)}
        ${row('Metoda měření', z.metoda || null)}
      </tbody></table></td>
    </tr></tbody></table>`)

  // Celkové průtoky — když větev nemá zadané ani návrh, ani měření, použije se součet vyústek
  // (nemíchat zadaný celek s neúplným součtem)
  const vetev = (typ: 'PRIVOD' | 'ODVOD', nav: number | null, nam: number | null) =>
    nav == null && nam == null ? [soucet(z.vyustky, typ, 'navrh'), soucet(z.vyustky, typ, 'namereno')] : [nav, nam]
  const [privodNav, privodNam] = vetev('PRIVOD', c.privodNavrh, c.privodNamereno)
  const [odvodNav, odvodNam] = vetev('ODVOD', c.odvodNavrh, c.odvodNamereno)
  const radekCelkem = (label: string, nav: number | null, nam: number | null) => {
    const o = odchylka(nav, nam)
    const ok = vTolerance(o, tolerance)
    return `<tr><td>${esc(label)}</td><td class="n">${bunka(m3(nav))}</td><td class="n">${bunka(m3(nam))}</td>
      <td class="n ${ok == null ? '' : ok ? 'ok-cell' : 'ko-cell'}">${bunka(procento(o))}</td></tr>`
  }
  const nerov = nerovnovaha(privodNam, odvodNam)
  const celkemHtml = sekce('Celkové průtoky vzduchu', `
    <table class="mt"><thead><tr><th>Větev</th><th class="n">Návrh</th><th class="n">Naměřeno</th><th class="n">Odchylka</th></tr></thead>
    <tbody>
      ${radekCelkem('Přívod', privodNav, privodNam)}
      ${radekCelkem('Odvod', odvodNav, odvodNam)}
      <tr class="sum"><td colspan="3">Nerovnováha přívod − odvod (naměřeno)</td><td class="n">${bunka(procento(nerov))}</td></tr>
    </tbody></table>`)

  const eta = teplotniUcinnost(t)
  const maTeploty = t.venkovni != null || t.privod != null || t.odvod != null || t.odpadni != null
  const teplotyHtml = maTeploty ? sekce('Teploty vzduchu při měření', `
    <table class="grid2"><tbody><tr>
      <td><table class="kv"><tbody>
        ${row('Venkovní (sání)', cislo(t.venkovni, '°C'))}
        ${row('Přívod do místností', cislo(t.privod, '°C'))}
      </tbody></table></td>
      <td><table class="kv"><tbody>
        ${row('Odvod z místností', cislo(t.odvod, '°C'))}
        ${row('Odpadní (výfuk)', cislo(t.odpadni, '°C'))}
      </tbody></table></td>
    </tr></tbody></table>
    ${eta != null ? `<table class="kv"><tbody>${row('Teplotní účinnost zpětného získávání tepla (orientačně)', `${formatCislo(eta)} %`)}</tbody></table>` : ''}`) : ''

  const radekVyustka = (v: ZaregulovaniVztVstup['vyustky'][number]) => {
    const o = odchylka(v.navrh, v.namereno)
    const ok = vTolerance(o, tolerance)
    return `<tr>
      <td>${bunka(v.mistnost || null)}</td>
      <td>${v.typ === 'ODVOD' ? 'Odvod' : 'Přívod'}</td>
      <td>${bunka(v.prvek || null)}</td>
      <td class="n">${bunka(v.navrh != null ? formatCislo(v.navrh) : null)}</td>
      <td class="n">${bunka(v.namereno != null ? formatCislo(v.namereno) : null)}</td>
      <td class="n ${ok == null ? '' : ok ? 'ok-cell' : 'ko-cell'}">${bunka(procento(o))}</td>
      <td>${bunka(v.nastaveni || null)}</td>
    </tr>`
  }
  const sumRadek = (typ: 'PRIVOD' | 'ODVOD', label: string) => {
    const nav = soucet(z.vyustky, typ, 'navrh')
    const nam = soucet(z.vyustky, typ, 'namereno')
    if (nav == null && nam == null) return ''
    return `<tr class="sum"><td colspan="3">${label}</td><td class="n">${bunka(nav != null ? formatCislo(nav) : null)}</td>
      <td class="n">${bunka(nam != null ? formatCislo(nam) : null)}</td><td class="n">${bunka(procento(odchylka(nav, nam)))}</td><td></td></tr>`
  }
  const serazene = [...z.vyustky.filter((v) => v.typ === 'PRIVOD'), ...z.vyustky.filter((v) => v.typ === 'ODVOD')]
  const vyustkyHtml = z.vyustky.length ? `<section class="sec" style="break-inside: auto">
    <h2>Průtoky na koncových prvcích (vyústky, ventily)</h2>
    <table class="mt"><thead><tr>
      <th>Místnost</th><th>Větev</th><th>Prvek</th><th class="n">Návrh [m³/h]</th><th class="n">Naměřeno [m³/h]</th><th class="n">Odchylka</th><th>Nastavení</th>
    </tr></thead><tbody>
      ${serazene.map(radekVyustka).join('')}
      ${sumRadek('PRIVOD', 'Součet přívod')}
      ${sumRadek('ODVOD', 'Součet odvod')}
    </tbody></table>
    <div class="pozn-norma">Povolená odchylka průtoku na koncovém prvku ±${esc(formatCislo(tolerance))} % od návrhové hodnoty. Měření a vyhodnocení dle ČSN EN 12599 a ČSN EN 14134.</div>
  </section>` : ''

  const kontrolyHtml = sekce('Kontrola instalace', KONTROLY.map(({ key, label }) =>
    `<span class="chk"><span class="box${z.kontroly[key] ? ' on' : ''}"></span>${esc(label)}</span>`).join(''))

  const vyhovel = z.vysledek === 'VYHOVEL'
  return protokolHtml({
    titul: 'Protokol o zaregulování VZT',
    datumLabel: 'Datum měření',
    datum: formatDate(z.datum),
    provedlLabel: 'Měření provedl',
    provedl: z.provedl,
    telo: jednotkaHtml + celkemHtml + teplotyHtml + vyustkyHtml + kontrolyHtml,
    vysledek: {
      ok: vyhovel,
      nadpis: `Výsledek: ${vyhovel ? 'SOUSTAVA ZAREGULOVÁNA — VYHOVUJE' : 'NEVYHOVUJE'}`,
      text: vyhovel
        ? 'Vzduchotechnická soustava byla zaregulována na návrhové průtoky v rámci povolené odchylky (ČSN EN 12599, ČSN EN 14134).'
        : 'Soustava nesplnila požadavky na průtoky vzduchu — viz poznámka a odchylky v tabulce.',
    },
    poznamka: z.poznamka,
    css: CSS,
  }, ctx)
}
