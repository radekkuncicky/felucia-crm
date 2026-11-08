import { formatCislo, formatDate } from '@/lib/format'
import { pokles, type TlakovaZkouskaVstup } from '@/lib/tlakovaZkouskaData'

/**
 * Protokol o tlakové zkoušce (A4, Puppeteer) — vzhled jako servisní protokol.
 * Všechny hodnoty jsou prostý text od tenanta → escapovat.
 */

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function safeColor(c: string | null | undefined): string {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#1B5E20'
}

function safeImageSrc(src: string | null | undefined): string | null {
  return src && src.startsWith('data:') ? src : null
}

const cislo = (n: number | null, jednotka: string) =>
  n == null ? null : `${formatCislo(n)} ${jednotka}`

function row(label: string, value: string | null | undefined) {
  return `<tr><td class="k">${esc(label)}</td><td class="v">${value ? esc(value) : '<span class="muted">—</span>'}</td></tr>`
}

export interface TlakovaZkouskaKontext {
  zakazka: { cislo: string; nazev: string; mistoStavby: string | null }
  klient: { jmeno: string; prijmeni: string; ulice: string | null; mesto: string | null; psc: string | null; telefon: string | null } | null
  org: { nazev: string; sidlo: string | null; ico: string | null; dic?: string | null; email: string | null; telefon: string | null; logo: string | null; primaryColor?: string | null }
}

