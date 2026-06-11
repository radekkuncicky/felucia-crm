import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const NANTO_ORG_ID = 'cmmujqbk70000tsibbgg5i32s'

const HTML_KLIMA = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Cenová nabídka – Klimatizace</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --yellow: #FFC93C;
    --yellow-light: #FFF8E7;
    --gray: #4A4A4A;
    --black: #111111;
    --muted: #6B7280;
    --border: #DDDDDD;
    --bg: #F5F5F5;
    --white: #FFFFFF;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: white;
    color: var(--black);
    font-size: 11px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    max-height: 297mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: avoid; }
  .cover-top-bar { height: 6px; background: var(--yellow); flex-shrink: 0; }
  .cover-body { flex: 1; padding: 44px 52px 36px; display: flex; flex-direction: column; }
  .cover-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; }
  .logo-row { display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 38px; height: 38px; background: var(--yellow); border-radius: 7px; display: flex; align-items: center; justify-content: center; }
  .logo-mark svg { width: 20px; height: 20px; }
  .logo-text { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 700; color: var(--black); letter-spacing: 0.5px; }
  .logo-sub { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-top: 1px; }
  .cover-doc-info { text-align: right; }
  .cdi-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .cdi-val { font-size: 13px; font-weight: 600; color: var(--gray); }
  .cover-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-tag { display: inline-flex; align-items: center; gap: 8px; background: var(--yellow-light); border: 1px solid var(--yellow); border-radius: 20px; padding: 5px 14px; margin-bottom: 24px; width: fit-content; }
  .cover-tag-dot { width: 7px; height: 7px; background: var(--yellow); border-radius: 50%; }
  .cover-tag span { font-size: 10px; font-weight: 600; color: var(--gray); letter-spacing: 1px; text-transform: uppercase; }
  .cover-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 700; color: var(--black); line-height: 1.05; margin-bottom: 10px; }
  .cover-title .accent { color: var(--yellow); }
  .cover-subtitle { font-size: 13px; color: var(--muted); line-height: 1.7; max-width: 360px; margin-bottom: 44px; }
  .cover-client { background: var(--bg); border-radius: 10px; padding: 20px 24px; display: inline-flex; gap: 28px; align-items: center; max-width: 420px; }
  .cc-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
  .cc-name { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 600; color: var(--black); margin-bottom: 3px; }
  .cc-detail { font-size: 10.5px; color: var(--muted); }
  .cc-divider { width: 1px; height: 44px; background: var(--border); }
  .cover-bottom { border-top: 1px solid var(--border); padding: 16px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .cbd-item { }
  .cbd-label { font-size: 9px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 3px; }
  .cbd-val { font-size: 12px; font-weight: 500; color: var(--gray); }
  .cover-bottom-sep { width: 1px; height: 28px; background: var(--border); }
  .inner { flex: 1; padding: 36px 52px 52px; display: flex; flex-direction: column; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 2px solid var(--black); margin-bottom: 28px; flex-shrink: 0; }
  .ph-left { display: flex; align-items: center; gap: 8px; }
  .ph-logo-sm { width: 26px; height: 26px; background: var(--yellow); border-radius: 5px; display: flex; align-items: center; justify-content: center; }
  .ph-logo-sm svg { width: 14px; height: 14px; }
  .ph-company { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: var(--black); }
  .ph-right { text-align: right; }
  .ph-title { font-size: 11px; font-weight: 600; color: var(--gray); }
  .ph-meta { font-size: 10px; color: var(--muted); }
  .section-label { font-size: 9px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  .quote-table thead tr { background: var(--black); }
  .quote-table thead th { padding: 9px 11px; font-family: 'Montserrat', sans-serif; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; color: white; text-align: left; }
  .quote-table thead th.r { text-align: right; }
  .quote-table tbody tr { border-bottom: 1px solid var(--border); }
  .quote-table tbody tr:nth-child(even) { background: #FAFAF8; }
  .quote-table td { padding: 9px 11px; vertical-align: middle; }
  .quote-table td.num { color: var(--muted); font-size: 10px; width: 28px; }
  .quote-table td.name { font-weight: 500; color: var(--black); }
  .quote-table td.r { text-align: right; white-space: nowrap; }
  .quote-table td.total { text-align: right; font-weight: 600; color: var(--black); white-space: nowrap; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 250px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .tot-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 11px; }
  .tot-row:last-child { border-bottom: none; background: var(--yellow); padding: 11px 14px; }
  .tot-label { color: var(--muted); }
  .tot-row:last-child .tot-label { color: var(--black); font-weight: 600; font-size: 12px; }
  .tot-val { font-weight: 600; color: var(--black); }
  .tot-row:last-child .tot-val { font-size: 14px; font-weight: 700; color: var(--black); }
  .notes-box { background: var(--yellow-light); border-left: 3px solid var(--yellow); border-radius: 0 6px 6px 0; padding: 14px 16px; margin-bottom: 16px; font-size: 11px; line-height: 1.7; color: var(--gray); }
  .notes-box .notes-title { font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--gray); margin-bottom: 5px; }
  .validity-row { display: flex; align-items: center; gap: 16px; background: var(--bg); border-radius: 7px; padding: 12px 16px; font-size: 11px; }
  .vr-item { display: flex; align-items: center; gap: 6px; }
  .vr-dot { width: 6px; height: 6px; background: var(--yellow); border-radius: 50%; flex-shrink: 0; }
  .vr-label { color: var(--muted); }
  .vr-val { font-weight: 500; color: var(--black); }
  .vr-sep { width: 1px; height: 14px; background: var(--border); }
  .process-banner { background: var(--black); border-radius: 10px; padding: 24px 28px; margin-bottom: 26px; flex-shrink: 0; }
  .pb-eyebrow { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
  .pb-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 700; color: white; margin-bottom: 6px; }
  .pb-sub { font-size: 11.5px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 420px; }
  .steps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
  .step-card { border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; position: relative; background: white; }
  .step-card.highlight { border-color: var(--yellow); background: var(--yellow-light); }
  .step-num { width: 26px; height: 26px; background: var(--black); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: white; margin-bottom: 9px; }
  .step-card.highlight .step-num { background: var(--yellow); color: var(--black); }
  .step-title { font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 600; color: var(--black); margin-bottom: 5px; }
  .step-desc { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
  .step-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .step-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 9px; color: var(--muted); }
  .step-card.highlight .step-tag { background: white; border-color: var(--yellow); }

  .qa-section { display: flex; align-items: flex-start; gap: 14px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .qa-icon { width: 40px; height: 40px; background: var(--yellow); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--black); }
  .qa-content { flex: 1; min-width: 0; }
  .qa-title { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: var(--black); margin-bottom: 4px; }
  .qa-desc { font-size: 9.5px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
  .qa-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .qa-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 8.5px; font-weight: 500; color: var(--gray); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 3px 7px; }
  .qa-tag svg { flex-shrink: 0; opacity: 0.7; }
  .sig-row { display: flex; gap: 32px; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
  .sig-name { font-size: 12px; font-weight: 500; color: var(--black); margin-bottom: 2px; }
  .sig-role { font-size: 10px; color: var(--muted); margin-bottom: 14px; }
  .sig-line { border-bottom: 1px dashed var(--border); height: 32px; }
  .page-footer { flex-shrink: 0; border-top: 1px solid var(--border); padding: 8px 52px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--muted); background: white; }
  .pf-accent { color: var(--yellow); font-weight: 700; margin-right: 4px; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: white; }
    .page { width: 210mm; height: 297mm; overflow: hidden; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<!-- PAGE 1: COVER -->
<div class="page">
  <div class="cover-top-bar"></div>
  <div class="cover-body">
    <div class="cover-header">
      <div class="logo-row">
        <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg></div>
        <div>
          <div class="logo-text">NANTO</div>
          <div class="logo-sub">s.r.o.</div>
        </div>
      </div>
      <div class="cover-doc-info">
        <div class="cdi-label">Číslo nabídky</div>
        <div class="cdi-val">{{nabidka_kod}}</div>
      </div>
    </div>
    <div class="cover-hero">
      <div class="cover-tag">
        <span class="cover-tag-dot"></span>
        <span>Klimatizace</span>
      </div>
      <div class="cover-title">Cenová<br>nabídka &amp;<br><span class="accent">návrh</span></div>
      <div class="cover-subtitle">Přinášíme vám efektivní řešení klimatizace šité na míru vašemu prostoru. Naším cílem je váš komfort v létě i v zimě — tichý, spolehlivý a úsporný provoz.</div>
      <div class="cover-client">
        <div>
          <div class="cc-label">Připraveno pro</div>
          <div class="cc-name">{{klient_jmeno}}</div>
          <div class="cc-detail">{{klient_email}}</div>
        </div>
        <div class="cc-divider"></div>
        <div>
          <div class="cc-label">Místo instalace</div>
          <div class="cc-name" style="font-size:13px;">{{klient_adresa}}</div>
          <div class="cc-detail">{{klient_telefon}}</div>
        </div>
      </div>
    </div>
    <div class="cover-bottom">
      <div class="cbd-item">
        <div class="cbd-label">Datum nabídky</div>
        <div class="cbd-val">{{datum_vystaveni}}</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Platnost</div>
        <div class="cbd-val">30 dní</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Zpracoval</div>
        <div class="cbd-val">NANTO s.r.o.</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Kontakt</div>
        <div class="cbd-val">{{firma_telefon}}</div>
      </div>
    </div>
  </div>
</div>
<!-- PAGE 2: NABÍDKA -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Cenová nabídka — Klimatizace</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="section-label">Položky nabídky</div>
    <table class="quote-table">
      <thead>
        <tr>
          <th style="width:28px;">#</th>
          <th>Popis produktu / služby</th>
          <th class="r" style="width:38px;">Ks</th>
          <th class="r" style="width:90px;">Cena / MJ</th>
          <th class="r" style="width:90px;">Celkem</th>
        </tr>
      </thead>
      <tbody>
        {{#polozky}}
        <tr>
          <td class="num">{{polozka_poradi}}</td>
          <td class="name">{{polozka_nazev}}</td>
          <td class="r">{{polozka_mnozstvi}}</td>
          <td class="r">{{polozka_cena_kus}}</td>
          <td class="total">{{polozka_celkem}}</td>
        </tr>
        {{/polozky}}
      </tbody>
    </table>
    <div class="totals-wrap">
      <div class="totals-box">
        <div class="tot-row"><span class="tot-label">Celkem bez DPH</span><span class="tot-val">{{cena_bez_dph}}</span></div>
        <div class="tot-row"><span class="tot-label">DPH {{dph_sazba}} %</span><span class="tot-val">{{dph_castka}}</span></div>
        <div class="tot-row"><span class="tot-label">Celkem s DPH</span><span class="tot-val">{{cena_s_dph}}</span></div>
      </div>
    </div>
    <div class="validity-row">
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost nabídky:</span><span class="vr-val">30 dní od {{datum_vystaveni}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost do:</span><span class="vr-val">{{datum_platnosti}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Obchodník:</span><span class="vr-val">{{obchodnik_jmeno}}</span></div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 2 / 3</span>
  </div>
</div>
<!-- PAGE 3: PROCES -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Jak postupujeme</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="process-banner">
      <div class="pb-eyebrow">Náš proces</div>
      <div class="pb-title">Od nabídky k funkční klimatizaci</div>
      <div class="pb-sub">Každou instalaci klimatizace bereme jako partnerský projekt. Provázíme vás od první konzultace až po předání — přehledně, bez překvapení.</div>
    </div>
    <div class="steps-grid">
      <div class="step-card highlight">
        <div class="step-num">1</div>
        <div class="step-title">Konzultace a návrh řešení</div>
        <div class="step-desc">Bezplatná konzultace, posouzení prostor a návrh optimálního řešení klimatizace. Detailní cenová nabídka s technickým popisem a výběrem jednotek.</div>
        <div class="step-tags"><span class="step-tag">Zdarma</span><span class="step-tag">Do 48 hodin</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-title">Smlouva a záloha</div>
        <div class="step-desc">Po odsouhlasení nabídky podepíšeme smlouvu o dílo. Záloha zajistí objednání materiálu a rezervaci termínu montáže.</div>
        <div class="step-tags"><span class="step-tag">Smlouva o dílo</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-title">Příprava a materiál</div>
        <div class="step-desc">Objednání klimatizačních jednotek a veškerého materiálu. Koordinujeme dodávky a informujeme vás o potřebné připravenosti prostoru.</div>
        <div class="step-tags"><span class="step-tag">1–2 týdny</span><span class="step-tag">Příprava prostoru</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">4</div>
        <div class="step-title">Montáž jednotek</div>
        <div class="step-desc">Instalace vnitřní i venkovní jednotky, vedení chladivového potrubí a kabeláže. Práce probíhají čistě, dle dohodnutého harmonogramu.</div>
        <div class="step-tags"><span class="step-tag">1 den</span></div>
      </div>
      <div class="step-card highlight">
        <div class="step-num">5</div>
        <div class="step-title">Zprovoznění a nastavení</div>
        <div class="step-desc">Napuštění chladivem, elektrické zapojení a kompletní zprovoznění. Nastavení na optimální parametry a testování funkčnosti.</div>
        <div class="step-tags"><span class="step-tag">Testování</span><span class="step-tag">Nastavení</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">6</div>
        <div class="step-title">Předání a zaškolení</div>
        <div class="step-desc">Podpis předávacího protokolu, předání dokumentace a záručních listů. Zaškolení na ovládání klimatizace a doporučení provozu.</div>
        <div class="step-tags"><span class="step-tag">Protokol</span><span class="step-tag">Dokumentace</span><span class="step-tag">Záruka</span></div>
      </div>
    </div>
    <div class="qa-section">
      <div class="qa-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
        </svg>
      </div>
      <div class="qa-content">
        <div class="qa-title">Máte otázky? Váš obchodní zástupce je tu pro vás.</div>
        <div class="qa-desc">Každá instalace je jiná — a my to víme. Rádi s vámi probereme možná rizika, alternativní řešení, způsoby financování nebo jednoduše to, co vás zajímá. Bez tlaku, bez zbytečných řečí.</div>
        <div class="qa-tags">
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Možná rizika a jak jim předejít</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Alternativy a srovnání</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Způsoby financování</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dotace NZÚ</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Harmonogram a termíny</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Cokoli dalšího</span>
        </div>
      </div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 3 / 3</span>
  </div>
</div>
</body>
</html>`

const HTML_TEPELKO = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Cenová nabídka – Tepelné čerpadlo</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --yellow: #FFC93C;
    --yellow-light: #FFF8E7;
    --gray: #4A4A4A;
    --black: #111111;
    --muted: #6B7280;
    --border: #DDDDDD;
    --bg: #F5F5F5;
    --white: #FFFFFF;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: white;
    color: var(--black);
    font-size: 11px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    max-height: 297mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: avoid; }
  .cover-top-bar { height: 6px; background: var(--yellow); flex-shrink: 0; }
  .cover-body { flex: 1; padding: 44px 52px 36px; display: flex; flex-direction: column; }
  .cover-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; }
  .logo-row { display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 38px; height: 38px; background: var(--yellow); border-radius: 7px; display: flex; align-items: center; justify-content: center; }
  .logo-mark svg { width: 20px; height: 20px; }
  .logo-text { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 700; color: var(--black); letter-spacing: 0.5px; }
  .logo-sub { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-top: 1px; }
  .cover-doc-info { text-align: right; }
  .cdi-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .cdi-val { font-size: 13px; font-weight: 600; color: var(--gray); }
  .cover-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-tag { display: inline-flex; align-items: center; gap: 8px; background: var(--yellow-light); border: 1px solid var(--yellow); border-radius: 20px; padding: 5px 14px; margin-bottom: 24px; width: fit-content; }
  .cover-tag-dot { width: 7px; height: 7px; background: var(--yellow); border-radius: 50%; }
  .cover-tag span { font-size: 10px; font-weight: 600; color: var(--gray); letter-spacing: 1px; text-transform: uppercase; }
  .cover-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 700; color: var(--black); line-height: 1.05; margin-bottom: 10px; }
  .cover-title .accent { color: var(--yellow); }
  .cover-subtitle { font-size: 13px; color: var(--muted); line-height: 1.7; max-width: 360px; margin-bottom: 44px; }
  .cover-client { background: var(--bg); border-radius: 10px; padding: 20px 24px; display: inline-flex; gap: 28px; align-items: center; max-width: 420px; }
  .cc-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
  .cc-name { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 600; color: var(--black); margin-bottom: 3px; }
  .cc-detail { font-size: 10.5px; color: var(--muted); }
  .cc-divider { width: 1px; height: 44px; background: var(--border); }
  .cover-bottom { border-top: 1px solid var(--border); padding: 16px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .cbd-item { }
  .cbd-label { font-size: 9px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 3px; }
  .cbd-val { font-size: 12px; font-weight: 500; color: var(--gray); }
  .cover-bottom-sep { width: 1px; height: 28px; background: var(--border); }
  .inner { flex: 1; padding: 36px 52px 52px; display: flex; flex-direction: column; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 2px solid var(--black); margin-bottom: 28px; flex-shrink: 0; }
  .ph-left { display: flex; align-items: center; gap: 8px; }
  .ph-logo-sm { width: 26px; height: 26px; background: var(--yellow); border-radius: 5px; display: flex; align-items: center; justify-content: center; }
  .ph-logo-sm svg { width: 14px; height: 14px; }
  .ph-company { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: var(--black); }
  .ph-right { text-align: right; }
  .ph-title { font-size: 11px; font-weight: 600; color: var(--gray); }
  .ph-meta { font-size: 10px; color: var(--muted); }
  .section-label { font-size: 9px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  .quote-table thead tr { background: var(--black); }
  .quote-table thead th { padding: 9px 11px; font-family: 'Montserrat', sans-serif; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; color: white; text-align: left; }
  .quote-table thead th.r { text-align: right; }
  .quote-table tbody tr { border-bottom: 1px solid var(--border); }
  .quote-table tbody tr:nth-child(even) { background: #FAFAF8; }
  .quote-table td { padding: 9px 11px; vertical-align: middle; }
  .quote-table td.num { color: var(--muted); font-size: 10px; width: 28px; }
  .quote-table td.name { font-weight: 500; color: var(--black); }
  .quote-table td.r { text-align: right; white-space: nowrap; }
  .quote-table td.total { text-align: right; font-weight: 600; color: var(--black); white-space: nowrap; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 250px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .tot-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 11px; }
  .tot-row:last-child { border-bottom: none; background: var(--yellow); padding: 11px 14px; }
  .tot-label { color: var(--muted); }
  .tot-row:last-child .tot-label { color: var(--black); font-weight: 600; font-size: 12px; }
  .tot-val { font-weight: 600; color: var(--black); }
  .tot-row:last-child .tot-val { font-size: 14px; font-weight: 700; color: var(--black); }
  .notes-box { background: var(--yellow-light); border-left: 3px solid var(--yellow); border-radius: 0 6px 6px 0; padding: 14px 16px; margin-bottom: 16px; font-size: 11px; line-height: 1.7; color: var(--gray); }
  .notes-box .notes-title { font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--gray); margin-bottom: 5px; }
  .validity-row { display: flex; align-items: center; gap: 16px; background: var(--bg); border-radius: 7px; padding: 12px 16px; font-size: 11px; }
  .vr-item { display: flex; align-items: center; gap: 6px; }
  .vr-dot { width: 6px; height: 6px; background: var(--yellow); border-radius: 50%; flex-shrink: 0; }
  .vr-label { color: var(--muted); }
  .vr-val { font-weight: 500; color: var(--black); }
  .vr-sep { width: 1px; height: 14px; background: var(--border); }
  .process-banner { background: var(--black); border-radius: 10px; padding: 24px 28px; margin-bottom: 26px; flex-shrink: 0; }
  .pb-eyebrow { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
  .pb-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 700; color: white; margin-bottom: 6px; }
  .pb-sub { font-size: 11.5px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 420px; }
  .steps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
  .step-card { border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; position: relative; background: white; }
  .step-card.highlight { border-color: var(--yellow); background: var(--yellow-light); }
  .step-num { width: 26px; height: 26px; background: var(--black); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: white; margin-bottom: 9px; }
  .step-card.highlight .step-num { background: var(--yellow); color: var(--black); }
  .step-title { font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 600; color: var(--black); margin-bottom: 5px; }
  .step-desc { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
  .step-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .step-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 9px; color: var(--muted); }
  .step-card.highlight .step-tag { background: white; border-color: var(--yellow); }

  .qa-section { display: flex; align-items: flex-start; gap: 14px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .qa-icon { width: 40px; height: 40px; background: var(--yellow); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--black); }
  .qa-content { flex: 1; min-width: 0; }
  .qa-title { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: var(--black); margin-bottom: 4px; }
  .qa-desc { font-size: 9.5px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
  .qa-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .qa-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 8.5px; font-weight: 500; color: var(--gray); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 3px 7px; }
  .qa-tag svg { flex-shrink: 0; opacity: 0.7; }
  .sig-row { display: flex; gap: 32px; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
  .sig-name { font-size: 12px; font-weight: 500; color: var(--black); margin-bottom: 2px; }
  .sig-role { font-size: 10px; color: var(--muted); margin-bottom: 14px; }
  .sig-line { border-bottom: 1px dashed var(--border); height: 32px; }
  .page-footer { flex-shrink: 0; border-top: 1px solid var(--border); padding: 8px 52px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--muted); background: white; }
  .pf-accent { color: var(--yellow); font-weight: 700; margin-right: 4px; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: white; }
    .page { width: 210mm; height: 297mm; overflow: hidden; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<!-- PAGE 1: COVER -->
<div class="page">
  <div class="cover-top-bar"></div>
  <div class="cover-body">
    <div class="cover-header">
      <div class="logo-row">
        <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg></div>
        <div>
          <div class="logo-text">NANTO</div>
          <div class="logo-sub">s.r.o.</div>
        </div>
      </div>
      <div class="cover-doc-info">
        <div class="cdi-label">Číslo nabídky</div>
        <div class="cdi-val">{{nabidka_kod}}</div>
      </div>
    </div>
    <div class="cover-hero">
      <div class="cover-tag">
        <span class="cover-tag-dot"></span>
        <span>Tepelné čerpadlo</span>
      </div>
      <div class="cover-title">Cenová<br>nabídka &amp;<br><span class="accent">návrh</span></div>
      <div class="cover-subtitle">Přinášíme vám nejen cenovou nabídku, ale komplexní návrh efektivního vytápění šitého na míru vašemu domu. Naším cílem je váš komfort a dlouhodobá úspora.</div>
      <div class="cover-client">
        <div>
          <div class="cc-label">Připraveno pro</div>
          <div class="cc-name">{{klient_jmeno}}</div>
          <div class="cc-detail">{{klient_email}}</div>
        </div>
        <div class="cc-divider"></div>
        <div>
          <div class="cc-label">Místo instalace</div>
          <div class="cc-name" style="font-size:13px;">{{klient_adresa}}</div>
          <div class="cc-detail">{{klient_telefon}}</div>
        </div>
      </div>
    </div>
    <div class="cover-bottom">
      <div class="cbd-item">
        <div class="cbd-label">Datum nabídky</div>
        <div class="cbd-val">{{datum_vystaveni}}</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Platnost</div>
        <div class="cbd-val">30 dní</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Zpracoval</div>
        <div class="cbd-val">NANTO s.r.o.</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Kontakt</div>
        <div class="cbd-val">{{firma_telefon}}</div>
      </div>
    </div>
  </div>
</div>
<!-- PAGE 2: NABÍDKA -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Cenová nabídka — Tepelné čerpadlo</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="section-label">Položky nabídky</div>
    <table class="quote-table">
      <thead>
        <tr>
          <th style="width:28px;">#</th>
          <th>Popis produktu / služby</th>
          <th class="r" style="width:38px;">Ks</th>
          <th class="r" style="width:90px;">Cena / MJ</th>
          <th class="r" style="width:90px;">Celkem</th>
        </tr>
      </thead>
      <tbody>
        {{#polozky}}
        <tr>
          <td class="num">{{polozka_poradi}}</td>
          <td class="name">{{polozka_nazev}}</td>
          <td class="r">{{polozka_mnozstvi}}</td>
          <td class="r">{{polozka_cena_kus}}</td>
          <td class="total">{{polozka_celkem}}</td>
        </tr>
        {{/polozky}}
      </tbody>
    </table>
    <div class="totals-wrap">
      <div class="totals-box">
        <div class="tot-row"><span class="tot-label">Celkem bez DPH</span><span class="tot-val">{{cena_bez_dph}}</span></div>
        <div class="tot-row"><span class="tot-label">DPH {{dph_sazba}} %</span><span class="tot-val">{{dph_castka}}</span></div>
        <div class="tot-row"><span class="tot-label">Celkem s DPH</span><span class="tot-val">{{cena_s_dph}}</span></div>
      </div>
    </div>
    <div class="validity-row">
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost nabídky:</span><span class="vr-val">30 dní od {{datum_vystaveni}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost do:</span><span class="vr-val">{{datum_platnosti}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Obchodník:</span><span class="vr-val">{{obchodnik_jmeno}}</span></div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 2 / 3</span>
  </div>
</div>
<!-- PAGE 3: PROCES -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Jak postupujeme</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="process-banner">
      <div class="pb-eyebrow">Náš proces</div>
      <div class="pb-title">Od nabídky k funkčnímu systému</div>
      <div class="pb-sub">Každou instalaci tepelného čerpadla bereme jako partnerský projekt. Provázíme vás od první konzultace až po předání — přehledně, bez překvapení.</div>
    </div>
    <div class="steps-grid">
      <div class="step-card highlight">
        <div class="step-num">1</div>
        <div class="step-title">Konzultace a návrh řešení</div>
        <div class="step-desc">Bezplatná konzultace, posouzení tepelných ztrát a návrh optimálního tepelného čerpadla. Detailní cenová nabídka s technickým popisem.</div>
        <div class="step-tags"><span class="step-tag">Zdarma</span><span class="step-tag">Do 48 hodin</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-title">Smlouva a záloha</div>
        <div class="step-desc">Po odsouhlasení nabídky podepíšeme smlouvu o dílo. Záloha zajistí objednání materiálu a rezervaci termínu montáže.</div>
        <div class="step-tags"><span class="step-tag">Smlouva o dílo</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-title">Příprava a materiál</div>
        <div class="step-desc">Objednání tepelného čerpadla, zásobníku a veškerého materiálu. Koordinujeme dodávky a informujeme vás o potřebné stavební připravenosti.</div>
        <div class="step-tags"><span class="step-tag">1–3 týdny</span><span class="step-tag">Stavební příprava</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">4</div>
        <div class="step-title">Montáž — 1. etapa</div>
        <div class="step-desc">Instalace chladivového potrubí, kabeláže a prostupů stěnami. Práce probíhají dle dohodnutého harmonogramu, čistě a bez zbytečného rušení.</div>
        <div class="step-tags"><span class="step-tag">1–2 dny</span></div>
      </div>
      <div class="step-card highlight">
        <div class="step-num">5</div>
        <div class="step-title">Instalace a zprovoznění</div>
        <div class="step-desc">Osazení venkovní i vnitřní jednotky, elektrické zapojení, napuštění okruhu a kompletní zprovoznění na optimálních parametrech.</div>
        <div class="step-tags"><span class="step-tag">Testování</span><span class="step-tag">Nastavení</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">6</div>
        <div class="step-title">Předání a zaškolení</div>
        <div class="step-desc">Podpis předávacího protokolu, předání veškeré dokumentace. Podrobné zaškolení na ovládání systému. Dostupni i po předání.</div>
        <div class="step-tags"><span class="step-tag">Protokol</span><span class="step-tag">Dokumentace</span><span class="step-tag">Záruka</span></div>
      </div>
    </div>
    <div class="qa-section">
      <div class="qa-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
        </svg>
      </div>
      <div class="qa-content">
        <div class="qa-title">Máte otázky? Váš obchodní zástupce je tu pro vás.</div>
        <div class="qa-desc">Každá instalace je jiná — a my to víme. Rádi s vámi probereme možná rizika, alternativní řešení, způsoby financování nebo jednoduše to, co vás zajímá. Bez tlaku, bez zbytečných řečí.</div>
        <div class="qa-tags">
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Možná rizika a jak jim předejít</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Alternativy a srovnání</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Způsoby financování</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dotace NZÚ</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Harmonogram a termíny</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Cokoli dalšího</span>
        </div>
      </div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 3 / 3</span>
  </div>
</div>
</body>
</html>`

const HTML_PODLAHOVKA = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Cenová nabídka – Podlahové vytápění</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --yellow: #FFC93C;
    --yellow-light: #FFF8E7;
    --gray: #4A4A4A;
    --black: #111111;
    --muted: #6B7280;
    --border: #DDDDDD;
    --bg: #F5F5F5;
    --white: #FFFFFF;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: white;
    color: var(--black);
    font-size: 11px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    max-height: 297mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: avoid; }
  .cover-top-bar { height: 6px; background: var(--yellow); flex-shrink: 0; }
  .cover-body { flex: 1; padding: 44px 52px 36px; display: flex; flex-direction: column; }
  .cover-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; }
  .logo-row { display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 38px; height: 38px; background: var(--yellow); border-radius: 7px; display: flex; align-items: center; justify-content: center; }
  .logo-mark svg { width: 20px; height: 20px; }
  .logo-text { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 700; color: var(--black); letter-spacing: 0.5px; }
  .logo-sub { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-top: 1px; }
  .cover-doc-info { text-align: right; }
  .cdi-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .cdi-val { font-size: 13px; font-weight: 600; color: var(--gray); }
  .cover-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-tag { display: inline-flex; align-items: center; gap: 8px; background: var(--yellow-light); border: 1px solid var(--yellow); border-radius: 20px; padding: 5px 14px; margin-bottom: 24px; width: fit-content; }
  .cover-tag-dot { width: 7px; height: 7px; background: var(--yellow); border-radius: 50%; }
  .cover-tag span { font-size: 10px; font-weight: 600; color: var(--gray); letter-spacing: 1px; text-transform: uppercase; }
  .cover-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 700; color: var(--black); line-height: 1.05; margin-bottom: 10px; }
  .cover-title .accent { color: var(--yellow); }
  .cover-subtitle { font-size: 13px; color: var(--muted); line-height: 1.7; max-width: 360px; margin-bottom: 44px; }
  .cover-client { background: var(--bg); border-radius: 10px; padding: 20px 24px; display: inline-flex; gap: 28px; align-items: center; max-width: 420px; }
  .cc-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
  .cc-name { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 600; color: var(--black); margin-bottom: 3px; }
  .cc-detail { font-size: 10.5px; color: var(--muted); }
  .cc-divider { width: 1px; height: 44px; background: var(--border); }
  .cover-bottom { border-top: 1px solid var(--border); padding: 16px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .cbd-item { }
  .cbd-label { font-size: 9px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 3px; }
  .cbd-val { font-size: 12px; font-weight: 500; color: var(--gray); }
  .cover-bottom-sep { width: 1px; height: 28px; background: var(--border); }
  .inner { flex: 1; padding: 36px 52px 52px; display: flex; flex-direction: column; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 2px solid var(--black); margin-bottom: 28px; flex-shrink: 0; }
  .ph-left { display: flex; align-items: center; gap: 8px; }
  .ph-logo-sm { width: 26px; height: 26px; background: var(--yellow); border-radius: 5px; display: flex; align-items: center; justify-content: center; }
  .ph-logo-sm svg { width: 14px; height: 14px; }
  .ph-company { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: var(--black); }
  .ph-right { text-align: right; }
  .ph-title { font-size: 11px; font-weight: 600; color: var(--gray); }
  .ph-meta { font-size: 10px; color: var(--muted); }
  .section-label { font-size: 9px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  .quote-table thead tr { background: var(--black); }
  .quote-table thead th { padding: 9px 11px; font-family: 'Montserrat', sans-serif; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; color: white; text-align: left; }
  .quote-table thead th.r { text-align: right; }
  .quote-table tbody tr { border-bottom: 1px solid var(--border); }
  .quote-table tbody tr:nth-child(even) { background: #FAFAF8; }
  .quote-table td { padding: 9px 11px; vertical-align: middle; }
  .quote-table td.num { color: var(--muted); font-size: 10px; width: 28px; }
  .quote-table td.name { font-weight: 500; color: var(--black); }
  .quote-table td.r { text-align: right; white-space: nowrap; }
  .quote-table td.total { text-align: right; font-weight: 600; color: var(--black); white-space: nowrap; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 250px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .tot-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 11px; }
  .tot-row:last-child { border-bottom: none; background: var(--yellow); padding: 11px 14px; }
  .tot-label { color: var(--muted); }
  .tot-row:last-child .tot-label { color: var(--black); font-weight: 600; font-size: 12px; }
  .tot-val { font-weight: 600; color: var(--black); }
  .tot-row:last-child .tot-val { font-size: 14px; font-weight: 700; color: var(--black); }
  .notes-box { background: var(--yellow-light); border-left: 3px solid var(--yellow); border-radius: 0 6px 6px 0; padding: 14px 16px; margin-bottom: 16px; font-size: 11px; line-height: 1.7; color: var(--gray); }
  .notes-box .notes-title { font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--gray); margin-bottom: 5px; }
  .validity-row { display: flex; align-items: center; gap: 16px; background: var(--bg); border-radius: 7px; padding: 12px 16px; font-size: 11px; }
  .vr-item { display: flex; align-items: center; gap: 6px; }
  .vr-dot { width: 6px; height: 6px; background: var(--yellow); border-radius: 50%; flex-shrink: 0; }
  .vr-label { color: var(--muted); }
  .vr-val { font-weight: 500; color: var(--black); }
  .vr-sep { width: 1px; height: 14px; background: var(--border); }
  .process-banner { background: var(--black); border-radius: 10px; padding: 24px 28px; margin-bottom: 26px; flex-shrink: 0; }
  .pb-eyebrow { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
  .pb-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 700; color: white; margin-bottom: 6px; }
  .pb-sub { font-size: 11.5px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 420px; }
  .steps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
  .step-card { border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; position: relative; background: white; }
  .step-card.highlight { border-color: var(--yellow); background: var(--yellow-light); }
  .step-num { width: 26px; height: 26px; background: var(--black); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: white; margin-bottom: 9px; }
  .step-card.highlight .step-num { background: var(--yellow); color: var(--black); }
  .step-title { font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 600; color: var(--black); margin-bottom: 5px; }
  .step-desc { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
  .step-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .step-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 9px; color: var(--muted); }
  .step-card.highlight .step-tag { background: white; border-color: var(--yellow); }

  .qa-section { display: flex; align-items: flex-start; gap: 14px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .qa-icon { width: 40px; height: 40px; background: var(--yellow); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--black); }
  .qa-content { flex: 1; min-width: 0; }
  .qa-title { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: var(--black); margin-bottom: 4px; }
  .qa-desc { font-size: 9.5px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
  .qa-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .qa-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 8.5px; font-weight: 500; color: var(--gray); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 3px 7px; }
  .qa-tag svg { flex-shrink: 0; opacity: 0.7; }
  .sig-row { display: flex; gap: 32px; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
  .sig-name { font-size: 12px; font-weight: 500; color: var(--black); margin-bottom: 2px; }
  .sig-role { font-size: 10px; color: var(--muted); margin-bottom: 14px; }
  .sig-line { border-bottom: 1px dashed var(--border); height: 32px; }
  .page-footer { flex-shrink: 0; border-top: 1px solid var(--border); padding: 8px 52px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--muted); background: white; }
  .pf-accent { color: var(--yellow); font-weight: 700; margin-right: 4px; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: white; }
    .page { width: 210mm; height: 297mm; overflow: hidden; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<!-- PAGE 1: COVER -->
<div class="page">
  <div class="cover-top-bar"></div>
  <div class="cover-body">
    <div class="cover-header">
      <div class="logo-row">
        <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg></div>
        <div>
          <div class="logo-text">NANTO</div>
          <div class="logo-sub">s.r.o.</div>
        </div>
      </div>
      <div class="cover-doc-info">
        <div class="cdi-label">Číslo nabídky</div>
        <div class="cdi-val">{{nabidka_kod}}</div>
      </div>
    </div>
    <div class="cover-hero">
      <div class="cover-tag">
        <span class="cover-tag-dot"></span>
        <span>Podlahové vytápění</span>
      </div>
      <div class="cover-title">Cenová<br>nabídka &amp;<br><span class="accent">návrh</span></div>
      <div class="cover-subtitle">Přinášíme vám rovnoměrné a úsporné vytápění podlahovými smyčkami — příjemné teplo od země, tichý provoz a ideální spolupráce s tepelným čerpadlem.</div>
      <div class="cover-client">
        <div>
          <div class="cc-label">Připraveno pro</div>
          <div class="cc-name">{{klient_jmeno}}</div>
          <div class="cc-detail">{{klient_email}}</div>
        </div>
        <div class="cc-divider"></div>
        <div>
          <div class="cc-label">Místo instalace</div>
          <div class="cc-name" style="font-size:13px;">{{klient_adresa}}</div>
          <div class="cc-detail">{{klient_telefon}}</div>
        </div>
      </div>
    </div>
    <div class="cover-bottom">
      <div class="cbd-item">
        <div class="cbd-label">Datum nabídky</div>
        <div class="cbd-val">{{datum_vystaveni}}</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Platnost</div>
        <div class="cbd-val">30 dní</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Zpracoval</div>
        <div class="cbd-val">NANTO s.r.o.</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Kontakt</div>
        <div class="cbd-val">{{firma_telefon}}</div>
      </div>
    </div>
  </div>
</div>
<!-- PAGE 2: NABÍDKA -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Cenová nabídka — Podlahové vytápění</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="section-label">Položky nabídky</div>
    <table class="quote-table">
      <thead>
        <tr>
          <th style="width:28px;">#</th>
          <th>Popis produktu / služby</th>
          <th class="r" style="width:38px;">Ks</th>
          <th class="r" style="width:90px;">Cena / MJ</th>
          <th class="r" style="width:90px;">Celkem</th>
        </tr>
      </thead>
      <tbody>
        {{#polozky}}
        <tr>
          <td class="num">{{polozka_poradi}}</td>
          <td class="name">{{polozka_nazev}}</td>
          <td class="r">{{polozka_mnozstvi}}</td>
          <td class="r">{{polozka_cena_kus}}</td>
          <td class="total">{{polozka_celkem}}</td>
        </tr>
        {{/polozky}}
      </tbody>
    </table>
    <div class="totals-wrap">
      <div class="totals-box">
        <div class="tot-row"><span class="tot-label">Celkem bez DPH</span><span class="tot-val">{{cena_bez_dph}}</span></div>
        <div class="tot-row"><span class="tot-label">DPH {{dph_sazba}} %</span><span class="tot-val">{{dph_castka}}</span></div>
        <div class="tot-row"><span class="tot-label">Celkem s DPH</span><span class="tot-val">{{cena_s_dph}}</span></div>
      </div>
    </div>
    <div class="validity-row">
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost nabídky:</span><span class="vr-val">30 dní od {{datum_vystaveni}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost do:</span><span class="vr-val">{{datum_platnosti}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Obchodník:</span><span class="vr-val">{{obchodnik_jmeno}}</span></div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 2 / 3</span>
  </div>
</div>
<!-- PAGE 3: PROCES -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Jak postupujeme</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="process-banner">
      <div class="pb-eyebrow">Náš proces</div>
      <div class="pb-title">Od nabídky k teplé podlaze</div>
      <div class="pb-sub">Každou instalaci podlahového vytápění bereme jako partnerský projekt. Provázíme vás od první konzultace až po předání — přehledně, bez překvapení.</div>
    </div>
    <div class="steps-grid">
      <div class="step-card highlight">
        <div class="step-num">1</div>
        <div class="step-title">Konzultace a návrh řešení</div>
        <div class="step-desc">Bezplatná konzultace, posouzení objektu a návrh optimálního systému podlahového vytápění. Hydraulický výpočet okruhů a detailní nabídka.</div>
        <div class="step-tags"><span class="step-tag">Zdarma</span><span class="step-tag">Do 48 hodin</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-title">Smlouva a záloha</div>
        <div class="step-desc">Po odsouhlasení nabídky podepíšeme smlouvu o dílo. Záloha zajistí objednání materiálu a koordinaci s vaší stavbou.</div>
        <div class="step-tags"><span class="step-tag">Smlouva o dílo</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-title">Příprava a materiál</div>
        <div class="step-desc">Objednání potrubí, rozdělovačů a veškerého materiálu. Koordinujeme dodávky tak, aby vše bylo připraveno k pokládce v čas.</div>
        <div class="step-tags"><span class="step-tag">1–2 týdny</span><span class="step-tag">Koordinace stavby</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">4</div>
        <div class="step-title">Pokládka podlahového vytápění</div>
        <div class="step-desc">Instalace systémové fólie, pokládka trubek dle projektu, osazení rozdělovačů a propojení okruhů. Práce probíhají čistě a přesně.</div>
        <div class="step-tags"><span class="step-tag">2–5 dní</span></div>
      </div>
      <div class="step-card highlight">
        <div class="step-num">5</div>
        <div class="step-title">Zapojení a tlaková zkouška</div>
        <div class="step-desc">Elektroinstalace, propojení s topným zdrojem, provedení tlakové zkoušky systému a kontrola těsnosti všech okruhů.</div>
        <div class="step-tags"><span class="step-tag">Tlaková zkouška</span><span class="step-tag">Uvedení do provozu</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">6</div>
        <div class="step-title">Předání a zaškolení</div>
        <div class="step-desc">Podpis předávacího protokolu, předání dokumentace. Zaškolení na obsluhu regulace a doporučení pro správné zahřívání podlahy.</div>
        <div class="step-tags"><span class="step-tag">Protokol</span><span class="step-tag">Dokumentace</span><span class="step-tag">Záruka</span></div>
      </div>
    </div>
    <div class="qa-section">
      <div class="qa-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
        </svg>
      </div>
      <div class="qa-content">
        <div class="qa-title">Máte otázky? Váš obchodní zástupce je tu pro vás.</div>
        <div class="qa-desc">Každá instalace je jiná — a my to víme. Rádi s vámi probereme možná rizika, alternativní řešení, způsoby financování nebo jednoduše to, co vás zajímá. Bez tlaku, bez zbytečných řečí.</div>
        <div class="qa-tags">
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Možná rizika a jak jim předejít</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Alternativy a srovnání</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Způsoby financování</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dotace NZÚ</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Harmonogram a termíny</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Cokoli dalšího</span>
        </div>
      </div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 3 / 3</span>
  </div>
</div>
</body>
</html>`

const HTML_REKUPKA = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Cenová nabídka – Rekuperace</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --yellow: #FFC93C;
    --yellow-light: #FFF8E7;
    --gray: #4A4A4A;
    --black: #111111;
    --muted: #6B7280;
    --border: #DDDDDD;
    --bg: #F5F5F5;
    --white: #FFFFFF;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: white;
    color: var(--black);
    font-size: 11px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    max-height: 297mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: avoid; }
  .cover-top-bar { height: 6px; background: var(--yellow); flex-shrink: 0; }
  .cover-body { flex: 1; padding: 44px 52px 36px; display: flex; flex-direction: column; }
  .cover-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; }
  .logo-row { display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 38px; height: 38px; background: var(--yellow); border-radius: 7px; display: flex; align-items: center; justify-content: center; }
  .logo-mark svg { width: 20px; height: 20px; }
  .logo-text { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 700; color: var(--black); letter-spacing: 0.5px; }
  .logo-sub { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-top: 1px; }
  .cover-doc-info { text-align: right; }
  .cdi-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .cdi-val { font-size: 13px; font-weight: 600; color: var(--gray); }
  .cover-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-tag { display: inline-flex; align-items: center; gap: 8px; background: var(--yellow-light); border: 1px solid var(--yellow); border-radius: 20px; padding: 5px 14px; margin-bottom: 24px; width: fit-content; }
  .cover-tag-dot { width: 7px; height: 7px; background: var(--yellow); border-radius: 50%; }
  .cover-tag span { font-size: 10px; font-weight: 600; color: var(--gray); letter-spacing: 1px; text-transform: uppercase; }
  .cover-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 700; color: var(--black); line-height: 1.05; margin-bottom: 10px; }
  .cover-title .accent { color: var(--yellow); }
  .cover-subtitle { font-size: 13px; color: var(--muted); line-height: 1.7; max-width: 360px; margin-bottom: 44px; }
  .cover-client { background: var(--bg); border-radius: 10px; padding: 20px 24px; display: inline-flex; gap: 28px; align-items: center; max-width: 420px; }
  .cc-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
  .cc-name { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 600; color: var(--black); margin-bottom: 3px; }
  .cc-detail { font-size: 10.5px; color: var(--muted); }
  .cc-divider { width: 1px; height: 44px; background: var(--border); }
  .cover-bottom { border-top: 1px solid var(--border); padding: 16px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .cbd-item { }
  .cbd-label { font-size: 9px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 3px; }
  .cbd-val { font-size: 12px; font-weight: 500; color: var(--gray); }
  .cover-bottom-sep { width: 1px; height: 28px; background: var(--border); }
  .inner { flex: 1; padding: 36px 52px 52px; display: flex; flex-direction: column; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 2px solid var(--black); margin-bottom: 28px; flex-shrink: 0; }
  .ph-left { display: flex; align-items: center; gap: 8px; }
  .ph-logo-sm { width: 26px; height: 26px; background: var(--yellow); border-radius: 5px; display: flex; align-items: center; justify-content: center; }
  .ph-logo-sm svg { width: 14px; height: 14px; }
  .ph-company { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: var(--black); }
  .ph-right { text-align: right; }
  .ph-title { font-size: 11px; font-weight: 600; color: var(--gray); }
  .ph-meta { font-size: 10px; color: var(--muted); }
  .section-label { font-size: 9px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  .quote-table thead tr { background: var(--black); }
  .quote-table thead th { padding: 9px 11px; font-family: 'Montserrat', sans-serif; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; color: white; text-align: left; }
  .quote-table thead th.r { text-align: right; }
  .quote-table tbody tr { border-bottom: 1px solid var(--border); }
  .quote-table tbody tr:nth-child(even) { background: #FAFAF8; }
  .quote-table td { padding: 9px 11px; vertical-align: middle; }
  .quote-table td.num { color: var(--muted); font-size: 10px; width: 28px; }
  .quote-table td.name { font-weight: 500; color: var(--black); }
  .quote-table td.r { text-align: right; white-space: nowrap; }
  .quote-table td.total { text-align: right; font-weight: 600; color: var(--black); white-space: nowrap; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 250px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .tot-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 11px; }
  .tot-row:last-child { border-bottom: none; background: var(--yellow); padding: 11px 14px; }
  .tot-label { color: var(--muted); }
  .tot-row:last-child .tot-label { color: var(--black); font-weight: 600; font-size: 12px; }
  .tot-val { font-weight: 600; color: var(--black); }
  .tot-row:last-child .tot-val { font-size: 14px; font-weight: 700; color: var(--black); }
  .notes-box { background: var(--yellow-light); border-left: 3px solid var(--yellow); border-radius: 0 6px 6px 0; padding: 14px 16px; margin-bottom: 16px; font-size: 11px; line-height: 1.7; color: var(--gray); }
  .notes-box .notes-title { font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--gray); margin-bottom: 5px; }
  .validity-row { display: flex; align-items: center; gap: 16px; background: var(--bg); border-radius: 7px; padding: 12px 16px; font-size: 11px; }
  .vr-item { display: flex; align-items: center; gap: 6px; }
  .vr-dot { width: 6px; height: 6px; background: var(--yellow); border-radius: 50%; flex-shrink: 0; }
  .vr-label { color: var(--muted); }
  .vr-val { font-weight: 500; color: var(--black); }
  .vr-sep { width: 1px; height: 14px; background: var(--border); }
  .process-banner { background: var(--black); border-radius: 10px; padding: 24px 28px; margin-bottom: 26px; flex-shrink: 0; }
  .pb-eyebrow { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
  .pb-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 700; color: white; margin-bottom: 6px; }
  .pb-sub { font-size: 11.5px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 420px; }
  .steps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
  .step-card { border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; position: relative; background: white; }
  .step-card.highlight { border-color: var(--yellow); background: var(--yellow-light); }
  .step-num { width: 26px; height: 26px; background: var(--black); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: white; margin-bottom: 9px; }
  .step-card.highlight .step-num { background: var(--yellow); color: var(--black); }
  .step-title { font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 600; color: var(--black); margin-bottom: 5px; }
  .step-desc { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
  .step-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .step-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 9px; color: var(--muted); }
  .step-card.highlight .step-tag { background: white; border-color: var(--yellow); }

  .qa-section { display: flex; align-items: flex-start; gap: 14px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .qa-icon { width: 40px; height: 40px; background: var(--yellow); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--black); }
  .qa-content { flex: 1; min-width: 0; }
  .qa-title { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: var(--black); margin-bottom: 4px; }
  .qa-desc { font-size: 9.5px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
  .qa-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .qa-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 8.5px; font-weight: 500; color: var(--gray); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 3px 7px; }
  .qa-tag svg { flex-shrink: 0; opacity: 0.7; }
  .sig-row { display: flex; gap: 32px; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
  .sig-name { font-size: 12px; font-weight: 500; color: var(--black); margin-bottom: 2px; }
  .sig-role { font-size: 10px; color: var(--muted); margin-bottom: 14px; }
  .sig-line { border-bottom: 1px dashed var(--border); height: 32px; }
  .page-footer { flex-shrink: 0; border-top: 1px solid var(--border); padding: 8px 52px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--muted); background: white; }
  .pf-accent { color: var(--yellow); font-weight: 700; margin-right: 4px; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: white; }
    .page { width: 210mm; height: 297mm; overflow: hidden; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<!-- PAGE 1: COVER -->
<div class="page">
  <div class="cover-top-bar"></div>
  <div class="cover-body">
    <div class="cover-header">
      <div class="logo-row">
        <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg></div>
        <div>
          <div class="logo-text">NANTO</div>
          <div class="logo-sub">s.r.o.</div>
        </div>
      </div>
      <div class="cover-doc-info">
        <div class="cdi-label">Číslo nabídky</div>
        <div class="cdi-val">{{nabidka_kod}}</div>
      </div>
    </div>
    <div class="cover-hero">
      <div class="cover-tag">
        <span class="cover-tag-dot"></span>
        <span>Rekuperace</span>
      </div>
      <div class="cover-title">Cenová<br>nabídka &amp;<br><span class="accent">návrh</span></div>
      <div class="cover-subtitle">Přinášíme vám řešení řízeného větrání s rekuperací tepla — čerstvý vzduch bez tepelných ztrát. Zdravé klima ve vašem domě po celý rok.</div>
      <div class="cover-client">
        <div>
          <div class="cc-label">Připraveno pro</div>
          <div class="cc-name">{{klient_jmeno}}</div>
          <div class="cc-detail">{{klient_email}}</div>
        </div>
        <div class="cc-divider"></div>
        <div>
          <div class="cc-label">Místo instalace</div>
          <div class="cc-name" style="font-size:13px;">{{klient_adresa}}</div>
          <div class="cc-detail">{{klient_telefon}}</div>
        </div>
      </div>
    </div>
    <div class="cover-bottom">
      <div class="cbd-item">
        <div class="cbd-label">Datum nabídky</div>
        <div class="cbd-val">{{datum_vystaveni}}</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Platnost</div>
        <div class="cbd-val">30 dní</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Zpracoval</div>
        <div class="cbd-val">NANTO s.r.o.</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Kontakt</div>
        <div class="cbd-val">{{firma_telefon}}</div>
      </div>
    </div>
  </div>
</div>
<!-- PAGE 2: NABÍDKA -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Cenová nabídka — Rekuperace</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="section-label">Položky nabídky</div>
    <table class="quote-table">
      <thead>
        <tr>
          <th style="width:28px;">#</th>
          <th>Popis produktu / služby</th>
          <th class="r" style="width:38px;">Ks</th>
          <th class="r" style="width:90px;">Cena / MJ</th>
          <th class="r" style="width:90px;">Celkem</th>
        </tr>
      </thead>
      <tbody>
        {{#polozky}}
        <tr>
          <td class="num">{{polozka_poradi}}</td>
          <td class="name">{{polozka_nazev}}</td>
          <td class="r">{{polozka_mnozstvi}}</td>
          <td class="r">{{polozka_cena_kus}}</td>
          <td class="total">{{polozka_celkem}}</td>
        </tr>
        {{/polozky}}
      </tbody>
    </table>
    <div class="totals-wrap">
      <div class="totals-box">
        <div class="tot-row"><span class="tot-label">Celkem bez DPH</span><span class="tot-val">{{cena_bez_dph}}</span></div>
        <div class="tot-row"><span class="tot-label">DPH {{dph_sazba}} %</span><span class="tot-val">{{dph_castka}}</span></div>
        <div class="tot-row"><span class="tot-label">Celkem s DPH</span><span class="tot-val">{{cena_s_dph}}</span></div>
      </div>
    </div>
    <div class="validity-row">
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost nabídky:</span><span class="vr-val">30 dní od {{datum_vystaveni}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost do:</span><span class="vr-val">{{datum_platnosti}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Obchodník:</span><span class="vr-val">{{obchodnik_jmeno}}</span></div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 2 / 3</span>
  </div>
</div>
<!-- PAGE 3: PROCES -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Jak postupujeme</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="process-banner">
      <div class="pb-eyebrow">Náš proces</div>
      <div class="pb-title">Od nabídky k čistému vzduchu</div>
      <div class="pb-sub">Každou instalaci rekuperace bereme jako partnerský projekt. Provázíme vás od první konzultace až po předání — přehledně, bez překvapení.</div>
    </div>
    <div class="steps-grid">
      <div class="step-card highlight">
        <div class="step-num">1</div>
        <div class="step-title">Konzultace a návrh řešení</div>
        <div class="step-desc">Bezplatná konzultace, posouzení objektu a návrh optimálního systému rekuperace. Výpočet průtoků vzduchu a detailní cenová nabídka.</div>
        <div class="step-tags"><span class="step-tag">Zdarma</span><span class="step-tag">Do 48 hodin</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-title">Smlouva a záloha</div>
        <div class="step-desc">Po odsouhlasení nabídky podepíšeme smlouvu o dílo. Záloha zajistí objednání rekuperační jednotky a materiálu.</div>
        <div class="step-tags"><span class="step-tag">Smlouva o dílo</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-title">Příprava a materiál</div>
        <div class="step-desc">Objednání rekuperační jednotky a veškerého materiálu — potrubí, distribuční elementy, regulace. Koordinace s vaší stavbou.</div>
        <div class="step-tags"><span class="step-tag">1–3 týdny</span><span class="step-tag">Koordinace stavby</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">4</div>
        <div class="step-title">Montáž potrubního rozvodu</div>
        <div class="step-desc">Instalace vzduchovodů, průchody stropy a stěnami, osazení distribučních elementů. Práce probíhají čistě dle harmonogramu.</div>
        <div class="step-tags"><span class="step-tag">2–4 dny</span></div>
      </div>
      <div class="step-card highlight">
        <div class="step-num">5</div>
        <div class="step-title">Instalace jednotky a zprovoznění</div>
        <div class="step-desc">Osazení rekuperační jednotky, napojení na potrubní rozvod, elektrické zapojení a vyvážení systému na projektované průtoky.</div>
        <div class="step-tags"><span class="step-tag">Vyvážení</span><span class="step-tag">Testování</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">6</div>
        <div class="step-title">Předání a zaškolení</div>
        <div class="step-desc">Podpis předávacího protokolu, předání dokumentace a záručních listů. Zaškolení na obsluhu a doporučení pro výměnu filtrů.</div>
        <div class="step-tags"><span class="step-tag">Protokol</span><span class="step-tag">Dokumentace</span><span class="step-tag">Servis filtrů</span></div>
      </div>
    </div>
    <div class="qa-section">
      <div class="qa-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
        </svg>
      </div>
      <div class="qa-content">
        <div class="qa-title">Máte otázky? Váš obchodní zástupce je tu pro vás.</div>
        <div class="qa-desc">Každá instalace je jiná — a my to víme. Rádi s vámi probereme možná rizika, alternativní řešení, způsoby financování nebo jednoduše to, co vás zajímá. Bez tlaku, bez zbytečných řečí.</div>
        <div class="qa-tags">
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Možná rizika a jak jim předejít</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Alternativy a srovnání</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Způsoby financování</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dotace NZÚ</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Harmonogram a termíny</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Cokoli dalšího</span>
        </div>
      </div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 3 / 3</span>
  </div>
</div>
</body>
</html>`

const HTML_VZDUCHOTECHNIKA = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Cenová nabídka – Vzduchotechnika</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --yellow: #FFC93C;
    --yellow-light: #FFF8E7;
    --gray: #4A4A4A;
    --black: #111111;
    --muted: #6B7280;
    --border: #DDDDDD;
    --bg: #F5F5F5;
    --white: #FFFFFF;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: white;
    color: var(--black);
    font-size: 11px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    max-height: 297mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: avoid; }
  .cover-top-bar { height: 6px; background: var(--yellow); flex-shrink: 0; }
  .cover-body { flex: 1; padding: 44px 52px 36px; display: flex; flex-direction: column; }
  .cover-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; }
  .logo-row { display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 38px; height: 38px; background: var(--yellow); border-radius: 7px; display: flex; align-items: center; justify-content: center; }
  .logo-mark svg { width: 20px; height: 20px; }
  .logo-text { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 700; color: var(--black); letter-spacing: 0.5px; }
  .logo-sub { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-top: 1px; }
  .cover-doc-info { text-align: right; }
  .cdi-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .cdi-val { font-size: 13px; font-weight: 600; color: var(--gray); }
  .cover-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-tag { display: inline-flex; align-items: center; gap: 8px; background: var(--yellow-light); border: 1px solid var(--yellow); border-radius: 20px; padding: 5px 14px; margin-bottom: 24px; width: fit-content; }
  .cover-tag-dot { width: 7px; height: 7px; background: var(--yellow); border-radius: 50%; }
  .cover-tag span { font-size: 10px; font-weight: 600; color: var(--gray); letter-spacing: 1px; text-transform: uppercase; }
  .cover-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 700; color: var(--black); line-height: 1.05; margin-bottom: 10px; }
  .cover-title .accent { color: var(--yellow); }
  .cover-subtitle { font-size: 13px; color: var(--muted); line-height: 1.7; max-width: 360px; margin-bottom: 44px; }
  .cover-client { background: var(--bg); border-radius: 10px; padding: 20px 24px; display: inline-flex; gap: 28px; align-items: center; max-width: 420px; }
  .cc-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
  .cc-name { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 600; color: var(--black); margin-bottom: 3px; }
  .cc-detail { font-size: 10.5px; color: var(--muted); }
  .cc-divider { width: 1px; height: 44px; background: var(--border); }
  .cover-bottom { border-top: 1px solid var(--border); padding: 16px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .cbd-item { }
  .cbd-label { font-size: 9px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 3px; }
  .cbd-val { font-size: 12px; font-weight: 500; color: var(--gray); }
  .cover-bottom-sep { width: 1px; height: 28px; background: var(--border); }
  .inner { flex: 1; padding: 36px 52px 52px; display: flex; flex-direction: column; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 2px solid var(--black); margin-bottom: 28px; flex-shrink: 0; }
  .ph-left { display: flex; align-items: center; gap: 8px; }
  .ph-logo-sm { width: 26px; height: 26px; background: var(--yellow); border-radius: 5px; display: flex; align-items: center; justify-content: center; }
  .ph-logo-sm svg { width: 14px; height: 14px; }
  .ph-company { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: var(--black); }
  .ph-right { text-align: right; }
  .ph-title { font-size: 11px; font-weight: 600; color: var(--gray); }
  .ph-meta { font-size: 10px; color: var(--muted); }
  .section-label { font-size: 9px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  .quote-table thead tr { background: var(--black); }
  .quote-table thead th { padding: 9px 11px; font-family: 'Montserrat', sans-serif; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; color: white; text-align: left; }
  .quote-table thead th.r { text-align: right; }
  .quote-table tbody tr { border-bottom: 1px solid var(--border); }
  .quote-table tbody tr:nth-child(even) { background: #FAFAF8; }
  .quote-table td { padding: 9px 11px; vertical-align: middle; }
  .quote-table td.num { color: var(--muted); font-size: 10px; width: 28px; }
  .quote-table td.name { font-weight: 500; color: var(--black); }
  .quote-table td.r { text-align: right; white-space: nowrap; }
  .quote-table td.total { text-align: right; font-weight: 600; color: var(--black); white-space: nowrap; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 250px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .tot-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 11px; }
  .tot-row:last-child { border-bottom: none; background: var(--yellow); padding: 11px 14px; }
  .tot-label { color: var(--muted); }
  .tot-row:last-child .tot-label { color: var(--black); font-weight: 600; font-size: 12px; }
  .tot-val { font-weight: 600; color: var(--black); }
  .tot-row:last-child .tot-val { font-size: 14px; font-weight: 700; color: var(--black); }
  .notes-box { background: var(--yellow-light); border-left: 3px solid var(--yellow); border-radius: 0 6px 6px 0; padding: 14px 16px; margin-bottom: 16px; font-size: 11px; line-height: 1.7; color: var(--gray); }
  .notes-box .notes-title { font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--gray); margin-bottom: 5px; }
  .validity-row { display: flex; align-items: center; gap: 16px; background: var(--bg); border-radius: 7px; padding: 12px 16px; font-size: 11px; }
  .vr-item { display: flex; align-items: center; gap: 6px; }
  .vr-dot { width: 6px; height: 6px; background: var(--yellow); border-radius: 50%; flex-shrink: 0; }
  .vr-label { color: var(--muted); }
  .vr-val { font-weight: 500; color: var(--black); }
  .vr-sep { width: 1px; height: 14px; background: var(--border); }
  .process-banner { background: var(--black); border-radius: 10px; padding: 24px 28px; margin-bottom: 26px; flex-shrink: 0; }
  .pb-eyebrow { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
  .pb-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 700; color: white; margin-bottom: 6px; }
  .pb-sub { font-size: 11.5px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 420px; }
  .steps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
  .step-card { border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; position: relative; background: white; }
  .step-card.highlight { border-color: var(--yellow); background: var(--yellow-light); }
  .step-num { width: 26px; height: 26px; background: var(--black); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: white; margin-bottom: 9px; }
  .step-card.highlight .step-num { background: var(--yellow); color: var(--black); }
  .step-title { font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 600; color: var(--black); margin-bottom: 5px; }
  .step-desc { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
  .step-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .step-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 9px; color: var(--muted); }
  .step-card.highlight .step-tag { background: white; border-color: var(--yellow); }

  .qa-section { display: flex; align-items: flex-start; gap: 14px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .qa-icon { width: 40px; height: 40px; background: var(--yellow); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--black); }
  .qa-content { flex: 1; min-width: 0; }
  .qa-title { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: var(--black); margin-bottom: 4px; }
  .qa-desc { font-size: 9.5px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
  .qa-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .qa-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 8.5px; font-weight: 500; color: var(--gray); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 3px 7px; }
  .qa-tag svg { flex-shrink: 0; opacity: 0.7; }
  .sig-row { display: flex; gap: 32px; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
  .sig-name { font-size: 12px; font-weight: 500; color: var(--black); margin-bottom: 2px; }
  .sig-role { font-size: 10px; color: var(--muted); margin-bottom: 14px; }
  .sig-line { border-bottom: 1px dashed var(--border); height: 32px; }
  .page-footer { flex-shrink: 0; border-top: 1px solid var(--border); padding: 8px 52px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--muted); background: white; }
  .pf-accent { color: var(--yellow); font-weight: 700; margin-right: 4px; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: white; }
    .page { width: 210mm; height: 297mm; overflow: hidden; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<!-- PAGE 1: COVER -->
<div class="page">
  <div class="cover-top-bar"></div>
  <div class="cover-body">
    <div class="cover-header">
      <div class="logo-row">
        <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg></div>
        <div>
          <div class="logo-text">NANTO</div>
          <div class="logo-sub">s.r.o.</div>
        </div>
      </div>
      <div class="cover-doc-info">
        <div class="cdi-label">Číslo nabídky</div>
        <div class="cdi-val">{{nabidka_kod}}</div>
      </div>
    </div>
    <div class="cover-hero">
      <div class="cover-tag">
        <span class="cover-tag-dot"></span>
        <span>Vzduchotechnika</span>
      </div>
      <div class="cover-title">Cenová<br>nabídka &amp;<br><span class="accent">návrh</span></div>
      <div class="cover-subtitle">Přinášíme vám profesionální řešení vzduchotechniky — řízenou výměnu vzduchu, chlazení nebo vytápění prostorů s důrazem na energetickou efektivitu a spolehlivost.</div>
      <div class="cover-client">
        <div>
          <div class="cc-label">Připraveno pro</div>
          <div class="cc-name">{{klient_jmeno}}</div>
          <div class="cc-detail">{{klient_email}}</div>
        </div>
        <div class="cc-divider"></div>
        <div>
          <div class="cc-label">Místo instalace</div>
          <div class="cc-name" style="font-size:13px;">{{klient_adresa}}</div>
          <div class="cc-detail">{{klient_telefon}}</div>
        </div>
      </div>
    </div>
    <div class="cover-bottom">
      <div class="cbd-item">
        <div class="cbd-label">Datum nabídky</div>
        <div class="cbd-val">{{datum_vystaveni}}</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Platnost</div>
        <div class="cbd-val">30 dní</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Zpracoval</div>
        <div class="cbd-val">NANTO s.r.o.</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Kontakt</div>
        <div class="cbd-val">{{firma_telefon}}</div>
      </div>
    </div>
  </div>
</div>
<!-- PAGE 2: NABÍDKA -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Cenová nabídka — Vzduchotechnika</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="section-label">Položky nabídky</div>
    <table class="quote-table">
      <thead>
        <tr>
          <th style="width:28px;">#</th>
          <th>Popis produktu / služby</th>
          <th class="r" style="width:38px;">Ks</th>
          <th class="r" style="width:90px;">Cena / MJ</th>
          <th class="r" style="width:90px;">Celkem</th>
        </tr>
      </thead>
      <tbody>
        {{#polozky}}
        <tr>
          <td class="num">{{polozka_poradi}}</td>
          <td class="name">{{polozka_nazev}}</td>
          <td class="r">{{polozka_mnozstvi}}</td>
          <td class="r">{{polozka_cena_kus}}</td>
          <td class="total">{{polozka_celkem}}</td>
        </tr>
        {{/polozky}}
      </tbody>
    </table>
    <div class="totals-wrap">
      <div class="totals-box">
        <div class="tot-row"><span class="tot-label">Celkem bez DPH</span><span class="tot-val">{{cena_bez_dph}}</span></div>
        <div class="tot-row"><span class="tot-label">DPH {{dph_sazba}} %</span><span class="tot-val">{{dph_castka}}</span></div>
        <div class="tot-row"><span class="tot-label">Celkem s DPH</span><span class="tot-val">{{cena_s_dph}}</span></div>
      </div>
    </div>
    <div class="validity-row">
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost nabídky:</span><span class="vr-val">30 dní od {{datum_vystaveni}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost do:</span><span class="vr-val">{{datum_platnosti}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Obchodník:</span><span class="vr-val">{{obchodnik_jmeno}}</span></div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 2 / 3</span>
  </div>
</div>
<!-- PAGE 3: PROCES -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Jak postupujeme</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="process-banner">
      <div class="pb-eyebrow">Náš proces</div>
      <div class="pb-title">Od nabídky k funkční vzduchotechnice</div>
      <div class="pb-sub">Každou instalaci VZT bereme jako partnerský projekt. Provázíme vás od první konzultace až po předání — přehledně, bez překvapení.</div>
    </div>
    <div class="steps-grid">
      <div class="step-card highlight">
        <div class="step-num">1</div>
        <div class="step-title">Konzultace a návrh řešení</div>
        <div class="step-desc">Bezplatná konzultace, posouzení objektu a návrh VZT systému. Výpočet průtoků vzduchu, výběr vzduchotechnické jednotky a detailní nabídka.</div>
        <div class="step-tags"><span class="step-tag">Zdarma</span><span class="step-tag">Do 48 hodin</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-title">Smlouva a záloha</div>
        <div class="step-desc">Po odsouhlasení nabídky podepíšeme smlouvu o dílo. Záloha zajistí objednání vzduchotechnické jednotky a materiálu.</div>
        <div class="step-tags"><span class="step-tag">Smlouva o dílo</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-title">Příprava a materiál</div>
        <div class="step-desc">Objednání VZT jednotky a potrubního systému. Koordinace s vaší stavbou — prostupy, stavební výpomoc, elektropříprava.</div>
        <div class="step-tags"><span class="step-tag">2–4 týdny</span><span class="step-tag">Koordinace stavby</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">4</div>
        <div class="step-title">Montáž potrubního rozvodu</div>
        <div class="step-desc">Instalace vzduchovodů, tlumičů hluku, klapek a distribučních elementů. Práce dle projektu, čistě a profesionálně.</div>
        <div class="step-tags"><span class="step-tag">3–7 dní</span></div>
      </div>
      <div class="step-card highlight">
        <div class="step-num">5</div>
        <div class="step-title">Instalace jednotky a zprovoznění</div>
        <div class="step-desc">Osazení vzduchotechnické jednotky, napojení na potrubí, elektrické zapojení, nastavení průtoků a regulace. Vyvážení systému.</div>
        <div class="step-tags"><span class="step-tag">Vyvážení</span><span class="step-tag">Testování</span><span class="step-tag">Regulace</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">6</div>
        <div class="step-title">Předání a zaškolení</div>
        <div class="step-desc">Podpis předávacího protokolu, předání veškeré dokumentace a revizních zpráv. Zaškolení obsluhy na provoz a údržbu systému.</div>
        <div class="step-tags"><span class="step-tag">Protokol</span><span class="step-tag">Dokumentace</span><span class="step-tag">Servis</span></div>
      </div>
    </div>
    <div class="qa-section">
      <div class="qa-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
        </svg>
      </div>
      <div class="qa-content">
        <div class="qa-title">Máte otázky? Váš obchodní zástupce je tu pro vás.</div>
        <div class="qa-desc">Každá instalace je jiná — a my to víme. Rádi s vámi probereme možná rizika, alternativní řešení, způsoby financování nebo jednoduše to, co vás zajímá. Bez tlaku, bez zbytečných řečí.</div>
        <div class="qa-tags">
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Možná rizika a jak jim předejít</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Alternativy a srovnání</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Způsoby financování</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dotace NZÚ</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Harmonogram a termíny</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Cokoli dalšího</span>
        </div>
      </div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 3 / 3</span>
  </div>
</div>
</body>
</html>`

const HTML_JINE = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Cenová nabídka</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --yellow: #FFC93C;
    --yellow-light: #FFF8E7;
    --gray: #4A4A4A;
    --black: #111111;
    --muted: #6B7280;
    --border: #DDDDDD;
    --bg: #F5F5F5;
    --white: #FFFFFF;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: white;
    color: var(--black);
    font-size: 11px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    max-height: 297mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: avoid; }
  .cover-top-bar { height: 6px; background: var(--yellow); flex-shrink: 0; }
  .cover-body { flex: 1; padding: 44px 52px 36px; display: flex; flex-direction: column; }
  .cover-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; }
  .logo-row { display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 38px; height: 38px; background: var(--yellow); border-radius: 7px; display: flex; align-items: center; justify-content: center; }
  .logo-mark svg { width: 20px; height: 20px; }
  .logo-text { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 700; color: var(--black); letter-spacing: 0.5px; }
  .logo-sub { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-top: 1px; }
  .cover-doc-info { text-align: right; }
  .cdi-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .cdi-val { font-size: 13px; font-weight: 600; color: var(--gray); }
  .cover-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-tag { display: inline-flex; align-items: center; gap: 8px; background: var(--yellow-light); border: 1px solid var(--yellow); border-radius: 20px; padding: 5px 14px; margin-bottom: 24px; width: fit-content; }
  .cover-tag-dot { width: 7px; height: 7px; background: var(--yellow); border-radius: 50%; }
  .cover-tag span { font-size: 10px; font-weight: 600; color: var(--gray); letter-spacing: 1px; text-transform: uppercase; }
  .cover-title { font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 700; color: var(--black); line-height: 1.05; margin-bottom: 10px; }
  .cover-title .accent { color: var(--yellow); }
  .cover-subtitle { font-size: 13px; color: var(--muted); line-height: 1.7; max-width: 360px; margin-bottom: 44px; }
  .cover-client { background: var(--bg); border-radius: 10px; padding: 20px 24px; display: inline-flex; gap: 28px; align-items: center; max-width: 420px; }
  .cc-label { font-size: 9px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
  .cc-name { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 600; color: var(--black); margin-bottom: 3px; }
  .cc-detail { font-size: 10.5px; color: var(--muted); }
  .cc-divider { width: 1px; height: 44px; background: var(--border); }
  .cover-bottom { border-top: 1px solid var(--border); padding: 16px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .cbd-item { }
  .cbd-label { font-size: 9px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 3px; }
  .cbd-val { font-size: 12px; font-weight: 500; color: var(--gray); }
  .cover-bottom-sep { width: 1px; height: 28px; background: var(--border); }
  .inner { flex: 1; padding: 36px 52px 52px; display: flex; flex-direction: column; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 2px solid var(--black); margin-bottom: 28px; flex-shrink: 0; }
  .ph-left { display: flex; align-items: center; gap: 8px; }
  .ph-logo-sm { width: 26px; height: 26px; background: var(--yellow); border-radius: 5px; display: flex; align-items: center; justify-content: center; }
  .ph-logo-sm svg { width: 14px; height: 14px; }
  .ph-company { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: var(--black); }
  .ph-right { text-align: right; }
  .ph-title { font-size: 11px; font-weight: 600; color: var(--gray); }
  .ph-meta { font-size: 10px; color: var(--muted); }
  .section-label { font-size: 9px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  .quote-table thead tr { background: var(--black); }
  .quote-table thead th { padding: 9px 11px; font-family: 'Montserrat', sans-serif; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; color: white; text-align: left; }
  .quote-table thead th.r { text-align: right; }
  .quote-table tbody tr { border-bottom: 1px solid var(--border); }
  .quote-table tbody tr:nth-child(even) { background: #FAFAF8; }
  .quote-table td { padding: 9px 11px; vertical-align: middle; }
  .quote-table td.num { color: var(--muted); font-size: 10px; width: 28px; }
  .quote-table td.name { font-weight: 500; color: var(--black); }
  .quote-table td.r { text-align: right; white-space: nowrap; }
  .quote-table td.total { text-align: right; font-weight: 600; color: var(--black); white-space: nowrap; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 250px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .tot-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 11px; }
  .tot-row:last-child { border-bottom: none; background: var(--yellow); padding: 11px 14px; }
  .tot-label { color: var(--muted); }
  .tot-row:last-child .tot-label { color: var(--black); font-weight: 600; font-size: 12px; }
  .tot-val { font-weight: 600; color: var(--black); }
  .tot-row:last-child .tot-val { font-size: 14px; font-weight: 700; color: var(--black); }
  .notes-box { background: var(--yellow-light); border-left: 3px solid var(--yellow); border-radius: 0 6px 6px 0; padding: 14px 16px; margin-bottom: 16px; font-size: 11px; line-height: 1.7; color: var(--gray); }
  .notes-box .notes-title { font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--gray); margin-bottom: 5px; }
  .validity-row { display: flex; align-items: center; gap: 16px; background: var(--bg); border-radius: 7px; padding: 12px 16px; font-size: 11px; }
  .vr-item { display: flex; align-items: center; gap: 6px; }
  .vr-dot { width: 6px; height: 6px; background: var(--yellow); border-radius: 50%; flex-shrink: 0; }
  .vr-label { color: var(--muted); }
  .vr-val { font-weight: 500; color: var(--black); }
  .vr-sep { width: 1px; height: 14px; background: var(--border); }
  .process-banner { background: var(--black); border-radius: 10px; padding: 24px 28px; margin-bottom: 26px; flex-shrink: 0; }
  .pb-eyebrow { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
  .pb-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 700; color: white; margin-bottom: 6px; }
  .pb-sub { font-size: 11.5px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 420px; }
  .steps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
  .step-card { border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; position: relative; background: white; }
  .step-card.highlight { border-color: var(--yellow); background: var(--yellow-light); }
  .step-num { width: 26px; height: 26px; background: var(--black); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: white; margin-bottom: 9px; }
  .step-card.highlight .step-num { background: var(--yellow); color: var(--black); }
  .step-title { font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 600; color: var(--black); margin-bottom: 5px; }
  .step-desc { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
  .step-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .step-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; font-size: 9px; color: var(--muted); }
  .step-card.highlight .step-tag { background: white; border-color: var(--yellow); }

  .qa-section { display: flex; align-items: flex-start; gap: 14px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .qa-icon { width: 40px; height: 40px; background: var(--yellow); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--black); }
  .qa-content { flex: 1; min-width: 0; }
  .qa-title { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: var(--black); margin-bottom: 4px; }
  .qa-desc { font-size: 9.5px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
  .qa-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .qa-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 8.5px; font-weight: 500; color: var(--gray); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 3px 7px; }
  .qa-tag svg { flex-shrink: 0; opacity: 0.7; }
  .sig-row { display: flex; gap: 32px; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
  .sig-name { font-size: 12px; font-weight: 500; color: var(--black); margin-bottom: 2px; }
  .sig-role { font-size: 10px; color: var(--muted); margin-bottom: 14px; }
  .sig-line { border-bottom: 1px dashed var(--border); height: 32px; }
  .page-footer { flex-shrink: 0; border-top: 1px solid var(--border); padding: 8px 52px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--muted); background: white; }
  .pf-accent { color: var(--yellow); font-weight: 700; margin-right: 4px; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: white; }
    .page { width: 210mm; height: 297mm; overflow: hidden; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<!-- PAGE 1: COVER -->
<div class="page">
  <div class="cover-top-bar"></div>
  <div class="cover-body">
    <div class="cover-header">
      <div class="logo-row">
        <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg></div>
        <div>
          <div class="logo-text">NANTO</div>
          <div class="logo-sub">s.r.o.</div>
        </div>
      </div>
      <div class="cover-doc-info">
        <div class="cdi-label">Číslo nabídky</div>
        <div class="cdi-val">{{nabidka_kod}}</div>
      </div>
    </div>
    <div class="cover-hero">
      <div class="cover-tag">
        <span class="cover-tag-dot"></span>
        <span>Technické řešení</span>
      </div>
      <div class="cover-title">Cenová<br>nabídka &amp;<br><span class="accent">návrh</span></div>
      <div class="cover-subtitle">Přinášíme vám řešení šité na míru vašim potřebám. Naším cílem je maximální kvalita provedení a vaše spokojenost — přesně, spolehlivě a na čas.</div>
      <div class="cover-client">
        <div>
          <div class="cc-label">Připraveno pro</div>
          <div class="cc-name">{{klient_jmeno}}</div>
          <div class="cc-detail">{{klient_email}}</div>
        </div>
        <div class="cc-divider"></div>
        <div>
          <div class="cc-label">Místo instalace</div>
          <div class="cc-name" style="font-size:13px;">{{klient_adresa}}</div>
          <div class="cc-detail">{{klient_telefon}}</div>
        </div>
      </div>
    </div>
    <div class="cover-bottom">
      <div class="cbd-item">
        <div class="cbd-label">Datum nabídky</div>
        <div class="cbd-val">{{datum_vystaveni}}</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Platnost</div>
        <div class="cbd-val">30 dní</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Zpracoval</div>
        <div class="cbd-val">NANTO s.r.o.</div>
      </div>
      <div class="cover-bottom-sep"></div>
      <div class="cbd-item">
        <div class="cbd-label">Kontakt</div>
        <div class="cbd-val">{{firma_telefon}}</div>
      </div>
    </div>
  </div>
</div>
<!-- PAGE 2: NABÍDKA -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Cenová nabídka</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="section-label">Položky nabídky</div>
    <table class="quote-table">
      <thead>
        <tr>
          <th style="width:28px;">#</th>
          <th>Popis produktu / služby</th>
          <th class="r" style="width:38px;">Ks</th>
          <th class="r" style="width:90px;">Cena / MJ</th>
          <th class="r" style="width:90px;">Celkem</th>
        </tr>
      </thead>
      <tbody>
        {{#polozky}}
        <tr>
          <td class="num">{{polozka_poradi}}</td>
          <td class="name">{{polozka_nazev}}</td>
          <td class="r">{{polozka_mnozstvi}}</td>
          <td class="r">{{polozka_cena_kus}}</td>
          <td class="total">{{polozka_celkem}}</td>
        </tr>
        {{/polozky}}
      </tbody>
    </table>
    <div class="totals-wrap">
      <div class="totals-box">
        <div class="tot-row"><span class="tot-label">Celkem bez DPH</span><span class="tot-val">{{cena_bez_dph}}</span></div>
        <div class="tot-row"><span class="tot-label">DPH {{dph_sazba}} %</span><span class="tot-val">{{dph_castka}}</span></div>
        <div class="tot-row"><span class="tot-label">Celkem s DPH</span><span class="tot-val">{{cena_s_dph}}</span></div>
      </div>
    </div>
    <div class="validity-row">
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost nabídky:</span><span class="vr-val">30 dní od {{datum_vystaveni}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Platnost do:</span><span class="vr-val">{{datum_platnosti}}</span></div>
      <div class="vr-sep"></div>
      <div class="vr-item"><span class="vr-dot"></span><span class="vr-label">Obchodník:</span><span class="vr-val">{{obchodnik_jmeno}}</span></div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 2 / 3</span>
  </div>
</div>
<!-- PAGE 3: PROCES -->
<div class="page">
  <div class="inner">
      <div class="page-header">
      <div class="ph-left">
        <div class="ph-logo-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="ph-company">NANTO s.r.o.</div>
      </div>
      <div class="ph-right">
        <div class="ph-title">Jak postupujeme</div>
        <div class="ph-meta">{{nabidka_kod}} · {{datum_vystaveni}}</div>
      </div>
    </div>
    <div class="process-banner">
      <div class="pb-eyebrow">Náš proces</div>
      <div class="pb-title">Od nabídky k úspěšné realizaci</div>
      <div class="pb-sub">Každý projekt bereme jako partnerský závazek. Provázíme vás od první konzultace až po předání — přehledně a bez překvapení.</div>
    </div>
    <div class="steps-grid">
      <div class="step-card highlight">
        <div class="step-num">1</div>
        <div class="step-title">Konzultace a návrh řešení</div>
        <div class="step-desc">Bezplatná konzultace, posouzení prostor a návrh optimálního řešení řešení. Detailní cenová nabídka s technickým popisem a výběrem jednotek.</div>
        <div class="step-tags"><span class="step-tag">Zdarma</span><span class="step-tag">Do 48 hodin</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-title">Smlouva a záloha</div>
        <div class="step-desc">Po odsouhlasení nabídky podepíšeme smlouvu o dílo. Záloha zajistí objednání materiálu a rezervaci termínu montáže.</div>
        <div class="step-tags"><span class="step-tag">Smlouva o dílo</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-title">Příprava a materiál</div>
        <div class="step-desc">Objednání technická jednotek a veškerého materiálu. Koordinujeme dodávky a informujeme vás o potřebné připravenosti prostoru.</div>
        <div class="step-tags"><span class="step-tag">1–2 týdny</span><span class="step-tag">Příprava prostoru</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">4</div>
        <div class="step-title">Montáž jednotek</div>
        <div class="step-desc">Instalace vnitřní i venkovní jednotky, vedení chladivového potrubí a kabeláže. Práce probíhají čistě, dle dohodnutého harmonogramu.</div>
        <div class="step-tags"><span class="step-tag">1 den</span></div>
      </div>
      <div class="step-card highlight">
        <div class="step-num">5</div>
        <div class="step-title">Zprovoznění a nastavení</div>
        <div class="step-desc">Napuštění chladivem, elektrické zapojení a kompletní zprovoznění. Nastavení na optimální parametry a testování funkčnosti.</div>
        <div class="step-tags"><span class="step-tag">Testování</span><span class="step-tag">Nastavení</span></div>
      </div>
      <div class="step-card">
        <div class="step-num">6</div>
        <div class="step-title">Předání a zaškolení</div>
        <div class="step-desc">Podpis předávacího protokolu, předání dokumentace a záručních listů. Zaškolení na ovládání řešení a doporučení provozu.</div>
        <div class="step-tags"><span class="step-tag">Protokol</span><span class="step-tag">Dokumentace</span><span class="step-tag">Záruka</span></div>
      </div>
    </div>
    <div class="qa-section">
      <div class="qa-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
        </svg>
      </div>
      <div class="qa-content">
        <div class="qa-title">Máte otázky? Váš obchodní zástupce je tu pro vás.</div>
        <div class="qa-desc">Každá instalace je jiná — a my to víme. Rádi s vámi probereme možná rizika, alternativní řešení, způsoby financování nebo jednoduše to, co vás zajímá. Bez tlaku, bez zbytečných řečí.</div>
        <div class="qa-tags">
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Možná rizika a jak jim předejít</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Alternativy a srovnání</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Způsoby financování</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dotace NZÚ</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Harmonogram a termíny</span>
          <span class="qa-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Cokoli dalšího</span>
        </div>
      </div>
    </div>
  </div>
  <div class="page-footer">
    <span><span class="pf-accent">NANTO</span>s.r.o. · {{firma_adresa}} · {{firma_email}} · IČO: {{firma_ico}}</span>
    <span>Strana 3 / 3</span>
  </div>
</div>
</body>
</html>`

async function main() {
  const updates = [
    { label: 'Klimatizace – NANTO', html: HTML_KLIMA },
    { label: 'Tepelné čerpadlo – NANTO', html: HTML_TEPELKO },
    { label: 'Podlahové vytápění – NANTO', html: HTML_PODLAHOVKA },
    { label: 'Rekuperace – NANTO', html: HTML_REKUPKA },
    { label: 'Vzduchotechnika – NANTO', html: HTML_VZDUCHOTECHNIKA },
    { label: 'Obecná nabídka – NANTO', html: HTML_JINE },
  ]
  for (const u of updates) {
    const t = await prisma.quoteTemplate.findFirst({ where: { orgId: NANTO_ORG_ID, nazev: u.label } })
    if (!t) { console.log(`Not found: ${u.label}`); continue }
    await prisma.quoteTemplateHtml.upsert({
      where: { templateId: t.id },
      create: { templateId: t.id, htmlContent: u.html },
      update: { htmlContent: u.html },
    })
    console.log(`Updated: ${u.label}`)
  }
  console.log('Done!')
}
main().catch(console.error).finally(() => prisma.$disconnect())
