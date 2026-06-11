function fmt(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('cs-CZ')
}

const TECH_LABELS: Record<string, string> = {
  KLIMA: 'Klimatizace', TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  REKUPERACE: 'Rekuperace', PODLAHOVE_TOPENI: 'Podlahové topení',
  VZDUCHOTECHNIKA: 'Vzduchotechnika', JINE: 'Jiné',
}

export type PredavakPdfData = {
  id: string
  cislo: string
  stav: string
  poznamka: string | null
  klientPritomen: boolean
  podpisSvg: string | null
  podpisano: string | null
  schvaleno: string | null
  zakazka: {
    cislo: string
    nazev: string
    technologie: string | null
    klient: {
      jmeno: string
      prijmeni: string
      telefon: string | null
      email: string | null
      ulice: string | null
      mesto: string | null
      psc: string | null
    }
    organization: {
      nazev: string
      sidlo: string | null
      email: string | null
      logo: string | null
      ico: string | null
      telefon: string | null
    }
  }
  technik: {
    jmeno: string
    email: string
    telefon: string | null
  }
  polozky: {
    nazev: string
    planovanoMnozstvi: number
    mnozstviPouzito: number
    jednotka: string
    zahrnuto: boolean
    poznamka: string | null
  }[]
  fotky: {
    url: string
    popis: string | null
  }[]
}

