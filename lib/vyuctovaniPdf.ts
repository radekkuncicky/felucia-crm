function fmt(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('cs-CZ')
}

function fmtKc(n: number) {
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' Kč'
}

export type VyuctovaniPdfData = {
  id: string
  cislo: string
  stav: string
  poznamka: string | null
  vytvoreno: string
  schvaleno: string | null
  schvalil: { jmeno: string } | null
  zakazka: {
    cislo: string
    nazev: string
    klient: {
      jmeno: string
      prijmeni: string
      telefon: string | null
      email: string | null
      ulice: string | null
      mesto: string | null
      psc: string | null
      ico: string | null
    }
    organization: {
      nazev: string
      sidlo: string | null
      email: string | null
      logo: string | null
      ico: string | null
      dic: string | null
      telefon: string | null
    }
  }
  polozky: {
    nazev: string
    mnozstvi: number
    jednotka: string
    nakupniCena: number | null
    prodejniCena: number
    dphSazba: number
  }[]
}

export function generateVyuctovaniHtml(v: VyuctovaniPdfData): string {
  const org = v.zakazka.organization
  const klient = v.zakazka.klient
  const datum = fmt(v.schvaleno ?? v.vytvoreno)

  const logoHtml = org.logo
    ? `<img src="${org.logo}" style="height:40px;max-width:140px;object-fit:contain;" />`
    : `<span style="font-size:18px;font-weight:800;color:#1A2744;">${org.nazev}</span>`

  // Compute totals
  let celkemBezDph = 0
  const dphByRate: Record<number, number> = {}

  for (const p of v.polozky) {
    const bezDph = Number(p.mnozstvi) * Number(p.prodejniCena)
    celkemBezDph += bezDph
    const sazba = Number(p.dphSazba)
    dphByRate[sazba] = (dphByRate[sazba] ?? 0) + bezDph * (sazba / 100)
  }

  const celkemDph = Object.values(dphByRate).reduce((a, b) => a + b, 0)
  const celkemSDph = celkemBezDph + celkemDph

  // Položky rows
  const polozkyRows = v.polozky.map((p, i) => {
    const bezDph = Number(p.mnozstvi) * Number(p.prodejniCena)
    const sDph = bezDph * (1 + Number(p.dphSazba) / 100)
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:6px 8px;text-align:center;color:#6b7280;">${i + 1}</td>
        <td style="padding:6px 8px;font-weight:500;">${p.nazev}</td>
        <td style="padding:6px 8px;text-align:center;">${Number(p.mnozstvi)}</td>
        <td style="padding:6px 8px;text-align:center;color:#6b7280;">${p.jednotka}</td>
        <td style="padding:6px 8px;text-align:right;">${fmtKc(Number(p.prodejniCena))}</td>
        <td style="padding:6px 8px;text-align:center;color:#6b7280;">${Number(p.dphSazba)} %</td>
        <td style="padding:6px 8px;text-align:right;">${fmtKc(bezDph)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:600;">${fmtKc(sDph)}</td>
      </tr>
    `
  }).join('')

  const klientAdresa = [klient.ulice, klient.mesto && klient.psc ? `${klient.psc} ${klient.mesto}` : klient.mesto ?? klient.psc].filter(Boolean).join(', ')

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
    th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; padding: 6px 8px; text-align: left; }
    .section { margin-bottom: 16px; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 4px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <!-- HLAVIČKA -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1A2744;">
    <div>
      ${logoHtml}
      <p style="margin:4px 0 0;font-size:10px;color:#6b7280;">${org.sidlo ?? ''}</p>
      ${org.ico ? `<p style="margin:2px 0 0;font-size:10px;color:#6b7280;">IČO: ${org.ico}${org.dic ? ` · DIČ: ${org.dic}` : ''}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <p style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin:0;">Vyúčtování zakázky</p>
      <p style="font-family:monospace;font-size:22px;font-weight:800;color:#1A2744;margin:4px 0 0;">${v.cislo}</p>
      <p style="font-size:10px;color:#6b7280;margin:2px 0 0;">Datum: ${datum}</p>
      ${v.schvalil ? `<p style="font-size:10px;color:#6b7280;margin:2px 0 0;">Schválil: ${v.schvalil.jmeno}</p>` : ''}
    </div>
  </div>

  <!-- ZHOTOVITEL + OBJEDNATEL -->
  <div class="section">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0 0 6px;">Zhotovitel</p>
        <p style="font-size:13px;font-weight:700;color:#1A2744;margin:0 0 4px;">${org.nazev}</p>
        ${org.sidlo ? `<p style="margin:0 0 2px;color:#374151;">${org.sidlo}</p>` : ''}
        ${org.email ? `<p style="margin:0 0 2px;color:#374151;">${org.email}</p>` : ''}
        ${org.telefon ? `<p style="margin:0 0 2px;color:#374151;">${org.telefon}</p>` : ''}
        ${org.ico ? `<p style="margin:0;color:#6b7280;font-size:10px;">IČO: ${org.ico}</p>` : ''}
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0 0 6px;">Objednatel</p>
        <p style="font-size:13px;font-weight:700;color:#1A2744;margin:0 0 4px;">${klient.jmeno} ${klient.prijmeni}</p>
        ${klientAdresa ? `<p style="margin:0 0 2px;color:#374151;">${klientAdresa}</p>` : ''}
        ${klient.telefon ? `<p style="margin:0 0 2px;color:#374151;">${klient.telefon}</p>` : ''}
        ${klient.email ? `<p style="margin:0 0 2px;color:#374151;">${klient.email}</p>` : ''}
        ${klient.ico ? `<p style="margin:0;color:#6b7280;font-size:10px;">IČO: ${klient.ico}</p>` : ''}
      </div>
    </div>
    <p style="margin:8px 0 0;font-size:10px;color:#374151;"><strong>Zakázka:</strong> ${v.zakazka.cislo} — ${v.zakazka.nazev}</p>
  </div>

  <!-- POLOŽKY -->
  <div class="section">
    <h2>Položky</h2>
    <table>
      <thead>
        <tr>
          <th style="width:28px;text-align:center;">#</th>
          <th>Název</th>
          <th style="width:50px;text-align:center;">Mn.</th>
          <th style="width:40px;text-align:center;">Jed.</th>
          <th style="width:80px;text-align:right;">Cena/ks</th>
          <th style="width:50px;text-align:center;">DPH%</th>
          <th style="width:90px;text-align:right;">Celkem bez DPH</th>
          <th style="width:90px;text-align:right;">Celkem s DPH</th>
        </tr>
      </thead>
      <tbody>
        ${polozkyRows || '<tr><td colspan="8" style="padding:12px;text-align:center;color:#9ca3af;">Žádné položky</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- SOUHRN -->
  <div class="section" style="display:flex;justify-content:flex-end;">
    <div style="width:260px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e7eb;">
        <span style="color:#6b7280;">Celkem bez DPH</span>
        <span style="font-weight:600;">${fmtKc(celkemBezDph)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e7eb;">
        <span style="color:#6b7280;">DPH</span>
        <span style="font-weight:600;">${fmtKc(celkemDph)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#FFC93C;border-radius:6px;margin-top:4px;">
        <span style="font-weight:700;color:#1A2744;font-size:13px;">Celkem s DPH</span>
        <span style="font-weight:800;color:#1A2744;font-size:13px;">${fmtKc(celkemSDph)}</span>
      </div>
    </div>
  </div>

  <!-- PATIČKA -->
  <div class="page-footer">
    <span>${org.nazev}${org.sidlo ? ` · ${org.sidlo}` : ''}${org.email ? ` · ${org.email}` : ''}</span>
    <span>Strana 1</span>
  </div>
</body>
</html>`
}
