// Shared data types and HTML generator for SOD (Smlouva o Dílo)
// Used by both PDF and DOCX generation

import { SodTyp } from '@prisma/client'
import { formatKcPresne } from '@/lib/format'

export interface SodDocData {
  cislo: string
  typ: SodTyp
  datum: string
  klientJmeno: string
  klientAdresa: string | null
  klientEmail: string | null
  klientTelefon: string | null
  klientIco: string | null
  klientDic: string | null
  kontaktniOsoba: string | null
  kontaktniTelefon: string | null
  predmetDila: string
  adresaDila: string | null
  terminPrevzeti: string | null
  pocetDniRealizace: number | null
  zmenaTerm: string | null
  cenaBezDph: number | null
  cenaSDph: number | null
  dphSazba: number
  zalohaKc: number | null
  zalohaSplatnost: number | null
  zalohaKategorie: string | null
  org: {
    nazev: string
    sidlo: string | null
    ico: string | null
    dic: string | null
    email: string | null
    telefon: string | null
  }
}

const TYP_LABELS: Record<SodTyp, string> = {
  DPH_12_BEZ_ZALOHY: '12% DPH bez zálohy',
  DPH_12_SE_ZALOHOU: '12% DPH se zálohou',
  DPH_21_BEZ_ZALOHY: '21% DPH bez zálohy',
  DPH_21_SE_ZALOHOU: '21% DPH se zálohou',
  PDP_BEZ_ZALOHY: 'PDP bez zálohy',
  PDP_SE_ZALOHOU: 'PDP se zálohou',
}

export function isPdp(typ: SodTyp) {
  return typ === 'PDP_BEZ_ZALOHY' || typ === 'PDP_SE_ZALOHOU'
}

export function seZalohou(typ: SodTyp) {
  return typ === 'DPH_12_SE_ZALOHOU' || typ === 'DPH_21_SE_ZALOHOU' || typ === 'PDP_SE_ZALOHOU'
}

function fmtKc(n: number | null | undefined): string {
  if (n == null) return '—'
  return formatKcPresne(n)
}

function val(v: string | null | undefined): string {
  return v ?? '—'
}

