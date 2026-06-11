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

function fmt(n: number) {
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('cs-CZ')
}

function fmtDateTime(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function trvaniLabel(minuty: number | null) {
  if (!minuty) return '—'
  const h = Math.floor(minuty / 60)
  const m = minuty % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} hod`
  return `${h} hod ${m} min`
}

function zarukaColor(zarukaDo: Date | string | null) {
  if (!zarukaDo) return '#6b7280'
  const diff = (new Date(zarukaDo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return '#dc2626'
  if (diff < 90) return '#d97706'
  return '#16a34a'
}

type Navsteva = {
  id: string
  cisloNavstevy: string | null
  typ: string
  planovanyTermin: Date | string
  skutecnyTermin: Date | string | null
  trvaniMinut: number | null
  zprava: string | null
  nalezeneZavady: string | null
  doporuceni: string | null
  nakladyCas: unknown
  nakladyMaterial: unknown
  fotky: unknown
  podpisKlienta: string | null
  technik: { jmeno: string } | null
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
  email: string | null
  telefon: string | null
  logo: string | null
}

export function generateServisniProtokolHtml(
  navsteva: Navsteva,
  zarizeni: Zarizeni,
  klient: Klient,
  org: Org,
): string {
  const cislo = navsteva.cisloNavstevy ?? navsteva.id.slice(0, 8).toUpperCase()
  const datum = fmtDate(navsteva.planovanyTermin)
  const datumTisku = new Date().toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const nakladyCas = Number(navsteva.nakladyCas ?? 0)
  const nakladyMaterial = Number(navsteva.nakladyMaterial ?? 0)
  const celkemNaklady = nakladyCas + nakladyMaterial

  const fotky = Array.isArray(navsteva.fotky) ? navsteva.fotky as string[] : []

  const adresaKlienta = klient
    ? [klient.ulice, [klient.mesto, klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : '—'

  const logoHtml = org.logo
    ? `<img src="${org.logo}" alt="Logo" style="height:50px;object-fit:contain;" />`
    : `<span style="font-size:20px;font-weight:800;color:#1a1a2e;">${org.nazev}</span>`

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Servisní protokol ${cislo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a2e;
    background: #fff;
    padding: 0;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 18mm 14mm;
    margin: 0 auto;
    background: #fff;
  }
  h2 { font-size: 13pt; font-weight: 700; color: #1a1a2e; margin-bottom: 10px; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #16a34a;
    padding-bottom: 14px;
    margin-bottom: 20px;
  }
  .header-title { font-size: 24pt; font-weight: 800; color: #16a34a; }
  .header-meta { text-align: right; font-size: 10pt; color: #4b5563; }
  .header-meta strong { color: #1a1a2e; font-size: 12pt; }
  .section {
    margin-bottom: 18px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  .section-title {
    background: #f0fdf4;
    border-bottom: 1px solid #d1fae5;
    padding: 8px 14px;
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #15803d;
  }
  .section-body { padding: 12px 14px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 16px; }
  .field { margin-bottom: 4px; }
  .field-label { font-size: 8.5pt; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
  .field-value { font-size: 10.5pt; color: #1a1a2e; font-weight: 500; }
  .field-value a { color: #16a34a; text-decoration: none; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 9pt;
    font-weight: 600;
  }
  .badge-green { background: #dcfce7; color: #15803d; }
  .badge-red { background: #fee2e2; color: #dc2626; }
  .badge-orange { background: #ffedd5; color: #c2410c; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .text-block {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 10.5pt;
    line-height: 1.5;
    white-space: pre-wrap;
    color: #1a1a2e;
    min-height: 40px;
  }
  .text-block.empty { color: #9ca3af; font-style: italic; }
  .costs-table { width: 100%; border-collapse: collapse; }
  .costs-table td { padding: 5px 8px; font-size: 10.5pt; }
  .costs-table .label { color: #6b7280; }
  .costs-table .value { text-align: right; font-weight: 500; }
  .costs-table .total { border-top: 2px solid #16a34a; font-weight: 700; color: #15803d; font-size: 12pt; }
  .photos-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .photo-item img {
    width: 100%;
    height: 100px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    margin-top: 6px;
  }
  .signature-line {
    border-bottom: 1.5px solid #374151;
    padding-bottom: 4px;
    margin-bottom: 6px;
    height: 50px;
  }
  .signature-name { font-size: 9pt; color: #6b7280; }
  .footer {
    margin-top: 20px;
    border-top: 1px solid #e5e7eb;
    padding-top: 10px;
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    color: #9ca3af;
  }
  @media print {
    body { padding: 0; }
    .page { padding: 15mm 15mm 12mm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      ${logoHtml}
    </div>
    <div class="header-meta">
      <div class="header-title">Servisní protokol</div>
      <div><strong>${cislo}</strong></div>
      <div>Datum: ${datum}</div>
    </div>
  </div>

  <!-- ZAŘÍZENÍ -->
  ${zarizeni ? `
  <div class="section">
    <div class="section-title">Zařízení</div>
    <div class="section-body">
      <div class="grid3">
        <div class="field">
          <div class="field-label">Název</div>
          <div class="field-value">${zarizeni.nazev}</div>
        </div>
        <div class="field">
          <div class="field-label">Typ</div>
          <div class="field-value">${TYP_LABELS[zarizeni.typ] ?? zarizeni.typ}</div>
        </div>
        <div class="field">
          <div class="field-label">Výrobní číslo</div>
          <div class="field-value">${zarizeni.vyrobniCislo ?? '—'}</div>
        </div>
        <div class="field">
          <div class="field-label">Datum instalace</div>
          <div class="field-value">${fmtDate(zarizeni.datumInstalace)}</div>
        </div>
        <div class="field">
          <div class="field-label">Záruka do</div>
          <div class="field-value" style="color:${zarukaColor(zarizeni.zarukaDo)}">
            ${fmtDate(zarizeni.zarukaDo)}
          </div>
        </div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- KLIENT -->
  ${klient ? `
  <div class="section">
    <div class="section-title">Klient</div>
    <div class="section-body">
      <div class="grid2">
        <div class="field">
          <div class="field-label">Jméno</div>
          <div class="field-value">${klient.jmeno} ${klient.prijmeni}</div>
        </div>
        <div class="field">
          <div class="field-label">Adresa</div>
          <div class="field-value">${adresaKlienta}</div>
        </div>
        <div class="field">
          <div class="field-label">Telefon</div>
          <div class="field-value">${klient.telefon ? `<a href="tel:${klient.telefon}">${klient.telefon}</a>` : '—'}</div>
        </div>
        <div class="field">
          <div class="field-label">Email</div>
          <div class="field-value">${klient.email ? `<a href="mailto:${klient.email}">${klient.email}</a>` : '—'}</div>
        </div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- PRŮBĚH SERVISU -->
  <div class="section">
    <div class="section-title">Průběh servisu</div>
    <div class="section-body">
      <div class="grid3">
        <div class="field">
          <div class="field-label">Typ návštěvy</div>
          <div class="field-value">${NAVSTEVA_TYP_LABELS[navsteva.typ] ?? navsteva.typ}</div>
        </div>
        <div class="field">
          <div class="field-label">Plánovaný termín</div>
          <div class="field-value">${fmtDateTime(navsteva.planovanyTermin)}</div>
        </div>
        <div class="field">
          <div class="field-label">Skutečný příjezd</div>
          <div class="field-value">${fmtDateTime(navsteva.skutecnyTermin)}</div>
        </div>
        <div class="field">
          <div class="field-label">Trvání</div>
          <div class="field-value">${trvaniLabel(navsteva.trvaniMinut)}</div>
        </div>
        <div class="field">
          <div class="field-label">Technik</div>
          <div class="field-value">${navsteva.technik?.jmeno ?? '—'}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- CO BYLO PROVEDENO -->
  <div class="section">
    <div class="section-title">Co bylo provedeno</div>
    <div class="section-body">
      <div class="${navsteva.zprava ? 'text-block' : 'text-block empty'}">${navsteva.zprava ?? 'Bez zprávy'}</div>
    </div>
  </div>

  <!-- NALEZENÉ ZÁVADY -->
  <div class="section">
    <div class="section-title">Nalezené závady</div>
    <div class="section-body">
      <div class="${navsteva.nalezeneZavady ? 'text-block' : 'text-block empty'}">${navsteva.nalezeneZavady ?? 'Bez závad'}</div>
    </div>
  </div>

  <!-- DOPORUČENÍ -->
  <div class="section">
    <div class="section-title">Doporučení</div>
    <div class="section-body">
      <div class="${navsteva.doporuceni ? 'text-block' : 'text-block empty'}">${navsteva.doporuceni ?? 'Bez doporučení'}</div>
    </div>
  </div>

  <!-- NÁKLADY -->
  <div class="section">
    <div class="section-title">Náklady</div>
    <div class="section-body">
      <table class="costs-table">
        <tr><td class="label">Práce</td><td class="value">${fmt(nakladyCas)} Kč</td></tr>
        <tr><td class="label">Materiál</td><td class="value">${fmt(nakladyMaterial)} Kč</td></tr>
        <tr class="total"><td class="label">Celkem</td><td class="value">${fmt(celkemNaklady)} Kč</td></tr>
      </table>
    </div>
  </div>

  <!-- FOTODOKUMENTACE -->
  ${fotky.length > 0 ? `
  <div class="section">
    <div class="section-title">Fotodokumentace</div>
    <div class="section-body">
      <div class="photos-grid">
        ${fotky.slice(0, 6).map(f => `
          <div class="photo-item">
            <img src="${f}" alt="Fotodokumentace" />
          </div>
        `).join('')}
      </div>
    </div>
  </div>
  ` : ''}

  <!-- PODPISY -->
  <div class="section">
    <div class="section-title">Podpisy</div>
    <div class="section-body">
      <div class="signatures">
        <div>
          <div class="signature-line">
            ${navsteva.podpisKlienta ? `<img src="${navsteva.podpisKlienta}" style="height:44px;max-width:100%;object-fit:contain;" />` : ''}
          </div>
          <div class="signature-name">Technik: ${navsteva.technik?.jmeno ?? '—'}</div>
        </div>
        <div>
          <div class="signature-line"></div>
          <div class="signature-name">Klient: ${klient ? `${klient.jmeno} ${klient.prijmeni}` : '—'}</div>
        </div>
      </div>
      ${navsteva.podpisKlienta ? `
      <div style="margin-top:12px;font-size:9.5pt;color:#15803d;">
        ☑ Klient převzal a podepsal
      </div>
      ` : ''}
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>
      <strong>${org.nazev}</strong>${org.sidlo ? ` · ${org.sidlo}` : ''}${org.ico ? ` · IČO: ${org.ico}` : ''}${org.telefon ? ` · ${org.telefon}` : ''}${org.email ? ` · ${org.email}` : ''}
    </div>
    <div>Vytištěno: ${datumTisku}</div>
  </div>

</div>
</body>
</html>`
}
