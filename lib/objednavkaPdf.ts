import { formatDate, formatKcPresne } from '@/lib/format'
import { adresaDodavatele } from '@/lib/dodavatele'

/**
 * HTML objednávky materiálu pro dodavatele (puppeteer → PDF).
 * Tenant texty (názvy, kódy, poznámka) se escapují; záhlaví/patičku dodá buildDokumentChrome.
 */

export type ObjednavkaPdfData = {
  cislo: string
  stav: string
  vytvoreno: string
  pozadovanyTermin: string | null
  poznamka: string | null
  vytvoril: { jmeno: string } | null
  /** Ceny se tisknou jen když je přepínač zapnutý a volající je smí vidět */
  zobrazitCeny: boolean
  odberatel: {
    nazev: string
    sidlo: string | null
    ico: string | null
    dic: string | null
    email: string | null
    telefon: string | null
    logo: string | null
  }
  dodavatel: {
    nazev: string
    ico: string | null
    dic: string | null
    email: string | null
    telefon: string | null
    kontaktOsoba: string | null
    ulice: string | null
    mesto: string | null
    psc: string | null
  }
  zakazka: { cislo: string; nazev: string; mistoStavby: string | null } | null
  polozky: {
    objednaciKod: string | null
    nazev: string
    mnozstvi: number
    jednotka: string
    nakupniCena: number | null
  }[]
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const fmtQty = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })

