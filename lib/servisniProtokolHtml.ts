import { formatDate } from '@/lib/format'
import { podpisToImgSrc } from '@/lib/podpisImage'

/**
 * Servisní protokol pro klienta (A4, Puppeteer). Tiskový dokument, ne webové
 * karty: šířku určují jen okraje stránky z generatePdf (žádné width/min-height),
 * bloky, které se nesmí roztrhnout (hlavička, řádky tabulky, řádky fotek,
 * podpisy), mají break-inside: avoid; dlouhé texty se lámou volně po řádcích.
 * Ceny se klientovi neukazují — ty patří do vyúčtování.
 */

const TYP_LABELS: Record<string, string> = {
  TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  KLIMATIZACE: 'Klimatizace',
  REKUPERACE: 'Rekuperace',
  PODLAHOVE_VYTAPENI: 'Podlahové vytápění',
  VZDUCHOTECHNIKA: 'Vzduchotechnika',
  OHREV_TV: 'Ohřev TUV',
  JINE: 'Jiné',
}

const NAVSTEVA_TYP_LABELS: Record<string, string> = {
  PLANOVANY_SERVIS: 'Plánovaný servis',
  PORUCHA: 'Porucha',
  ZARUCNI_OPRAVA: 'Záruční oprava',
  POZARUCNI_OPRAVA: 'Pozáruční oprava',
  UVEDENI_DO_PROVOZU: 'Uvedení do provozu',
  KONTROLA: 'Kontrola',
}

const POLOZKA_TYP_LABELS: Record<string, string> = {
  PRACE: 'Práce',
  MATERIAL: 'Materiál',
  DOPRAVA: 'Doprava',
  JINE: 'Jiné',
}

export const PROTOKOL_MAX_FOTEK = 6

// Escapuje VŠECHNY dynamické hodnoty (data tenanta) do HTML. Bez toho hrozí
// injection do PDF. Pole protokolu jsou prostý text, ne HTML, takže escapujeme,
// nesanitizujeme. Datové URL (logo, fotky, podpis) projdou beze změny.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return formatDate(d)
}

function fmtTime(d: Date | string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' })
}

function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return '—'
  return `${formatDate(d)} ${fmtTime(d)}`
}

function trvaniLabel(minuty: number | null) {
  if (!minuty) return null
  const h = Math.floor(minuty / 60)
  const m = minuty % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function fmtMnozstvi(n: unknown) {
  return Number(n ?? 0).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })
}

// Jen datové URL (data:) projdou do <img src>. Cokoli jiného (http, relativní
// cesta, javascript:) zahodíme - hardened PDF stejně síť mimo fonty blokuje a
// nechceme tenant-controlled URL v dokumentu.
function safeImageSrc(src: string | null | undefined): string | null {
  if (!src) return null
  return src.startsWith('data:') ? src : null
}

function safeColor(c: string | null | undefined): string {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#1B5E20'
}

/** Víceřádkový text: escapovat, zachovat odřádkování (pre-wrap v CSS) */
function textBlock(s: string) {
  return `<div class="text">${esc(s.trim())}</div>`
}

type Navsteva = {
  id: string
  cislo: string | null
  typ: string
  stav?: string | null
  // Zadání (servis/nova) — u starších zakázek chybí, sekce se pak nevykreslí
  popis?: string | null
  priorita?: string | null
  adresaZasahu?: string | null
  kontaktJmeno?: string | null
  kontaktTelefon?: string | null
  planovanyTermin: Date | string | null
  skutecnyTermin: Date | string | null
  trvaniMinut: number | null
  zprava: string | null
  nalezeneZavady: string | null
  doporuceni: string | null
  fotky: unknown
  podpisKlienta: string | null
  /** false = klient nebyl při zásahu přítomen (protokol bez podpisu) */
  klientPritomen?: boolean
  protokolDokoncen?: Date | string | null
  technik: { jmeno: string } | null
  polozky?: {
    typ: string
    popis: string
    mnozstvi: unknown
    jednotka: string
    krytoKontraktem: boolean
  }[]
}