export function generatePredavakHtml(p: PredavakPdfData): string {
  const org = p.zakazka.organization
  const klient = p.zakazka.klient
  const datum = fmt(p.podpisano ?? new Date().toISOString())

  // Header logo or company name
  const logoHtml = org.logo
    ? `<img src="${org.logo}" style="height:40px;max-width:140px;object-fit:contain;" />`
    : `<span style="font-size:18px;font-weight:800;color:#ffffff;">${org.nazev}</span>`

  // Klient address
  const adresa = [klient.ulice, klient.mesto && klient.psc ? `${klient.psc} ${klient.mesto}` : klient.mesto ?? klient.psc].filter(Boolean).join(', ')

  // Only included items
  const zahrnutePolozky = p.polozky.filter(pol => pol.zahrnuto)

  // Položky rows — only zahrnute
  const polozkyRows = zahrnutePolozky.map((pol, i) => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:6px 8px;text-align:center;color:#6b7280;">${i + 1}</td>
      <td style="padding:6px 8px;font-weight:500;">${pol.nazev}</td>
      <td style="padding:6px 8px;text-align:center;">${Number(pol.planovanoMnozstvi)}</td>
      <td style="padding:6px 8px;text-align:center;font-weight:600;color:#1B5E20;">${Number(pol.mnozstviPouzito)}</td>
      <td style="padding:6px 8px;text-align:center;color:#6b7280;">${pol.jednotka}</td>
      <td style="padding:6px 8px;color:#6b7280;font-size:10px;">${pol.poznamka ?? ''}</td>
    </tr>
  `).join('')

  // Fotky grid
  const fotkyHtml = p.fotky.length > 0 ? `
    <div style="page-break-inside:avoid;">
      <h2 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#374151;margin:0 0 8px;padding-bottom:4px;border-bottom:2px solid #FFC93C;">
        Fotodokumentace
      </h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
        ${p.fotky.map(f => `
          <div style="break-inside:avoid;">
            <img src="${f.url}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;" />
            ${f.popis ? `<p style="font-size:9px;color:#6b7280;margin:3px 0 0;text-align:center;">${f.popis}</p>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  ` : ''

  // Potvrzení předání (replaces signatures)
  const potvrzeniHtml = `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <p style="font-size:10px;font-weight:600;color:#1B5E20;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">Zhotovitel (technik)</p>
          <p style="font-size:12px;font-weight:600;color:#111827;margin:0;">${p.technik.jmeno}</p>
          ${p.technik.telefon ? `<p style="font-size:10px;color:#6b7280;margin:2px 0 0;">${p.technik.telefon}</p>` : ''}
          <p style="font-size:10px;color:#6b7280;margin:4px 0 0;">${datum}</p>
        </div>
        <div>
          <p style="font-size:10px;font-weight:600;color:#1B5E20;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">Objednatel (klient)</p>
          <p style="font-size:12px;font-weight:600;color:#111827;margin:0;">${klient.jmeno} ${klient.prijmeni}</p>
          ${klient.telefon ? `<p style="font-size:10px;color:#6b7280;margin:2px 0 0;">${klient.telefon}</p>` : ''}
          <p style="font-size:10px;color:#6b7280;margin:4px 0 0;">${datum}</p>
        </div>
      </div>
      ${!p.klientPritomen ? `
        <div style="margin-top:10px;padding:8px 12px;background:#fef3c7;border-radius:6px;border-left:3px solid #f59e0b;">
          <p style="margin:0;font-size:10px;color:#92400e;font-style:italic;">
            Klient nebyl při předání přítomen. Protokol byl vyhotoven bez podpisu zákazníka.
          </p>
        </div>
      ` : ''}
    </div>
  `

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
    h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #374151; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 2px solid #FFC93C; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1B5E20; color: #ffffff; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; padding: 6px 8px; text-align: left; }
    .section { margin-bottom: 16px; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 4px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <!-- HLAVIČKA -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #1B5E20;background:#1B5E20;margin:-0px;padding:14px 16px 14px;border-radius:6px 6px 0 0;">
    <div>
      ${logoHtml}
      <p style="margin:4px 0 0;font-size:10px;color:#a7f3d0;">${org.sidlo ?? ''}</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:10px;font-weight:600;color:#a7f3d0;text-transform:uppercase;letter-spacing:.1em;margin:0;">Předávací protokol</p>
      <p style="font-family:monospace;font-size:22px;font-weight:800;color:#ffffff;margin:4px 0 0;">${p.cislo}</p>
      <p style="font-size:10px;color:#a7f3d0;margin:2px 0 0;">${datum}</p>
    </div>
  </div>
  <div style="border-bottom:3px solid #1B5E20;margin-bottom:16px;"></div>

  <!-- ZAKÁZKA + KLIENT -->
  <div class="section">
    <h2>Zakázka &amp; klient</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;">
        <p style="font-size:10px;font-weight:700;color:#1B5E20;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Zakázka</p>
        <p style="margin:0 0 3px;"><strong>${p.zakazka.cislo}</strong></p>
        <p style="margin:0 0 3px;color:#374151;">${p.zakazka.nazev}</p>
        ${p.zakazka.technologie ? `<span style="display:inline-block;background:#dcfce7;color:#1B5E20;font-size:9px;font-weight:600;padding:2px 8px;border-radius:12px;margin-top:4px;">${TECH_LABELS[p.zakazka.technologie] ?? p.zakazka.technologie}</span>` : ''}
        <p style="margin:8px 0 0;font-size:10px;color:#6b7280;"><strong>Technik:</strong> ${p.technik.jmeno}${p.technik.telefon ? ` · ${p.technik.telefon}` : ''}</p>
      </div>
      <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;">
        <p style="font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Klient</p>
        <p style="margin:0 0 3px;font-weight:600;">${klient.jmeno} ${klient.prijmeni}</p>
        ${adresa ? `<p style="margin:0 0 3px;color:#6b7280;">${adresa}</p>` : ''}
        ${klient.telefon ? `<p style="margin:0 0 3px;"><strong>Tel:</strong> ${klient.telefon}</p>` : ''}
        ${klient.email ? `<p style="margin:0;"><strong>Email:</strong> ${klient.email}</p>` : ''}
      </div>
    </div>
  </div>

  <!-- POLOŽKY -->
  <div class="section">
    <h2>Provedené práce — položky</h2>
    <table>
      <thead>
        <tr>
          <th style="width:32px;text-align:center;">#</th>
          <th>Název</th>
          <th style="width:80px;text-align:center;">Plánováno</th>
          <th style="width:70px;text-align:center;">Použito</th>
          <th style="width:50px;text-align:center;">Jed.</th>
          <th>Poznámka</th>
        </tr>
      </thead>
      <tbody>
        ${polozkyRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#9ca3af;">Žádné položky</td></tr>'}
      </tbody>
    </table>
  </div>

  ${p.poznamka ? `
  <!-- POZNÁMKA -->
  <div class="section">
    <h2>Poznámka k předání</h2>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;min-height:40px;">
      <p style="margin:0;color:#374151;">${p.poznamka}</p>
    </div>
  </div>
  ` : ''}

  ${fotkyHtml}

  <!-- POTVRZENÍ PŘEDÁNÍ -->
  <div class="section" style="page-break-inside:avoid;">
    <h2>Potvrzení předání</h2>
    ${potvrzeniHtml}
  </div>

  <!-- PATIČKA -->
  <div class="page-footer">
    <span>${org.nazev}${org.sidlo ? ` · ${org.sidlo}` : ''}${org.email ? ` · ${org.email}` : ''}</span>
    <span>Strana 1</span>
  </div>
</body>
</html>`
}
