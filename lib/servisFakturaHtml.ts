import type { VyuctovaniSouhrn } from './servisVyuctovani'

// Podklad pro fakturaci servisní zakázky (NE daňový doklad). Veškerá
// tenant data se escapují (injection do PDF), jen data: URL loga projde.

const TYP_LABELS: Record<string, string> = {
  PRACE: 'Práce',
  MATERIAL: 'Materiál',
  DOPRAVA: 'Doprava',
  JINE: 'Jiné',
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtKc(n: number) {
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč'
}

function fmtNum(n: number) {
  return n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('cs-CZ')
}

function safeImageSrc(src: string | null | undefined): string | null {
  if (!src) return null
  return src.startsWith('data:') ? src : null
}

type Zakazka = {
  id: string
  cislo: string | null
  skutecnyTermin: Date | string | null
  planovanyTermin: Date | string | null
}

type Klient = {
  jmeno: string
  prijmeni: string
  ulice: string | null
  mesto: string | null
  psc: string | null
} | null

type Org = {
  nazev: string
  sidlo: string | null
  ico: string | null
  email: string | null
  telefon: string | null
  logo: string | null // předvyřešená data URL
}

export function generateServisFakturaHtml(
  zakazka: Zakazka,
  klient: Klient,
  org: Org,
  souhrn: VyuctovaniSouhrn,
): string {
  const cislo = esc(zakazka.cislo ?? zakazka.id.slice(0, 8).toUpperCase())
  const datum = fmtDate(zakazka.skutecnyTermin ?? zakazka.planovanyTermin)
  const datumTisku = new Date().toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const klientJmeno = klient ? esc(`${klient.jmeno} ${klient.prijmeni}`.trim()) : '—'
  const adresaKlienta = klient
    ? esc([klient.ulice, [klient.mesto, klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')) || '—'
    : '—'

  const logoSrc = safeImageSrc(org.logo)
  const logoHtml = logoSrc
    ? `<img src="${esc(logoSrc)}" alt="Logo" style="height:50px;object-fit:contain;" />`
    : `<span style="font-size:20px;font-weight:800;color:#1a1a2e;">${esc(org.nazev)}</span>`

  const radky = souhrn.polozky.length
    ? souhrn.polozky.map((p) => `
      <tr>
        <td>${esc(TYP_LABELS[p.typ] ?? p.typ)}</td>
        <td>${esc(p.popis)}${p.krytoKontraktem ? ' <span style="color:#16a34a;font-size:9pt;">(kryto kontraktem)</span>' : ''}</td>
        <td class="r">${esc(fmtNum(p.mnozstvi))} ${esc(p.jednotka)}</td>
        <td class="r">${p.krytoKontraktem ? '—' : esc(fmtKc(p.cenaZaJednotku))}</td>
        <td class="r">${esc(fmtNum(p.dphSazba))} %</td>
        <td class="r">${esc(fmtKc(p.zakladRadku))}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#6b7280;padding:16px;">Bez položek</td></tr>`

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Podklad pro fakturaci ${cislo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 18mm 14mm; margin: 0 auto; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a2e; padding-bottom: 12px; margin-bottom: 18px; }
  .doc-title { font-size: 16pt; font-weight: 800; }
  .doc-sub { font-size: 9pt; color: #6b7280; margin-top: 2px; }
  .meta { display: flex; gap: 40px; margin-bottom: 18px; font-size: 10pt; }
  .meta .label { color: #6b7280; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; }
  .meta strong { font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10pt; }
  th { text-align: left; background: #f3f4f6; padding: 7px 8px; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .03em; color: #374151; border-bottom: 1px solid #d1d5db; }
  td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.r, th.r { text-align: right; }
  .totals { margin-top: 14px; margin-left: auto; width: 60mm; font-size: 10.5pt; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #1a1a2e; margin-top: 4px; padding-top: 8px; font-size: 13pt; font-weight: 800; }
  .note { margin-top: 24px; padding: 10px 12px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; font-size: 9pt; color: #9a3412; }
  .foot { margin-top: 10px; font-size: 8.5pt; color: #9ca3af; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>${logoHtml}
      <div class="doc-sub" style="margin-top:6px;">${esc(org.nazev)}${org.ico ? ' · IČO ' + esc(org.ico) : ''}</div>
      <div class="doc-sub">${esc(org.sidlo ?? '')}</div>
    </div>
    <div style="text-align:right;">
      <div class="doc-title">Podklad pro fakturaci</div>
      <div class="doc-sub">Servisní zakázka č. ${cislo}</div>
    </div>
  </div>

  <div class="meta">
    <div>
      <div class="label">Odběratel</div>
      <strong>${klientJmeno}</strong>
      <div>${adresaKlienta}</div>
    </div>
    <div>
      <div class="label">Datum zásahu</div>
      <strong>${esc(datum)}</strong>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Typ</th><th>Popis</th><th class="r">Množství</th><th class="r">Cena/j.</th><th class="r">DPH</th><th class="r">Základ</th>
      </tr>
    </thead>
    <tbody>${radky}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Základ bez DPH</span><span>${esc(fmtKc(souhrn.zakladBezDph))}</span></div>
    <div class="row"><span>DPH</span><span>${esc(fmtKc(souhrn.dphCelkem))}</span></div>
    <div class="row grand"><span>Celkem</span><span>${esc(fmtKc(souhrn.celkemSDph))}</span></div>
  </div>

  <div class="note"><strong>Není daňový doklad.</strong> Tento podklad slouží jen pro vystavení faktury v účetním systému.</div>
  <div class="foot">Vytištěno ${esc(datumTisku)}${org.email ? ' · ' + esc(org.email) : ''}${org.telefon ? ' · ' + esc(org.telefon) : ''}</div>
</div>
</body>
</html>`
}