export function generateTlakovaZkouskaHtml(z: TlakovaZkouskaVstup, ctx: TlakovaZkouskaKontext): string {
  const { zakazka, klient, org } = ctx
  const barva = safeColor(org.primaryColor)
  const logoSrc = safeImageSrc(org.logo)
  const klientJmeno = klient ? `${klient.jmeno} ${klient.prijmeni}`.trim() : ''
  const adresaKlienta = klient ? [klient.ulice, [klient.psc, klient.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  const misto = zakazka.mistoStavby?.trim() || adresaKlienta
  const datum = formatDate(z.datum)
  const orgRadky = [
    org.sidlo,
    [org.ico && `IČO ${org.ico}`, org.dic && `DIČ ${org.dic}`].filter(Boolean).join(' · '),
    [org.telefon, org.email].filter(Boolean).join(' · '),
  ].filter(Boolean) as string[]

  const vyhovel = z.vysledek === 'VYHOVEL'

  const sekce = (title: string, body: string) => `<section class="sec"><h2>${esc(title)}</h2>${body}</section>`

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

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Protokol o tlakové zkoušce ${esc(zakazka.cislo)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 9.5pt; line-height: 1.45; color: #111827;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { border-collapse: collapse; width: 100%; }
  td, th { vertical-align: top; text-align: left; }
  .muted { color: #9ca3af; }
  .strong { font-weight: 600; }
  .head { border-bottom: 2.5px solid ${barva}; margin-bottom: 14px; break-inside: avoid; }
  .head td { padding-bottom: 12px; }
  .head-org { width: 55%; }
  .logo { max-height: 46px; max-width: 170px; object-fit: contain; display: block; margin-bottom: 6px; }
  .org-name-big { font-size: 15pt; font-weight: 800; margin-bottom: 4px; }
  .org-lines { font-size: 8pt; color: #4b5563; line-height: 1.5; }
  .head-doc { text-align: right; }
  .doc-title { font-size: 16pt; font-weight: 800; color: ${barva}; letter-spacing: -0.2px; }
  .doc-no { font-size: 10.5pt; font-weight: 700; margin-top: 2px; }
  .doc-date { font-size: 9pt; color: #4b5563; margin-top: 2px; }
  .parties { margin-bottom: 6px; break-inside: avoid; }
  .parties td { width: 33.33%; padding: 0 12px 0 0; font-size: 9pt; line-height: 1.5; }
  .parties td + td { padding-left: 12px; border-left: 1px solid #e5e7eb; }
  .label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 3px; }
  .sec { margin-top: 10px; break-inside: avoid; }
  .sec h2 { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: ${barva};
            padding-bottom: 3px; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  .sec h3 { font-size: 8.5pt; font-weight: 600; margin: 10px 0 4px; color: #374151; }
  .kv td { padding: 1.5px 6px; border-bottom: 1px solid #f0f0f0; font-size: 9pt; }
  .kv .k { width: 45%; color: #6b7280; }
  .kv .v { font-weight: 600; }
  .vysledek { margin-top: 12px; padding: 8px 14px; border: 1.5px solid; border-radius: 4px; break-inside: avoid; }
  .vysledek.ok { border-color: #86efac; background: #f0fdf4; color: #166534; }
  .vysledek.ko { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
  .vysledek .big { font-size: 12pt; font-weight: 800; letter-spacing: 0.3px; }
  .text { white-space: pre-wrap; }
  .signs { break-inside: avoid; margin-top: 14px; }
  .sign-table td { width: 50%; padding-right: 24px; }
  .sign-table td + td { padding-right: 0; padding-left: 24px; }
  .sign-box { height: 15mm; border-bottom: 1px solid #374151; }
  .sign-caption { font-size: 8.5pt; color: #4b5563; margin-top: 4px; line-height: 1.5; }
</style>
</head>
<body>
  <table class="head"><tr>
    <td class="head-org">
      ${logoSrc ? `<img class="logo" src="${esc(logoSrc)}" alt="" />` : `<div class="org-name-big">${esc(org.nazev)}</div>`}
      <div class="org-lines">${logoSrc ? `<strong>${esc(org.nazev)}</strong><br/>` : ''}${orgRadky.map(esc).join('<br/>')}</div>
    </td>
    <td class="head-doc">
      <div class="doc-title">Protokol o tlakové zkoušce</div>
      <div class="doc-no">Zakázka ${esc(zakazka.cislo)}</div>
      <div class="doc-date">Datum zkoušky: <strong>${esc(datum)}</strong></div>
    </td>
  </tr></table>

  <table class="parties"><tr>
    <td>
      <div class="label">Zákazník</div>
      <div class="strong">${esc(klientJmeno || '—')}</div>
      ${adresaKlienta ? `<div>${esc(adresaKlienta)}</div>` : ''}
      ${klient?.telefon ? `<div>${esc(klient.telefon)}</div>` : ''}
    </td>
    <td>
      <div class="label">Místo instalace</div>
      <div class="strong">${esc(misto || '—')}</div>
    </td>
    <td>
      <div class="label">Dílo</div>
      <div class="strong">${esc(zakazka.nazev)}</div>
      ${z.zkousel ? `<div>Zkoušku provedl: ${esc(z.zkousel)}</div>` : ''}
    </td>
  </tr></table>

  ${podlahovkaHtml}
  ${tcHtml}

  <div class="vysledek ${vyhovel ? 'ok' : 'ko'}">
    <div class="big">Výsledek zkoušky: ${vyhovel ? 'VYHOVĚL' : 'NEVYHOVĚL'}</div>
    <div>${vyhovel
      ? 'Zkoušená soustava je těsná, během zkoušky nebyl zjištěn únik média.'
      : 'Zkoušená soustava nesplnila požadavky zkoušky — viz poznámka.'}</div>
  </div>

  ${z.poznamka ? sekce('Poznámka', `<div class="text">${esc(z.poznamka)}</div>`) : ''}

  <section class="signs">
    <table class="sign-table"><tr>
      <td>
        <div class="sign-box"></div>
        <div class="sign-caption">Zkoušku provedl: <strong>${esc(z.zkousel || '')}</strong><br/>${esc(org.nazev)}</div>
      </td>
      <td>
        <div class="sign-box"></div>
        <div class="sign-caption">Za objednatele: <strong>${esc(klientJmeno)}</strong><br/>Datum: ………………………</div>
      </td>
    </tr></table>
  </section>
</body>
</html>`
}
