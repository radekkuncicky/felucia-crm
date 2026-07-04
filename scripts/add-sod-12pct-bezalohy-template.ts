import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const NANTO_ORG_ID = 'cmmujqbk70000tsibbgg5i32s'

const HTML_SOD_12PCT_BEZALOHY = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #15151F;
    background: #FFFFFF;
    font-size: 13px;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
  }

  .mono {
    font-family: 'SF Mono', 'SFMono-Regular', ui-monospace, 'Menlo', 'Consolas', monospace;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.2px;
  }

  .page { max-width: 820px; margin: 0 auto; padding: 48px 52px; }

  /* ---------- Topbar ---------- */
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 14px;
    border-bottom: 1px solid #15151F;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-name { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #15151F; }
  .brand-sep { color: #C9C9D2; }
  .brand-doc { font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #757584; }
  .topbar-meta { text-align: right; font-size: 11.5px; color: #757584; line-height: 1.5; }
  .topbar-meta .num { color: #15151F; font-size: 12.5px; font-weight: 700; }

  /* ---------- Title ---------- */
  .title-wrap { margin: 40px 0 10px; }
  .title { font-size: 46px; font-weight: 800; line-height: 0.98; letter-spacing: -2px; color: #15151F; }
  .title-rule { width: 56px; height: 4px; background: #FFC93C; margin: 16px 0 12px; border-radius: 2px; }
  .title-sub { font-size: 12px; color: #757584; }

  .dph-badge {
    display: inline-flex; align-items: center; gap: 7px;
    background: #FFF8E7; border: 1px solid #FFE0A0; border-radius: 4px;
    padding: 4px 11px; margin-top: 10px;
  }
  .dph-badge-dot { width: 7px; height: 7px; background: #FFC93C; border-radius: 50%; flex-shrink: 0; }
  .dph-badge span { font-size: 11px; font-weight: 600; color: #FFC93C; }

  /* ---------- Strany ---------- */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 28px 0 10px; }
  .party {
    border: 1px solid #E6E6EC; border-top: 3px solid #FFC93C;
    border-radius: 5px; padding: 16px 18px;
  }
  .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.8px; color: #FFC93C; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; color: #15151F; margin-bottom: 8px; letter-spacing: -0.3px; }
  .party-row { font-size: 11.5px; color: #3D3D4A; line-height: 1.9; display: flex; gap: 6px; }
  .party-row .k { color: #999AA8; flex-shrink: 0; min-width: 46px; }
  .party-note { font-size: 10px; color: #999AA8; margin-top: 8px; line-height: 1.6; border-top: 1px solid #F0F0F5; padding-top: 7px; }
  .party-note span { color: #FFC93C; font-weight: 700; }
  .ref { font-size: 9px; font-weight: 700; color: #FFC93C; vertical-align: super; line-height: 0; margin-left: 1px; }

  /* ---------- Intro ---------- */
  .intro {
    font-size: 12.5px; color: #757584; text-align: center;
    padding: 14px 0 24px; border-bottom: 1px solid #E6E6EC; margin-bottom: 28px;
    font-style: italic;
  }

  /* ---------- Sekce ---------- */
  .sec { margin-bottom: 26px; }
  .sec-new-page { page-break-before: always; break-before: page; }
  .sec-head {
    display: flex; align-items: baseline; gap: 12px;
    padding-bottom: 8px; margin-bottom: 12px; position: relative;
    page-break-after: avoid; break-after: avoid;
  }
  .sec-head:after { content: ""; position: absolute; left: 0; bottom: 0; width: 100%; height: 1px; background: #E6E6EC; }
  .sec-head:before { content: ""; position: absolute; left: 0; bottom: 0; width: 38px; height: 1px; background: #FFC93C; z-index: 1; }
  .sec-num { font-size: 12.5px; font-weight: 700; color: #FFC93C; min-width: 28px; letter-spacing: 0.3px; }
  .sec-title { font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px; color: #15151F; }

  /* ---------- Odstavce ---------- */
  .art { display: flex; gap: 14px; margin-bottom: 8px; page-break-inside: avoid; }
  .art-num { font-size: 11.5px; font-weight: 700; color: #FFC93C; min-width: 32px; flex-shrink: 0; padding-top: 1px; }
  .art-body { font-size: 12.5px; color: #3D3D4A; line-height: 1.75; flex: 1; }
  .art-body strong { color: #15151F; font-weight: 600; }

  /* subsection */
  .sub { display: flex; gap: 12px; margin: 5px 0 5px 32px; }
  .sub-num { font-size: 11.5px; font-weight: 600; color: #999AA8; min-width: 36px; flex-shrink: 0; padding-top: 1px; }
  .sub-body { font-size: 12.5px; color: #3D3D4A; line-height: 1.75; flex: 1; }
  .sub-body strong { color: #15151F; font-weight: 600; }

  /* ---------- Cena box ---------- */
  .price {
    background: #FFF8E7; border: 1px solid #FFE0A0; border-radius: 6px;
    padding: 18px 22px; margin: 8px 0 10px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .price-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.8px; color: #FFC93C; margin-bottom: 5px; }
  .price-total { font-size: 30px; font-weight: 800; color: #FFC93C; letter-spacing: -1px; line-height: 1; }
  .price-break { text-align: right; font-size: 12px; color: #757584; line-height: 1.85; }
  .price-break .v { color: #15151F; font-weight: 600; }

  /* ---------- Podpisy ---------- */
  .sign-wrap { margin-top: 40px; padding-top: 22px; border-top: 2px solid #15151F; }
  .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; }
  .sign-role { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.8px; color: #FFC93C; margin-bottom: 3px; }
  .sign-who { font-size: 13px; font-weight: 700; color: #15151F; }
  .sign-sub { font-size: 11px; color: #757584; margin-bottom: 50px; margin-top: 2px; }
  .sign-line { border-top: 1px solid #15151F; padding-top: 6px; font-size: 11px; color: #757584; }
  .sign-date { margin-top: 9px; font-size: 11px; color: #999AA8; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 24px 28px; max-width: none; }
    .art, .sub, .party, .price, .sign { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="topbar">
    <div class="brand">
        <span class="brand-name">{{organizace}}</span>
      <span class="brand-sep">/</span>
      <span class="brand-doc">Smlouva o dílo</span>
    </div>
    <div class="topbar-meta">
      <div class="num mono">č. {{cislo_smlouvy}}</div>
      <div class="mono">{{datum}}</div>
    </div>
  </div>

  <div class="title-wrap">
    <div class="title">Smlouva o dílo</div>
    <div class="title-rule"></div>
    <div class="title-sub">dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů</div>
    <div class="dph-badge">
      <div class="dph-badge-dot"></div>
      <span>Snížená sazba DPH {{dph_sazba}} % — stavební práce na bytové výstavbě (§ 48 zák. č. 235/2004 Sb.)</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Objednatel</div>
      <div class="party-name">{{klient_jmeno}}</div>
      <div class="party-row"><span class="k">Sídlo</span>{{adresa_dila}}</div>
      <div class="party-row"><span class="k">Kontakt</span>{{klient_email}}<span class="ref">*</span></div>
      <div class="party-row"><span class="k"></span><span class="mono">{{klient_telefon}}</span><span class="ref">**</span></div>
      <div class="party-row"><span class="k">Zástupce</span>{{kontaktni_osoba}}; tel. <span class="mono">{{kontaktni_telefon}}</span></div>
      <div class="party-note">
        <span>*</span> Na uvedenou e-mailovou adresu budou zasílány smlouvy, dodatky k podpisu, faktury a vyúčtování.<br>
        <span>**</span> Na uvedeném tel. čísle bude provedeno vyzvání k převzetí díla.
      </div>
    </div>
    <div class="party">
      <div class="party-label">Zhotovitel</div>
      <div class="party-name">{{organizace}}</div>
      <div class="party-row"><span class="k">IČ</span><span class="mono">{{org_ico}}</span></div>
      <div class="party-row"><span class="k">Sídlo</span>{{org_sidlo}}</div>
      <div class="party-row"><span class="k">Zastupuje</span>Radek Kunčický, jednatel</div>
      <div class="party-row"><span class="k">Kontakt</span>radek@nanto.cz</div>
      <div class="party-row"><span class="k"></span><span class="mono">+420 724 347 986</span></div>
    </div>
  </div>

  <div class="intro">
    (společně dále též jen „Smluvní strany" nebo jednotlivě jen „Smluvní strana")<br>
    uzavřely níže uvedeného dne, měsíce a roku tuto smlouvu o dílo (dále jen „Smlouva"):
  </div>

  <!-- I. Předmět smlouvy -->
  <div class="sec sec-new-page">
    <div class="sec-head"><span class="sec-num">I.</span><span class="sec-title">Předmět smlouvy, místo plnění</span></div>

    <div class="art">
      <div class="art-num">1.1.</div>
      <div class="art-body">Předmětem této Smlouvy je závazek Zhotovitele provést pro Objednatele dílo na svůj náklad a nebezpečí a dále závazek Objednatele provedené dílo od Zhotovitele převzít a zaplatit za něj Zhotoviteli sjednanou cenu, za podmínek stanovených touto Smlouvou.</div>
    </div>

    <div class="art">
      <div class="art-num">1.2.</div>
      <div class="art-body">Smluvní strany se dohodly, že dílem je:</div>
    </div>
    <div class="sub">
      <div class="sub-num">1.2.1.</div>
      <div class="sub-body"><strong>{{predmet}}</strong> v rozsahu technické specifikace uvedené v Příloze č. 1 této Smlouvy (dále jen „Dílo").</div>
    </div>

    <div class="art">
      <div class="art-num">1.3.</div>
      <div class="art-body">Dílo se považuje za provedené zapojením, uvedením do provozu a předáním Objednateli, popř. jeho zástupci, na základě předávacího protokolu.</div>
    </div>

    <div class="art">
      <div class="art-num">1.4.</div>
      <div class="art-body">Dílo bude prováděno na adrese: <strong>{{adresa_dila}}</strong> (dále jen „Staveniště").</div>
    </div>
  </div>

  <!-- II. Termíny -->
  <div class="sec">
    <div class="sec-head"><span class="sec-num">II.</span><span class="sec-title">Termíny realizace díla</span></div>

    <div class="art">
      <div class="art-num">2.1.</div>
      <div class="art-body">Zhotovitel převezme Staveniště v termínu <strong>{{termin_prevzeti}}</strong>. Pokud nebude dohodnuto jinak, Objednatel předá řádně připravené Staveniště Zhotoviteli v 9:00 hodin.</div>
    </div>

    <div class="art">
      <div class="art-num">2.2.</div>
      <div class="art-body">Smluvní strany sjednaly, že Zhotovitel je povinen Dílo provádět a dokončit ve lhůtě do <strong>{{pocet_dni_realizace}} dní</strong> ode dne, kdy Objednatel předá Zhotoviteli řádně připravené Staveniště. Přesný termín realizace dle požadavků obou stran je možné předem dohodnout, nejpozději však do <strong>{{zmena_term}}</strong>.</div>
    </div>

    <div class="art">
      <div class="art-num">2.3.</div>
      <div class="art-body">Termín předání Staveniště není pevný, jeho termín je možné domluvit telefonicky se zhotovitelem a potvrdit písemně na e-mailovou adresu Zhotovitele. Objednatel je oprávněn požádat o změnu termínu předání elektronicky na e-mailovou adresu Zhotovitele nejméně <strong>48 hodin</strong> před potvrzeným termínem předání Staveniště.</div>
    </div>

    <div class="art">
      <div class="art-num">2.4.</div>
      <div class="art-body">Smluvní strany sjednaly, že Zhotovitel je oprávněn u Objednatele uskladnit materiál pro provádění Díla a Objednatel je povinen zajistit Zhotoviteli pro uskladnění materiálu odpovídající prostor, který bude zajištěn proti dešti a odcizení tohoto materiálu.</div>
    </div>

    <div class="art">
      <div class="art-num">2.5.</div>
      <div class="art-body">Dodržení termínu provedení Díla Zhotovitelem je závislé na klimatických podmínkách (nevhodné či zcela znemožňující provedení Díla jsou: pokles venkovní teploty pod 0 °C, dešťové či sněhové srážky a ostatní nepříznivé klimatické podmínky).</div>
    </div>
  </div>

  <!-- III. Cena -->
  <div class="sec">
    <div class="sec-head"><span class="sec-num">III.</span><span class="sec-title">Cena díla</span></div>

    <div class="art">
      <div class="art-num">3.1.</div>
      <div class="art-body">Smluvní strany sjednaly cenu Díla ve výši (dále jen „cena Díla"). Smluvní strany sjednaly cenu Díla rozpočtem, uvedeným v Příloze č. 1 této Smlouvy.</div>
    </div>

    <div class="price">
      <div>
        <div class="price-label">Cena celkem s DPH</div>
        <div class="price-total mono">{{cena_s_dph}}</div>
      </div>
      <div class="price-break">
        <div>bez DPH <span class="v mono">{{konecna_cena}}</span></div>
        <div>DPH <span class="v mono">{{dph_sazba}} %</span></div>
      </div>
    </div>

    <div class="art">
      <div class="art-num">3.2.</div>
      <div class="art-body">Objednatel prohlašuje, že Staveniště splňuje požadavky ve smyslu ustanovení § 48 a/nebo § 49 zákona č. 235/2004 Sb., o dani z přidané hodnoty, ve znění pozdějších předpisů, pro uplatnění první snížené sazby DPH ve výši <strong>{{dph_sazba}} %</strong>.</div>
    </div>

    <div class="art">
      <div class="art-num">3.3.</div>
      <div class="art-body">Cenu Díla se Objednatel zavazuje uhradit po dokončení Díla. Zhotovitel vystaví Objednateli závěrečnou fakturu se splatností <strong>14 dní</strong> od jejího doručení.</div>
    </div>
  </div>

  <!-- IV. Smluvní pokuty -->
  <div class="sec">
    <div class="sec-head"><span class="sec-num">IV.</span><span class="sec-title">Smluvní pokuty</span></div>

    <div class="art">
      <div class="art-num">4.1.</div>
      <div class="art-body">V případě prodlení Objednatele s úhradou ceny Díla vzniká Zhotoviteli vůči Objednateli právo na zaplacení smluvní pokuty ve výši <strong>0,03 %</strong> z dlužné částky za každý, byť jen započatý den prodlení.</div>
    </div>

    <div class="art">
      <div class="art-num">4.2.</div>
      <div class="art-body">V případě prodlení Zhotovitele s dokončením Díla, vzniká Objednateli vůči Zhotoviteli právo na zaplacení smluvní pokuty ve výši <strong>0,03 %</strong> z ceny Díla bez DPH za každý, byť jen započatý den prodlení.</div>
    </div>
  </div>

  <!-- V. Předání staveniště -->
  <div class="sec">
    <div class="sec-head"><span class="sec-num">V.</span><span class="sec-title">Předání staveniště a převzetí díla</span></div>

    <div class="art">
      <div class="art-num">5.1.</div>
      <div class="art-body">Zhotovitel převezme Staveniště a zahájí provádění Díla dle termínů sjednaných v čl. II. této Smlouvy. O předání Staveniště bude pořízen písemný záznam podepsaný oběma Smluvními stranami.</div>
    </div>
  </div>

  <!-- VI. Záruční doba -->
  <div class="sec">
    <div class="sec-head"><span class="sec-num">VI.</span><span class="sec-title">Záruční doba</span></div>

    <div class="art">
      <div class="art-num">6.1.</div>
      <div class="art-body">Zhotovitel poskytuje záruku za jakost provedeného Díla po dobu <strong>5 let (60 měsíců)</strong> ode dne předání Díla Objednateli.</div>
    </div>

    <div class="art">
      <div class="art-num">6.2.</div>
      <div class="art-body">Podmínky záruky jsou uvedeny v dokumentu: <strong>Všeobecné záruční a servisní podmínky</strong>.</div>
    </div>
  </div>

  <!-- VII. Závěrečná ujednání -->
  <div class="sec">
    <div class="sec-head"><span class="sec-num">VII.</span><span class="sec-title">Závěrečná ujednání</span></div>

    <div class="art">
      <div class="art-num">7.1.</div>
      <div class="art-body">Tato Smlouva se vyhotovuje ve dvou stejnopisech, z nichž každý je originálem. Každá Smluvní strana obdrží jedno vyhotovení této Smlouvy. Je-li smlouva uzavřena distančně prostřednictvím prostředků elektronické komunikace, je tato smlouva uzavřena okamžikem, kdy dojde Zhotoviteli oznámení Objednatele o přijetí návrhu smlouvy předložené Zhotovitelem.</div>
    </div>

    <div class="art">
      <div class="art-num">7.2.</div>
      <div class="art-body">Nedílnou součástí této Smlouvy jsou <strong>Všeobecné obchodní podmínky</strong>, <strong>Všeobecné záruční a servisní podmínky</strong> a <strong>Ceník</strong>. Podpisem této Smlouvy Objednatel stvrzuje, že tyto dokumenty před podepsáním Smlouvy převzal, seznámil se s nimi, porozuměl jejich obsahu, souhlasí s nimi a zavazuje se je dodržovat.</div>
    </div>

    <div class="art">
      <div class="art-num">7.3.</div>
      <div class="art-body">Tato Smlouva se řídí českým právem, zejména pak občanským zákoníkem. Smluvní strany sjednávají, že příslušným soudem pro řešení sporů je Okresní soud v Ostravě nebo Krajský soud v Ostravě dle jejich funkční příslušnosti.</div>
    </div>

    <div class="art">
      <div class="art-num">7.4.</div>
      <div class="art-body">Tuto Smlouvu lze měnit či doplňovat vzestupně číslovanými dodatky ke Smlouvě odsouhlasenými oběma Smluvními stranami. Smluvní strany se dohodly, že jsou oprávněny uzavřít dodatek této Smlouvy elektronicky prostřednictvím e-mailových adres Smluvních stran uvedených v záhlaví této Smlouvy.</div>
    </div>

    <div class="art">
      <div class="art-num">7.5.</div>
      <div class="art-body">Smluvní strany shodně prohlašují, že si tuto Smlouvu před jejím podpisem přečetly a že byla uzavřena po vzájemném projednání podle jejich pravé a svobodné vůle určitě, vážně a srozumitelně, nikoliv v tísni nebo za nápadně nevýhodných podmínek, což stvrzují svými podpisy.</div>
    </div>

    <div class="art">
      <div class="art-num">7.6.</div>
      <div class="art-body">Tato Smlouva nabývá platnosti a účinnosti dnem podpisu druhou ze Smluvních stran.</div>
    </div>

    <div class="art">
      <div class="art-num">7.7.</div>
      <div class="art-body">Nedílnou součástí této Smlouvy jsou níže uvedené přílohy:</div>
    </div>
    <div class="sub">
      <div class="sub-num">Příloha č. 1:</div>
      <div class="sub-body">Cenová nabídka</div>
    </div>
    <div class="sub">
      <div class="sub-num">Příloha č. 2:</div>
      <div class="sub-body">Všeobecné obchodní podmínky</div>
    </div>
    <div class="sub">
      <div class="sub-num">Příloha č. 3:</div>
      <div class="sub-body">Všeobecné záruční a servisní podmínky</div>
    </div>
  </div>

  <div class="sign-wrap">
    <div class="signs">
      <div class="sign">
        <div class="sign-role">Objednatel</div>
        <div class="sign-who">{{klient_jmeno}}</div>
        <div class="sign-sub">{{adresa_dila}}</div>
        <div class="sign-line">Podpis</div>
        <div class="sign-date">V ……………………… dne ………………………</div>
      </div>
      <div class="sign">
        <div class="sign-role">Zhotovitel</div>
        <div class="sign-who">{{organizace}}</div>
        <div class="sign-sub">Radek Kunčický, jednatel</div>
        <div class="sign-line">Podpis</div>
        <div class="sign-date">V Ostravě dne {{datum}}</div>
      </div>
    </div>
  </div>

</div>
</body>
</html>`

async function main() {
  await prisma.contractTemplate.upsert({
    where: { id: 'sod-12pct-nanto-bezalohy-v1' },
    create: {
      id: 'sod-12pct-nanto-bezalohy-v1',
      orgId: NANTO_ORG_ID,
      nazev: 'SOD 12 % DPH — bez zálohy',
      popis: 'Smlouva o dílo se sníženou sazbou DPH 12 % (§ 48 zák. č. 235/2004 Sb.) — platba jednorázově po dokončení, bez zálohové faktury. VOP, záruční podmínky.',
      obsah: HTML_SOD_12PCT_BEZALOHY,
      typSablony: 'DPH_12_BEZ_ZALOHY',
    },
    update: {
      nazev: 'SOD 12 % DPH — bez zálohy',
      popis: 'Smlouva o dílo se sníženou sazbou DPH 12 % (§ 48 zák. č. 235/2004 Sb.) — platba jednorázově po dokončení, bez zálohové faktury. VOP, záruční podmínky.',
      obsah: HTML_SOD_12PCT_BEZALOHY,
      typSablony: 'DPH_12_BEZ_ZALOHY',
    },
  })
  console.log('Hotovo: SOD 12 % DPH — bez zálohy')
}

main().catch(console.error).finally(() => prisma.$disconnect())