export function generateObjednavkaHtml(o: ObjednavkaPdfData): string {
  const org = o.odberatel
  const d = o.dodavatel
  const ceny = o.zobrazitCeny
  const logoHtml = org.logo
    ? `<img src="${org.logo}" style="height:40px;max-width:140px;object-fit:contain;" />`
    : `<span style="font-size:18px;font-weight:800;color:#1A2744;">${esc(org.nazev)}</span>`

  const celkem = o.polozky.reduce((s, p) => s + (p.nakupniCena ?? 0) * p.mnozstvi, 0)

  const rows = o.polozky.map((p, i) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:7px 8px;text-align:center;color:#6b7280;">${i + 1}</td>
        <td style="padding:7px 8px;font-family:monospace;font-size:11px;">${p.objednaciKod ? esc(p.objednaciKod) : '<span style="color:#9ca3af;">—</span>'}</td>
        <td style="padding:7px 8px;font-weight:500;">${esc(p.nazev)}</td>
        <td style="padding:7px 8px;text-align:right;font-weight:600;">${fmtQty(p.mnozstvi)}</td>
        <td style="padding:7px 8px;text-align:left;color:#6b7280;">${esc(p.jednotka)}</td>
        ${ceny ? `<td style="padding:7px 8px;text-align:right;">${p.nakupniCena !== null ? formatKcPresne(p.nakupniCena) : '—'}</td>
        <td style="padding:7px 8px;text-align:right;font-weight:600;">${p.nakupniCena !== null ? formatKcPresne(p.nakupniCena * p.mnozstvi) : '—'}</td>` : ''}
      </tr>`).join('')

  const dodavatelAdresa = adresaDodavatele(d)

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
    h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #374151; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1A2744; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; padding: 6px 8px; text-align: left; }
    .section { margin-bottom: 16px; }
    .box { background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px; }
    .box .lbl { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0 0 6px; }
    .box p { margin:0 0 2px;color:#374151; }
  </style>
</head>
<body>
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1A2744;">
    <div>
      ${logoHtml}
      <p style="margin:4px 0 0;font-size:10px;color:#6b7280;">${esc(org.sidlo ?? '')}</p>
      ${org.ico ? `<p style="margin:2px 0 0;font-size:10px;color:#6b7280;">IČO: ${esc(org.ico)}${org.dic ? ` · DIČ: ${esc(org.dic)}` : ''}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <p style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin:0;">Objednávka materiálu</p>
      <p style="font-family:monospace;font-size:22px;font-weight:800;color:#1A2744;margin:4px 0 0;">${esc(o.cislo)}</p>
      <p style="font-size:10px;color:#6b7280;margin:2px 0 0;">Datum: ${formatDate(o.vytvoreno)}</p>
      ${o.pozadovanyTermin ? `<p style="font-size:10px;color:#111827;font-weight:600;margin:2px 0 0;">Požadovaný termín dodání: ${formatDate(o.pozadovanyTermin)}</p>` : ''}
    </div>
  </div>

  <div class="section">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="box">
        <p class="lbl">Dodavatel</p>
        <p style="font-size:13px;font-weight:700;color:#1A2744;margin:0 0 4px;">${esc(d.nazev)}</p>
        ${dodavatelAdresa ? `<p>${esc(dodavatelAdresa)}</p>` : ''}
        ${d.kontaktOsoba ? `<p>${esc(d.kontaktOsoba)}</p>` : ''}
        ${d.email ? `<p>${esc(d.email)}</p>` : ''}
        ${d.telefon ? `<p>${esc(d.telefon)}</p>` : ''}
        ${d.ico ? `<p style="color:#6b7280;font-size:10px;">IČO: ${esc(d.ico)}${d.dic ? ` · DIČ: ${esc(d.dic)}` : ''}</p>` : ''}
      </div>
      <div class="box">
        <p class="lbl">Odběratel</p>
        <p style="font-size:13px;font-weight:700;color:#1A2744;margin:0 0 4px;">${esc(org.nazev)}</p>
        ${org.sidlo ? `<p>${esc(org.sidlo)}</p>` : ''}
        ${org.email ? `<p>${esc(org.email)}</p>` : ''}
        ${org.telefon ? `<p>${esc(org.telefon)}</p>` : ''}
        ${org.ico ? `<p style="color:#6b7280;font-size:10px;">IČO: ${esc(org.ico)}${org.dic ? ` · DIČ: ${esc(org.dic)}` : ''}</p>` : ''}
        ${o.vytvoril ? `<p style="color:#6b7280;font-size:10px;margin-top:4px;">Vyřizuje: ${esc(o.vytvoril.jmeno)}</p>` : ''}
      </div>
    </div>
  </div>

  ${o.zakazka ? `
  <div class="section">
    <div class="box" style="display:flex;gap:24px;">
      <div><p class="lbl">Naše zakázka</p><p style="font-weight:600;">${esc(o.zakazka.cislo)} · ${esc(o.zakazka.nazev)}</p></div>
      ${o.zakazka.mistoStavby ? `<div><p class="lbl">Místo realizace</p><p>${esc(o.zakazka.mistoStavby)}</p></div>` : ''}
    </div>
  </div>` : ''}

  <div class="section">
    <h2>Objednané položky</h2>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:28px;">#</th>
          <th style="width:110px;">Obj. kód</th>
          <th>Název</th>
          <th style="text-align:right;width:70px;">Množství</th>
          <th style="width:40px;">MJ</th>
          ${ceny ? '<th style="text-align:right;width:90px;">Cena / MJ</th><th style="text-align:right;width:100px;">Celkem</th>' : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      ${ceny ? `<tfoot><tr><td colspan="6" style="padding:8px;text-align:right;font-weight:700;">Celkem bez DPH</td><td style="padding:8px;text-align:right;font-weight:800;font-size:12px;">${formatKcPresne(celkem)}</td></tr></tfoot>` : ''}
    </table>
    ${ceny ? '<p style="font-size:9px;color:#9ca3af;margin:6px 0 0;">Ceny uvedeny bez DPH dle sjednaných podmínek.</p>' : ''}
  </div>

  ${o.poznamka ? `
  <div class="section">
    <h2>Poznámka</h2>
    <p style="white-space:pre-wrap;color:#374151;">${esc(o.poznamka)}</p>
  </div>` : ''}

  <div class="section" style="margin-top:28px;font-size:10px;color:#6b7280;">
    <p style="margin:0;">Prosíme o potvrzení objednávky a termínu dodání na e-mail ${org.email ? esc(org.email) : 'odběratele'}. Na dodacím listu uveďte číslo objednávky <strong>${esc(o.cislo)}</strong>.</p>
  </div>
</body>
</html>`
}