type Zarizeni = {
  nazev: string
  typ: string
  vyrobniCislo: string | null
  datumInstalace: Date | string | null
  zarukaDo: Date | string | null
} | null

type Klient = {
  jmeno: string
  prijmeni: string
  telefon: string | null
  email: string | null
  ulice: string | null
  mesto: string | null
  psc: string | null
} | null

type Org = {
  nazev: string
  sidlo: string | null
  ico: string | null
  dic?: string | null
  email: string | null
  telefon: string | null
  // Předvyřešená data URL loga (orgLogoDataUrl) z routy, ne relativní cesta.
  logo: string | null
  primaryColor?: string | null
}

function row(label: string, value: string | null | undefined) {
  if (!value) return ''
  return `<div class="kv"><span class="k">${label}</span><span class="v">${value}</span></div>`
}

export function generateServisniProtokolHtml(
  navsteva: Navsteva,
  zarizeni: Zarizeni,
  klient: Klient,
  org: Org,
): string {
  const barva = safeColor(org.primaryColor)
  const cislo = esc(navsteva.cislo ?? navsteva.id.slice(0, 8).toUpperCase())
  const datumZasahu = fmtDate(navsteva.skutecnyTermin ?? navsteva.planovanyTermin ?? navsteva.protokolDokoncen)
  const dokonceno = !!navsteva.protokolDokoncen
  const nepritomen = navsteva.klientPritomen === false
  const podpisSrc = nepritomen ? null : podpisToImgSrc(navsteva.podpisKlienta)
  const klientJmeno = klient ? `${klient.jmeno} ${klient.prijmeni}`.trim() : null

  const fotky = (Array.isArray(navsteva.fotky) ? navsteva.fotky as string[] : [])
    .map(safeImageSrc)
    .filter((s): s is string => s !== null)
    .slice(0, PROTOKOL_MAX_FOTEK)

  const adresaKlienta = klient
    ? [klient.ulice, [klient.psc, klient.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : ''
  const mistoZasahu = navsteva.adresaZasahu?.trim() || adresaKlienta

  const logoSrc = safeImageSrc(org.logo)
  const orgRadky = [
    org.sidlo,
    [org.ico && `IČO ${org.ico}`, org.dic && `DIČ ${org.dic}`].filter(Boolean).join(' · '),
    [org.telefon, org.email].filter(Boolean).join(' · '),
  ].filter(Boolean) as string[]

  // Stav dokumentu: klient musí na první pohled vidět, co drží v ruce
  const stavChip = !dokonceno
    ? `<span class="chip chip-draft">Koncept — zásah neukončen</span>`
    : podpisSrc
      ? `<span class="chip chip-ok">Podepsáno klientem</span>`
      : nepritomen
        ? `<span class="chip chip-warn">Klient nebyl přítomen</span>`
        : `<span class="chip chip-warn">Nepodepsáno klientem</span>`

  // ── Hlavička ──────────────────────────────────────────────────────────────
  const header = `
  <table class="head">
    <tr>
      <td class="head-org">
        ${logoSrc
          ? `<img class="logo" src="${esc(logoSrc)}" alt="" />`
          : `<div class="org-name-big">${esc(org.nazev)}</div>`}
        <div class="org-lines">
          ${logoSrc ? `<strong>${esc(org.nazev)}</strong><br/>` : ''}
          ${orgRadky.map(esc).join('<br/>')}
        </div>
      </td>
      <td class="head-doc">
        <div class="doc-title">Servisní protokol</div>
        <div class="doc-no">${cislo}</div>
        <div class="doc-date">Datum zásahu: <strong>${datumZasahu}</strong></div>
        <div style="margin-top:6px">${stavChip}</div>
      </td>
    </tr>
  </table>`

  // ── Strany: zákazník / místo / zařízení ───────────────────────────────────
  const kontaktNaMiste = [navsteva.kontaktJmeno, navsteva.kontaktTelefon].filter(Boolean).join(', ')
  const zarukaPlatna = zarizeni?.zarukaDo ? new Date(zarizeni.zarukaDo).getTime() >= Date.now() : null

  const parties = `
  <table class="parties">
    <tr>
      <td>
        <div class="label">Zákazník</div>
        <div class="strong">${esc(klientJmeno ?? '—')}</div>
        ${adresaKlienta ? `<div>${esc(adresaKlienta)}</div>` : ''}
        ${klient?.telefon ? `<div>${esc(klient.telefon)}</div>` : ''}
        ${klient?.email ? `<div>${esc(klient.email)}</div>` : ''}
      </td>
      <td>
        <div class="label">Místo zásahu</div>
        <div class="strong">${esc(mistoZasahu || '—')}</div>
        ${kontaktNaMiste ? `<div>Kontakt na místě: ${esc(kontaktNaMiste)}</div>` : ''}
      </td>
      <td>
        <div class="label">Zařízení</div>
        ${zarizeni ? `
          <div class="strong">${esc(zarizeni.nazev)}</div>
          <div>${esc(TYP_LABELS[zarizeni.typ] ?? zarizeni.typ)}</div>
          ${zarizeni.vyrobniCislo ? `<div>Výr. č. ${esc(zarizeni.vyrobniCislo)}</div>` : ''}
          ${zarizeni.datumInstalace ? `<div>Instalace ${fmtDate(zarizeni.datumInstalace)}</div>` : ''}
          ${zarizeni.zarukaDo ? `<div>Záruka do ${fmtDate(zarizeni.zarukaDo)}${zarukaPlatna === false ? ' (po záruce)' : ''}</div>` : ''}
        ` : '<div class="muted">Neuvedeno</div>'}
      </td>
    </tr>
  </table>`

  // ── Údaje o zásahu (jeden řádek) ──────────────────────────────────────────
  const prijezd = navsteva.skutecnyTermin ? fmtDateTime(navsteva.skutecnyTermin) : null
  const meta = `
  <div class="meta">
    ${row('Typ zásahu', esc(NAVSTEVA_TYP_LABELS[navsteva.typ] ?? navsteva.typ))}
    ${row('Technik', navsteva.technik?.jmeno ? esc(navsteva.technik.jmeno) : null)}
    ${row('Příjezd', prijezd)}
    ${row('Doba práce', trvaniLabel(navsteva.trvaniMinut))}
    ${navsteva.priorita === 'URGENTNI' ? row('Priorita', 'Urgentní') : ''}
  </div>`

  // ── Textové sekce: jen vyplněné; „Provedené práce" vždy ────────────────────
  const section = (title: string, body: string) => `
  <section class="sec">
    <h2>${title}</h2>
    ${body}
  </section>`

  const texty = [
    navsteva.popis?.trim() ? section('Hlášená závada / požadavek', textBlock(navsteva.popis)) : '',
    section('Provedené práce', navsteva.zprava?.trim()
      ? textBlock(navsteva.zprava)
      : `<div class="text muted">${dokonceno ? 'Bez záznamu.' : 'Doplní technik po ukončení zásahu.'}</div>`),
    navsteva.nalezeneZavady?.trim() ? section('Zjištěné závady', textBlock(navsteva.nalezeneZavady)) : '',
    navsteva.doporuceni?.trim() ? section('Doporučení', textBlock(navsteva.doporuceni)) : '',
  ].join('')

  // ── Položky (bez cen) ─────────────────────────────────────────────────────
  const polozky = navsteva.polozky ?? []
  const nejakeKryto = polozky.some(p => p.krytoKontraktem)
  const polozkyHtml = polozky.length === 0 ? '' : section('Provedené úkony a použitý materiál', `
    <table class="items">
      <thead>
        <tr>
          <th class="c-no">#</th>
          <th class="c-typ">Druh</th>
          <th>Popis</th>
          <th class="c-qty">Množství</th>
          ${nejakeKryto ? '<th class="c-kryto">Smlouva</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${polozky.map((p, i) => `
        <tr>
          <td class="c-no">${i + 1}</td>
          <td class="c-typ">${esc(POLOZKA_TYP_LABELS[p.typ] ?? p.typ)}</td>
          <td>${esc(p.popis)}</td>
          <td class="c-qty">${fmtMnozstvi(p.mnozstvi)} ${esc(p.jednotka)}</td>
          ${nejakeKryto ? `<td class="c-kryto">${p.krytoKontraktem ? 'v ceně smlouvy' : ''}</td>` : ''}
        </tr>`).join('')}
      </tbody>
    </table>`)

  // ── Fotky: tabulka po 3, řádek se nedělí mezi stránky ─────────────────────
  const fotkyRows: string[][] = []
  for (let i = 0; i < fotky.length; i += 3) fotkyRows.push(fotky.slice(i, i + 3))
  const fotkyHtml = fotky.length === 0 ? '' : `
  <section class="sec">
    <h2>Fotodokumentace</h2>
    <table class="photos">
      ${fotkyRows.map(r => `
      <tr>
        ${[0, 1, 2].map(j => `<td>${r[j] ? `<img src="${esc(r[j])}" alt="" />` : ''}</td>`).join('')}
      </tr>`).join('')}
    </table>
  </section>`

  // ── Podpisy (celý blok vždy pohromadě) ────────────────────────────────────
  const podpisDatum = dokonceno ? fmtDate(navsteva.protokolDokoncen) : ''
  const podpisy = `
  <section class="sec signs">
    <h2>Předání a převzetí</h2>
    <p class="prohlaseni">
      ${nepritomen
        ? 'Klient nebyl při zásahu přítomen. Protokol byl vyhotoven bez podpisu zákazníka.'
        : `Zákazník svým podpisem potvrzuje, že výše uvedené práce byly provedeny a zařízení
      bylo předáno${zarizeni ? ' v provozuschopném stavu, není-li v protokolu uvedeno jinak' : ''}.`}
    </p>
    <table class="sign-table">
      <tr>
        <td>
          <div class="sign-box"></div>
          <div class="sign-caption">
            Za zhotovitele: <strong>${esc(navsteva.technik?.jmeno ?? org.nazev)}</strong><br/>
            ${esc(org.nazev)}
          </div>
        </td>
        <td>
          <div class="sign-box">
            ${podpisSrc ? `<img src="${esc(podpisSrc)}" alt="Podpis zákazníka" />` : ''}
          </div>
          <div class="sign-caption">
            Zákazník: <strong>${esc(klientJmeno ?? '')}</strong><br/>
            ${podpisSrc
              ? `Podepsáno elektronicky${podpisDatum ? ` dne ${podpisDatum}` : ''}`
              : nepritomen
                ? 'Nebyl přítomen'
                : 'Datum: ………………………'}
          </div>
        </td>
      </tr>
    </table>
  </section>`

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Servisní protokol ${cislo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 9.5pt;
    line-height: 1.45;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table { border-collapse: collapse; width: 100%; }
  td, th { vertical-align: top; text-align: left; }
  .muted { color: #9ca3af; }
  .strong { font-weight: 600; }

  /* Hlavička */
  .head { border-bottom: 2.5px solid ${barva}; margin-bottom: 14px; break-inside: avoid; }
  .head td { padding-bottom: 12px; }
  .head-org { width: 55%; }
  .logo { max-height: 46px; max-width: 170px; object-fit: contain; display: block; margin-bottom: 6px; }
  .org-name-big { font-size: 15pt; font-weight: 800; margin-bottom: 4px; }
  .org-lines { font-size: 8pt; color: #4b5563; line-height: 1.5; }
  .head-doc { text-align: right; }
  .doc-title { font-size: 17pt; font-weight: 800; color: ${barva}; letter-spacing: -0.2px; }
  .doc-no { font-size: 11pt; font-weight: 700; margin-top: 2px; }
  .doc-date { font-size: 9pt; color: #4b5563; margin-top: 2px; }
  .chip { display: inline-block; font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.4px; padding: 2px 8px; border-radius: 3px; border: 1px solid; }
  .chip-ok { color: #166534; border-color: #86efac; background: #f0fdf4; }
  .chip-warn { color: #92400e; border-color: #fcd34d; background: #fffbeb; }
  .chip-draft { color: #4b5563; border-color: #d1d5db; background: #f9fafb; }

  /* Zákazník / místo / zařízení */
  .parties { margin-bottom: 10px; break-inside: avoid; }
  .parties td { width: 33.33%; padding: 0 12px 0 0; font-size: 9pt; line-height: 1.5; }
  .parties td + td { padding-left: 12px; border-left: 1px solid #e5e7eb; }
  .label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
           color: #6b7280; margin-bottom: 3px; }

  /* Údaje o zásahu */
  .meta { display: flex; flex-wrap: wrap; gap: 4px 22px; padding: 7px 0; margin-bottom: 4px;
          border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; break-inside: avoid; }
  .kv .k { color: #6b7280; margin-right: 5px; }
  .kv .v { font-weight: 600; }

  /* Sekce */
  .sec { margin-top: 14px; }
  .sec h2 { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
            color: ${barva}; padding-bottom: 3px; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb;
            break-after: avoid; page-break-after: avoid; }
  .text { white-space: pre-wrap; orphans: 3; widows: 3; }

  /* Položky */
  .items thead { display: table-header-group; }
  .items th { font-size: 7.5pt; font-weight: 600; color: #6b7280; text-transform: uppercase;
              letter-spacing: 0.3px; padding: 4px 6px; border-bottom: 1px solid #d1d5db; }
  .items td { padding: 5px 6px; border-bottom: 1px solid #f0f0f0; }
  .items tr { break-inside: avoid; page-break-inside: avoid; }
  .c-no { width: 24px; color: #9ca3af; }
  .c-typ { width: 70px; color: #4b5563; }
  .c-qty { width: 90px; text-align: right !important; white-space: nowrap; }
  .c-kryto { width: 100px; color: #4b5563; font-size: 8.5pt; }

  /* Fotky */
  .photos { border-collapse: separate; border-spacing: 0 6px; margin-top: -6px; }
  .photos tr { break-inside: avoid; page-break-inside: avoid; }
  .photos td { width: 33.33%; padding: 0 3px; }
  .photos td:first-child { padding-left: 0; }
  .photos td:last-child { padding-right: 0; }
  .photos img { width: 100%; height: 40mm; object-fit: cover; border-radius: 3px; display: block; }

  /* Podpisy */
  .signs { break-inside: avoid; page-break-inside: avoid; margin-top: 18px; }
  .prohlaseni { font-size: 8.5pt; color: #4b5563; margin-bottom: 10px; }
  .sign-table td { width: 50%; padding-right: 24px; }
  .sign-table td + td { padding-right: 0; padding-left: 24px; }
  .sign-box { height: 22mm; border-bottom: 1px solid #374151; display: flex; align-items: flex-end; }
  .sign-box img { max-height: 20mm; max-width: 100%; object-fit: contain; }
  .sign-caption { font-size: 8.5pt; color: #4b5563; margin-top: 4px; line-height: 1.5; }
</style>
</head>
<body>
  ${header}
  ${parties}
  ${meta}
  ${texty}
  ${polozkyHtml}
  ${fotkyHtml}
  ${podpisy}
</body>
</html>`
}