export function generateSodHtml(d: SodDocData): string {
  const pdp = isPdp(d.typ)
  const zaloha = seZalohou(d.typ)

  const dphText = pdp
    ? `<p>Tato smlouva podléhá režimu přenesení daňové povinnosti dle § 92a zákona č. 235/2004 Sb. o DPH. DPH přiznává a odvádí objednatel jako plátce DPH.</p>`
    : `<p>DPH ${d.dphSazba} % bude účtována dle platné legislativy.</p>`

  const zalohaSection = zaloha ? `
  <div class="section">
    <h2>Článek V. — Záloha</h2>
    <p>5.1. Objednatel se zavazuje uhradit zálohu na cenu díla ve výši <strong>${fmtKc(d.zalohaKc)}</strong> (kategorie: ${val(d.zalohaKategorie)}).</p>
    <p>5.2. Záloha je splatná do <strong>${d.zalohaSplatnost ?? 14} dnů</strong> od podpisu této smlouvy.</p>
    <p>5.3. Záloha bude zohledněna při konečném vyúčtování díla.</p>
  </div>` : ''

  const artNums = zaloha
    ? { odp: 'VI', zav: 'VII' }
    : { odp: 'V', zav: 'VI' }

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    @page { size: A4; margin: 20mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 10pt; color: #1a1a2e; margin: 0; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1A2744; }
    .title-block { text-align: center; margin: 24px 0 20px; }
    .title-block h1 { font-size: 16pt; font-weight: 800; color: #1A2744; margin: 0 0 4px; }
    .title-block .subtitle { font-size: 10pt; color: #6b7280; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .party-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
    .party-box h3 { font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin: 0 0 6px; font-weight: 700; }
    .party-box p { margin: 2px 0; font-size: 9.5pt; }
    .party-box .name { font-size: 11pt; font-weight: 700; color: #1A2744; margin-bottom: 4px; }
    .section { margin-bottom: 18px; }
    h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #1A2744; margin: 0 0 8px; padding-bottom: 3px; border-bottom: 1.5px solid #FFC93C; }
    p { margin: 4px 0; font-size: 10pt; }
    .row { display: flex; gap: 8px; margin: 3px 0; }
    .row .lbl { font-weight: 600; min-width: 180px; color: #374151; }
    .price-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .price-table td { padding: 5px 8px; border: 1px solid #e5e7eb; font-size: 10pt; }
    .price-table .total { background: #FFC93C; font-weight: 700; font-size: 11pt; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; }
    .sig-box { border-top: 1.5px solid #374151; padding-top: 6px; }
    .sig-box p { margin: 2px 0; font-size: 9pt; color: #374151; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 4px; display: flex; justify-content: space-between; }
    .badge { display: inline-block; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; padding: 2px 8px; font-size: 8pt; font-weight: 600; color: #374151; }
  </style>
</head>
<body>
  <!-- ZÁHLAVÍ -->
  <div class="page-header">
    <div>
      <p style="font-size:14pt;font-weight:800;color:#1A2744;margin:0;">${val(d.org.nazev)}</p>
      ${d.org.sidlo ? `<p style="font-size:8.5pt;color:#6b7280;margin:2px 0 0;">${d.org.sidlo}</p>` : ''}
      ${d.org.ico ? `<p style="font-size:8.5pt;color:#6b7280;margin:1px 0 0;">IČO: ${d.org.ico}${d.org.dic ? ` · DIČ: ${d.org.dic}` : ''}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <p style="font-size:8.5pt;color:#6b7280;margin:0;">Smlouva č.</p>
      <p style="font-family:monospace;font-size:15pt;font-weight:800;color:#1A2744;margin:2px 0 0;">${d.cislo}</p>
      <p style="font-size:8.5pt;color:#6b7280;margin:2px 0 0;">${d.datum}</p>
      <span class="badge">${TYP_LABELS[d.typ]}</span>
    </div>
  </div>

  <!-- NADPIS -->
  <div class="title-block">
    <h1>SMLOUVA O DÍLO</h1>
    <div class="subtitle">uzavřená dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník</div>
  </div>

  <!-- SMLUVNÍ STRANY -->
  <div class="section">
    <h2>Článek I. — Smluvní strany</h2>
    <div class="parties">
      <div class="party-box">
        <h3>Zhotovitel</h3>
        <p class="name">${val(d.org.nazev)}</p>
        ${d.org.sidlo ? `<p>${d.org.sidlo}</p>` : ''}
        ${d.org.ico ? `<p>IČO: ${d.org.ico}</p>` : ''}
        ${d.org.dic ? `<p>DIČ: ${d.org.dic}</p>` : ''}
        ${d.org.email ? `<p>${d.org.email}</p>` : ''}
        ${d.org.telefon ? `<p>${d.org.telefon}</p>` : ''}
      </div>
      <div class="party-box">
        <h3>Objednatel</h3>
        <p class="name">${val(d.klientJmeno)}</p>
        ${d.klientAdresa ? `<p>${d.klientAdresa}</p>` : ''}
        ${d.klientEmail ? `<p>${d.klientEmail}</p>` : ''}
        ${d.klientTelefon ? `<p>${d.klientTelefon}</p>` : ''}
        ${d.klientIco ? `<p>IČO: ${d.klientIco}</p>` : ''}
        ${d.klientDic ? `<p>DIČ: ${d.klientDic}</p>` : ''}
      </div>
    </div>
    ${(d.kontaktniOsoba && d.kontaktniOsoba !== d.klientJmeno) ? `
    <p>1.3. <strong>Kontaktní osoba objednatele:</strong> ${d.kontaktniOsoba}${d.kontaktniTelefon ? `, tel.: ${d.kontaktniTelefon}` : ''}</p>` : ''}
    <p>Zhotovitel a objednatel jsou dále souhrnně označováni jako <strong>„smluvní strany"</strong>.</p>
  </div>

  <!-- PŘEDMĚT DÍLA -->
  <div class="section">
    <h2>Článek II. — Předmět díla</h2>
    <p>2.1. Zhotovitel se zavazuje provést pro objednatele následující dílo:</p>
    <p style="margin:8px 0 8px 16px;font-weight:600;font-size:11pt;color:#1A2744;">${val(d.predmetDila)}</p>
    <p>2.2. Místem plnění je: <strong>${val(d.adresaDila)}</strong></p>
    <p>2.3. Zhotovitel se zavazuje provést dílo řádně, v souladu s platnými technickými normami a pokyny výrobce, a předat jej objednateli bez vad a nedodělků.</p>
  </div>

  <!-- TERMÍN PLNĚNÍ -->
  <div class="section">
    <h2>Článek III. — Termín plnění</h2>
    <div class="row"><span class="lbl">Termín převzetí staveniště:</span><span>${val(d.terminPrevzeti)}</span></div>
    <div class="row"><span class="lbl">Délka realizace:</span><span>${d.pocetDniRealizace != null ? `${d.pocetDniRealizace} pracovních dnů` : '—'}</span></div>
    <div class="row"><span class="lbl">Nejzazší termín změny:</span><span>${val(d.zmenaTerm)}</span></div>
    <p style="margin-top:8px;">3.4. Zhotovitel je oprávněn přerušit provádění díla v případě, že objednatel neposkytne potřebnou součinnost. O dobu přerušení se termín plnění přiměřeně prodlužuje.</p>
  </div>

  <!-- CENA -->
  <div class="section">
    <h2>Článek IV. — Cena díla a platební podmínky</h2>
    <table class="price-table">
      <tr><td>Cena díla bez DPH</td><td style="text-align:right;font-weight:600;">${fmtKc(d.cenaBezDph)}</td></tr>
      ${!pdp ? `<tr><td>DPH ${d.dphSazba} %</td><td style="text-align:right;">${d.cenaBezDph != null && d.cenaSDph != null ? fmtKc(d.cenaSDph - d.cenaBezDph) : '—'}</td></tr>` : ''}
      <tr class="total"><td>${pdp ? 'Celková cena (DPH v režimu PDP)' : 'Celková cena s DPH'}</td><td style="text-align:right;">${fmtKc(d.cenaSDph)}</td></tr>
    </table>
    ${dphText}
    <p>4.2. Cena je splatná na základě daňového dokladu vystaveného po předání díla. Faktura je splatná do 14 dnů od jejího doručení objednateli.</p>
    <p>4.3. V případě prodlení objednatele s úhradou je zhotovitel oprávněn účtovat smluvní pokutu ve výši 0,05 % z dlužné částky za každý den prodlení.</p>
  </div>

  ${zalohaSection}

  <!-- ODPOVĚDNOST A ZÁRUKY -->
  <div class="section">
    <h2>Článek ${artNums.odp}. — Odpovědnost a záruky</h2>
    <p>${artNums.odp}.1. Zhotovitel poskytuje na provedené dílo záruku v délce <strong>24 měsíců</strong> od předání díla objednateli.</p>
    <p>${artNums.odp}.2. Záruční lhůta počíná běžet dnem podpisu předávacího protokolu.</p>
    <p>${artNums.odp}.3. Zhotovitel neodpovídá za škody způsobené nesprávným používáním, nedostatečnou údržbou, nebo zásahy třetích osob.</p>
    <p>${artNums.odp}.4. Reklamace musí být uplatněna písemně bez zbytečného odkladu po zjištění vady.</p>
  </div>

  <!-- ZÁVĚREČNÁ USTANOVENÍ -->
  <div class="section">
    <h2>Článek ${artNums.zav}. — Závěrečná ustanovení</h2>
    <p>${artNums.zav}.1. Tato smlouva se řídí právním řádem České republiky, zejména zákonem č. 89/2012 Sb., občanský zákoník.</p>
    <p>${artNums.zav}.2. Veškeré změny a doplňky této smlouvy musí být provedeny písemným dodatkem podepsaným oběma smluvními stranami.</p>
    <p>${artNums.zav}.3. Smlouva je vyhotovena ve dvou stejnopisech, z nichž každá smluvní strana obdrží jeden.</p>
    <p>${artNums.zav}.4. Smluvní strany prohlašují, že si smlouvu přečetly, porozuměly jejímu obsahu a uzavřely ji svobodně a vážně.</p>
  </div>

  <!-- PODPISY -->
  <div class="section" style="page-break-inside:avoid;margin-top:28px;">
    <h2>Podpisy smluvních stran</h2>
    <p style="margin-bottom:16px;">V _______________________ dne ${d.datum}</p>
    <div class="sig-grid">
      <div class="sig-box">
        <p style="font-weight:700;">${val(d.org.nazev)}</p>
        <p>Zhotovitel</p>
        <p style="margin-top:10px;color:#9ca3af;">podpis + razítko</p>
      </div>
      <div class="sig-box">
        <p style="font-weight:700;">${val(d.klientJmeno)}</p>
        <p>Objednatel</p>
        <p style="margin-top:10px;color:#9ca3af;">podpis</p>
      </div>
    </div>
  </div>

  <!-- PATIČKA -->
  <div class="page-footer">
    <span>${val(d.org.nazev)}${d.org.sidlo ? ` · ${d.org.sidlo}` : ''}${d.org.email ? ` · ${d.org.email}` : ''}</span>
    <span>${d.cislo}</span>
  </div>
</body>
</html>`
}
