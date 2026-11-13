import { formatDate } from '@/lib/format'

/** HTML výkazu práce technika pro PDF (podklad k faktuře technika firmě). Vše escapované. */

export type VykazPdfRadek = {
  typ: 'VYJEZD' | 'POLOZKA'
  datum: Date
  cislo: string
  nazev: string
  hodiny: number
  km: number
  popis: string | null
  poznamka: string | null
  castka: number
}

export type VykazPdfData = {
  orgNazev: string
  technik: { jmeno: string; email: string | null; telefon: string | null }
  cislo: number
  obdobiOd: Date
  obdobiDo: Date
  vytvoreno: Date
  radky: VykazPdfRadek[]
  soucty: { hodiny: number; km: number; castkaHodiny: number; castkaKm: number; castkaPolozky: number; castka: number }
}

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const kc = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' Kč'
const cislo = (n: number, d = 2) =>
  new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: d }).format(n)

export function generateVykazHtml(p: VykazPdfData): string {
  const vyjezdy = p.radky.filter(r => r.typ === 'VYJEZD')
  const polozky = p.radky.filter(r => r.typ === 'POLOZKA')
  const th = 'padding:6px 8px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:#4b5563;border-bottom:2px solid #4CAF50;'
  const td = 'padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;'

  const vyjezdyHtml = vyjezdy.length ? `
    <h2>Výjezdy</h2>
    <table>
      <thead><tr>
        <th style="${th}">Datum</th><th style="${th}">Č. zakázky</th><th style="${th}">Zakázka</th>
        <th style="${th}text-align:right;">Hodiny</th><th style="${th}text-align:right;">Km</th><th style="${th}text-align:right;">Cena</th>
      </tr></thead>
      <tbody>
        ${vyjezdy.map(r => `<tr>
          <td style="${td}white-space:nowrap;">${esc(formatDate(r.datum))}</td>
          <td style="${td}white-space:nowrap;font-weight:600;">${esc(r.cislo)}</td>
          <td style="${td}">${esc(r.nazev)}${r.poznamka ? `<div style="color:#6b7280;font-size:9.5px;margin-top:2px;">${esc(r.poznamka)}</div>` : ''}</td>
          <td style="${td}text-align:right;">${cislo(r.hodiny)}</td>
          <td style="${td}text-align:right;">${cislo(r.km, 0)}</td>
          <td style="${td}text-align:right;white-space:nowrap;">${kc(r.castka)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="3" style="${td}font-weight:700;">Celkem výjezdy</td>
        <td style="${td}text-align:right;font-weight:700;">${cislo(p.soucty.hodiny)}</td>
        <td style="${td}text-align:right;font-weight:700;">${cislo(p.soucty.km, 0)}</td>
        <td style="${td}text-align:right;font-weight:700;white-space:nowrap;">${kc(p.soucty.castkaHodiny + p.soucty.castkaKm)}</td>
      </tr></tfoot>
    </table>` : ''

  const polozkyHtml = polozky.length ? `
    <h2>Ostatní položky</h2>
    <table>
      <thead><tr>
        <th style="${th}">Datum</th><th style="${th}">Č. zakázky</th><th style="${th}">Zakázka</th>
        <th style="${th}">Popis</th><th style="${th}text-align:right;">Částka</th>
      </tr></thead>
      <tbody>
        ${polozky.map(r => `<tr>
          <td style="${td}white-space:nowrap;">${esc(formatDate(r.datum))}</td>
          <td style="${td}white-space:nowrap;font-weight:600;">${esc(r.cislo)}</td>
          <td style="${td}">${esc(r.nazev)}</td>
          <td style="${td}">${esc(r.popis)}${r.poznamka ? `<div style="color:#6b7280;font-size:9.5px;margin-top:2px;">${esc(r.poznamka)}</div>` : ''}</td>
          <td style="${td}text-align:right;white-space:nowrap;">${kc(r.castka)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''

  const radek = (l: string, v: string, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? 'font-weight:700;font-size:14px;padding-top:8px;border-top:2px solid #111827;' : 'color:#374151;'}">${l}</td>
     <td style="padding:4px 0 4px 24px;text-align:right;white-space:nowrap;${bold ? 'font-weight:700;font-size:14px;padding-top:8px;border-top:2px solid #111827;' : ''}">${v}</td></tr>`

  return `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111827;margin:0;}
  h1{font-size:20px;margin:0;}
  h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#374151;margin:20px 0 6px;}
  table{width:100%;border-collapse:collapse;}
  tr{page-break-inside:avoid;}
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4CAF50;padding-bottom:10px;">
    <div>
      <h1>Výkaz práce č. ${p.cislo}</h1>
      <div style="color:#4b5563;margin-top:4px;">Období ${esc(formatDate(p.obdobiOd))} – ${esc(formatDate(p.obdobiDo))}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:700;font-size:13px;">${esc(p.technik.jmeno)}</div>
      ${p.technik.telefon ? `<div style="color:#4b5563;">${esc(p.technik.telefon)}</div>` : ''}
      ${p.technik.email ? `<div style="color:#4b5563;">${esc(p.technik.email)}</div>` : ''}
      <div style="color:#4b5563;margin-top:6px;">Pro: <strong>${esc(p.orgNazev)}</strong></div>
    </div>
  </div>

  ${vyjezdyHtml}
  ${polozkyHtml}

  <div style="display:flex;justify-content:flex-end;margin-top:24px;page-break-inside:avoid;">
    <table style="width:auto;min-width:300px;">
      ${radek(`Práce (${cislo(p.soucty.hodiny)} h)`, kc(p.soucty.castkaHodiny))}
      ${radek(`Doprava (${cislo(p.soucty.km, 0)} km)`, kc(p.soucty.castkaKm))}
      ${polozky.length ? radek('Ostatní položky', kc(p.soucty.castkaPolozky)) : ''}
      ${radek('Celkem k fakturaci', kc(p.soucty.castka), true)}
    </table>
  </div>
  <p style="color:#6b7280;font-size:9.5px;margin-top:16px;">Částky bez DPH. Vystaveno ${esc(formatDate(p.vytvoreno))} z aplikace Felucia Technik.</p>
</body></html>`
}
