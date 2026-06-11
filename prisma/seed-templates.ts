import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const templateA = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1A1A2E; background: #fff; font-size: 14px; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  .header { border-bottom: 3px solid #E8340A; padding-bottom: 24px; margin-bottom: 32px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-type { font-size: 28px; font-weight: 700; color: #E8340A; letter-spacing: -0.5px; }
  .doc-meta { text-align: right; font-size: 13px; color: #666; }
  .doc-meta .kod { font-size: 18px; font-weight: 700; color: #1A1A2E; }
  .info-bar { margin-top: 12px; display: flex; gap: 24px; font-size: 12px; color: #888; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .party-card { background: #f8f9fa; border-left: 4px solid #E8340A; padding: 16px; border-radius: 4px; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #E8340A; letter-spacing: 1px; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .party-detail { font-size: 12px; color: #555; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  thead tr { background: #1A1A2E; color: #fff; }
  thead th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th:last-child { text-align: right; }
  tbody tr:nth-child(even) { background: #f8f9fa; }
  tbody td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #eee; }
  tbody td:last-child { text-align: right; font-weight: 500; }
  .tfoot-row { background: #1A1A2E; color: #fff; }
  .tfoot-row td { padding: 8px 16px; font-size: 13px; }
  .tfoot-total { background: #E8340A; color: #fff; }
  .tfoot-total td { padding: 14px 16px; font-size: 15px; font-weight: 700; }
  .tfoot-total td:last-child { text-align: right; }
  .notes { background: #fff8f8; border: 1px solid #fcc; padding: 16px; border-radius: 4px; margin-bottom: 32px; }
  .notes h3 { font-size: 12px; font-weight: 700; color: #E8340A; text-transform: uppercase; margin-bottom: 8px; }
  .footer-bar { border-top: 2px solid #E8340A; padding-top: 24px; margin-top: 32px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig-box { border-top: 1px solid #ccc; padding-top: 8px; font-size: 12px; color: #666; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 20px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div>
        <div class="doc-type">CENOVÁ NABÍDKA</div>
        <div class="info-bar">
          <span>Datum: {{datum_dnes}}</span>
          <span>Platnost: 30 dní</span>
        </div>
      </div>
      <div class="doc-meta">
        <div class="kod">{{kod_op}}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party-card">
      <div class="party-label">Zhotovitel</div>
      <div class="party-name">{{org_nazev}}</div>
      <div class="party-detail">
        IČ: {{org_ico}}<br>
        {{org_sidlo}}<br>
        {{org_email}}<br>
        {{org_telefon}}
      </div>
    </div>
    <div class="party-card">
      <div class="party-label">Objednatel</div>
      <div class="party-name">{{klient_jmeno}}</div>
      <div class="party-detail">
        {{klient_email}}<br>
        {{klient_telefon}}<br>
        {{adresa_dila}}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Popis produktu / služby</th>
        <th>Ks</th>
        <th>Cena / MJ</th>
        <th>Cena celkem</th>
      </tr>
    </thead>
    <tbody>
      {{#polozky}}
      <tr>
        <td>{{poradi}}</td>
        <td>{{nazev}}</td>
        <td>{{mnozstvi}}</td>
        <td>{{cena_za_kus}} Kč</td>
        <td>{{cena_celkem}} Kč</td>
      </tr>
      {{/polozky}}
    </tbody>
    <tfoot>
      <tr class="tfoot-row">
        <td colspan="4">Celkem bez DPH</td>
        <td style="text-align:right">{{hodnota_bez_dph}} Kč</td>
      </tr>
      <tr class="tfoot-row">
        <td colspan="4">DPH {{dph_sazba}}%</td>
        <td style="text-align:right">{{dph_castka}} Kč</td>
      </tr>
      <tr class="tfoot-total">
        <td colspan="4">Cena celkem s DPH</td>
        <td style="text-align:right">{{hodnota_s_dph}} Kč</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer-bar">
    <div class="signatures">
      <div class="sig-box">
        <p>Zhotovitel: {{org_nazev}}</p>
        <br><br><br>
        <p>Podpis: ________________________________</p>
        <p>Datum: ________________</p>
      </div>
      <div class="sig-box">
        <p>Objednatel: {{klient_jmeno}}</p>
        <br><br><br>
        <p>Podpis: ________________________________</p>
        <p>Datum: ________________</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

const templateB = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1A1A2E; background: #fff; font-size: 14px; line-height: 1.6; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  .header { border-bottom: 3px solid #E8340A; padding-bottom: 24px; margin-bottom: 32px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-type { font-size: 24px; font-weight: 700; color: #E8340A; letter-spacing: -0.5px; }
  .doc-sub { font-size: 14px; color: #555; margin-top: 4px; }
  .doc-meta { text-align: right; font-size: 13px; color: #666; }
  .doc-meta .cislo { font-size: 16px; font-weight: 700; color: #1A1A2E; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .party-card { background: #f8f9fa; border-left: 4px solid #E8340A; padding: 16px; border-radius: 4px; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #E8340A; letter-spacing: 1px; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .party-detail { font-size: 12px; color: #555; line-height: 1.6; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 700; color: #E8340A; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #E8340A; padding-bottom: 6px; margin-bottom: 12px; }
  .section p { font-size: 13px; color: #333; margin-bottom: 8px; }
  .section ul { font-size: 13px; color: #333; padding-left: 20px; }
  .section ul li { margin-bottom: 4px; }
  .highlight-box { background: #fff8f8; border: 1px solid #fcc; padding: 14px 16px; border-radius: 4px; margin-bottom: 8px; }
  .highlight-box .amount { font-size: 20px; font-weight: 700; color: #E8340A; }
  .footer-bar { border-top: 2px solid #E8340A; padding-top: 24px; margin-top: 32px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig-box { border-top: 1px solid #ccc; padding-top: 8px; font-size: 12px; color: #666; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 20px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div>
        <div class="doc-type">SMLOUVA O DÍLO</div>
        <div class="doc-sub">uzavřená dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník</div>
      </div>
      <div class="doc-meta">
        <div class="cislo">č. {{cislo_smlouvy}}</div>
        <div style="margin-top:4px; font-size:12px;">Datum: {{datum_dnes}}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party-card">
      <div class="party-label">Zhotovitel</div>
      <div class="party-name">{{org_nazev}}</div>
      <div class="party-detail">
        IČ: {{org_ico}}<br>
        Sídlo: {{org_sidlo}}
      </div>
    </div>
    <div class="party-card">
      <div class="party-label">Objednatel</div>
      <div class="party-name">{{klient_jmeno}}</div>
      <div class="party-detail">
        Email: {{klient_email}}<br>
        Telefon: {{klient_telefon}}<br>
        Adresa díla: {{adresa_dila}}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">I. Předmět díla</div>
    <p>Zhotovitel se zavazuje provést pro objednatele dílo spočívající v:</p>
    <p><strong>{{predmet}}</strong></p>
    <p>Dílo bude provedeno na adrese: <strong>{{adresa_dila}}</strong></p>
    <p>Zhotovitel se zavazuje provést dílo řádně, v souladu s obecně závaznými právními předpisy, technickými normami a pokyny objednatele.</p>
  </div>

  <div class="section">
    <div class="section-title">II. Termíny plnění</div>
    <p>Předání staveniště objednatelem zhotoviteli: <strong>{{termin_prevzeti}}</strong></p>
    <p>Termín dokončení a předání díla objednateli: <strong>{{termin_realizace}}</strong></p>
    <p>Termín realizace může být změněn pouze písemnou dohodou obou smluvních stran. Zhotovitel je povinen neprodleně informovat objednatele o případných okolnostech, které by mohly ohrozit termín dokončení díla.</p>
  </div>

  <div class="section">
    <div class="section-title">III. Cena díla</div>
    <div class="highlight-box">
      <p>Cena díla bez DPH: <strong>{{hodnota_bez_dph}} Kč</strong></p>
      <p>DPH {{dph_sazba}}%: součást ceny</p>
      <p>Cena díla celkem s DPH: <span class="amount">{{hodnota_s_dph}} Kč</span></p>
    </div>
    <p>Cena je sjednána jako nejvýše přípustná a zahrnuje veškeré náklady zhotovitele spojené s provedením díla. Změnu ceny je možné provést pouze písemným dodatkem k této smlouvě.</p>
  </div>

  <div class="section">
    <div class="section-title">IV. Platební podmínky a záloha</div>
    <p>Záloha ve výši <strong>{{hodnota_zalohy}} Kč</strong> je splatná do <strong>{{splatnost_zalohy}}</strong> na základě zálohové faktury vystavené zhotovitelem.</p>
    <p>Doplatek zbývající části ceny díla bude fakturován po předání dokončeného díla objednateli. Splatnost závěrečné faktury je 14 dní od jejího doručení.</p>
    <p>V případě prodlení s úhradou je objednatel povinen zaplatit smluvní úrok z prodlení ve výši 0,05 % z dlužné částky za každý den prodlení.</p>
  </div>

  <div class="section">
    <div class="section-title">V. Odpovědnost za vady a záruky</div>
    <p>Zhotovitel poskytuje na provedené dílo záruku v délce <strong>24 měsíců</strong> od data předání a převzetí díla objednatelem.</p>
    <p>Zhotovitel odpovídá za vady, které má dílo v době jeho předání, jakož i za vady, které se projeví v záruční době.</p>
    <p>Objednatel je povinen vady díla reklamovat u zhotovitele bez zbytečného odkladu poté, co je zjistí, a to písemnou formou s popisem vady.</p>
    <p>Zhotovitel je povinen nastoupit k odstranění reklamované vady do 5 pracovních dnů od obdržení reklamace a vadu odstranit v přiměřené lhůtě.</p>
  </div>

  <div class="section">
    <div class="section-title">VI. Smluvní pokuty a sankce</div>
    <p>Za prodlení zhotovitele s předáním díla v dohodnutém termínu je objednatel oprávněn požadovat smluvní pokutu ve výši <strong>0,05 %</strong> z celkové ceny díla za každý den prodlení.</p>
    <p>Za prodlení objednatele s úhradou zálohové nebo závěrečné faktury je zhotovitel oprávněn požadovat smluvní úrok z prodlení ve výši 0,05 % z dlužné částky za každý den prodlení.</p>
    <p>Uplatněním smluvní pokuty není dotčen nárok na náhradu škody v plné výši.</p>
  </div>

  <div class="section">
    <div class="section-title">VII. Bezpečnost a ochrana zdraví při práci</div>
    <p>Zhotovitel se zavazuje při provádění díla dodržovat veškeré platné předpisy o bezpečnosti a ochraně zdraví při práci (BOZP), požární ochraně a ochranu životního prostředí.</p>
    <p>Zhotovitel je povinen zajistit, aby všichni jeho zaměstnanci a subdodavatelé byli řádně proškoleni v oblasti BOZP a dodržovali bezpečnostní předpisy.</p>
    <p>Zhotovitel odpovídá za škody vzniklé při provádění díla třetím osobám, pokud jsou způsobeny jeho zaviněním nebo zaviněním jeho pracovníků.</p>
  </div>

  <div class="section">
    <div class="section-title">VIII. Změny díla</div>
    <p>Jakékoliv změny rozsahu díla, technického řešení nebo jiných parametrů smlouvy jsou možné pouze na základě písemné dohody obou smluvních stran, a to formou číslovaného dodatku k této smlouvě.</p>
    <p>Ústní dohody o změnách díla nejsou pro smluvní strany závazné.</p>
  </div>

  <div class="section">
    <div class="section-title">IX. Závěrečná ustanovení</div>
    <p>Tato smlouva nabývá platnosti a účinnosti dnem podpisu oběma smluvními stranami.</p>
    <p>Práva a povinnosti touto smlouvou výslovně neupravené se řídí příslušnými ustanoveními zákona č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů.</p>
    <p>Veškeré spory vzniklé z této smlouvy nebo v souvislosti s ní se smluvní strany zavazují řešit přednostně smírnou cestou. Nedojde-li k dohodě, bude spor rozhodnut příslušným soudem České republiky.</p>
    <p>Smluvní strany prohlašují, že si tuto smlouvu přečetly, že odpovídá jejich pravé a svobodné vůli, a na důkaz toho připojují své podpisy.</p>
  </div>

  <div class="section">
    <div class="section-title">X. Počet vyhotovení</div>
    <p>Tato smlouva je vyhotovena ve <strong>dvou</strong> stejnopisech s platností originálu, přičemž každá smluvní strana obdrží jedno vyhotovení.</p>
  </div>

  <div class="footer-bar">
    <div class="signatures">
      <div class="sig-box">
        <p><strong>Zhotovitel:</strong> {{org_nazev}}</p>
        <br><br><br>
        <p>Podpis: ________________________________</p>
        <p>Datum: ________________</p>
      </div>
      <div class="sig-box">
        <p><strong>Objednatel:</strong> {{klient_jmeno}}</p>
        <br><br><br>
        <p>Podpis: ________________________________</p>
        <p>Datum: ________________</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

const templateC = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1A1A2E; background: #fff; font-size: 14px; line-height: 1.6; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  .header { border-bottom: 3px solid #E8340A; padding-bottom: 24px; margin-bottom: 32px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-type { font-size: 24px; font-weight: 700; color: #E8340A; letter-spacing: -0.5px; }
  .doc-sub { font-size: 14px; color: #555; margin-top: 4px; }
  .doc-meta { text-align: right; font-size: 13px; color: #666; }
  .doc-meta .cislo { font-size: 16px; font-weight: 700; color: #1A1A2E; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .party-card { background: #f8f9fa; border-left: 4px solid #E8340A; padding: 16px; border-radius: 4px; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #E8340A; letter-spacing: 1px; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .party-detail { font-size: 12px; color: #555; line-height: 1.6; }
  .contact-badge { display: inline-block; background: #fff3f0; border: 1px solid #E8340A; border-radius: 4px; padding: 6px 10px; margin-top: 8px; font-size: 12px; color: #E8340A; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 700; color: #E8340A; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #E8340A; padding-bottom: 6px; margin-bottom: 12px; }
  .section p { font-size: 13px; color: #333; margin-bottom: 8px; }
  .section ul { font-size: 13px; color: #333; padding-left: 20px; }
  .section ul li { margin-bottom: 4px; }
  .highlight-box { background: #fff8f8; border: 1px solid #fcc; padding: 14px 16px; border-radius: 4px; margin-bottom: 8px; }
  .highlight-box .amount { font-size: 20px; font-weight: 700; color: #E8340A; }
  .footer-bar { border-top: 2px solid #E8340A; padding-top: 24px; margin-top: 32px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig-box { border-top: 1px solid #ccc; padding-top: 8px; font-size: 12px; color: #666; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 20px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div>
        <div class="doc-type">SMLOUVA O DÍLO</div>
        <div class="doc-sub">uzavřená dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník</div>
      </div>
      <div class="doc-meta">
        <div class="cislo">č. {{cislo_smlouvy}}</div>
        <div style="margin-top:4px; font-size:12px;">Datum: {{datum_dnes}}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party-card">
      <div class="party-label">Zhotovitel</div>
      <div class="party-name">{{org_nazev}}</div>
      <div class="party-detail">
        IČ: {{org_ico}}<br>
        Sídlo: {{org_sidlo}}
      </div>
    </div>
    <div class="party-card">
      <div class="party-label">Objednatel</div>
      <div class="party-name">{{klient_jmeno}}</div>
      <div class="party-detail">
        Email: {{klient_email}}<br>
        Telefon: {{klient_telefon}}<br>
        Adresa díla: {{adresa_dila}}
      </div>
      <div class="contact-badge">
        Zodpovědný zástupce: {{kontaktni_osoba}}, tel: {{kontaktni_telefon}}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">I. Předmět díla</div>
    <p>Zhotovitel se zavazuje provést pro objednatele dílo spočívající v:</p>
    <p><strong>{{predmet}}</strong></p>
    <p>Dílo bude provedeno na adrese: <strong>{{adresa_dila}}</strong></p>
    <p>Zhotovitel se zavazuje provést dílo řádně, v souladu s obecně závaznými právními předpisy, technickými normami a pokyny objednatele.</p>
  </div>

  <div class="section">
    <div class="section-title">II. Termíny plnění</div>
    <p>Předání staveniště objednatelem zhotoviteli: <strong>{{termin_prevzeti}}</strong></p>
    <p>Termín dokončení a předání díla objednateli: <strong>{{termin_realizace}}</strong></p>
    <p>Termín realizace může být změněn pouze písemnou dohodou obou smluvních stran. Zhotovitel je povinen neprodleně informovat objednatele o případných okolnostech, které by mohly ohrozit termín dokončení díla.</p>
  </div>

  <div class="section">
    <div class="section-title">III. Cena díla</div>
    <div class="highlight-box">
      <p>Cena díla bez DPH: <strong>{{hodnota_bez_dph}} Kč</strong></p>
      <p>DPH {{dph_sazba}}%: součást ceny</p>
      <p>Cena díla celkem s DPH: <span class="amount">{{hodnota_s_dph}} Kč</span></p>
    </div>
    <p>Cena je sjednána jako nejvýše přípustná a zahrnuje veškeré náklady zhotovitele spojené s provedením díla. Změnu ceny je možné provést pouze písemným dodatkem k této smlouvě.</p>
  </div>

  <div class="section">
    <div class="section-title">IV. Platební podmínky a záloha</div>
    <p>Záloha ve výši <strong>{{hodnota_zalohy}} Kč</strong> je splatná do <strong>{{splatnost_zalohy}}</strong> na základě zálohové faktury vystavené zhotovitelem.</p>
    <p>Doplatek zbývající části ceny díla bude fakturován po předání dokončeného díla objednateli. Splatnost závěrečné faktury je 14 dní od jejího doručení.</p>
    <p>V případě prodlení s úhradou je objednatel povinen zaplatit smluvní úrok z prodlení ve výši 0,05 % z dlužné částky za každý den prodlení.</p>
  </div>

  <div class="section">
    <div class="section-title">V. Odpovědnost za vady a záruky</div>
    <p>Zhotovitel poskytuje na provedené dílo záruku v délce <strong>24 měsíců</strong> od data předání a převzetí díla objednatelem.</p>
    <p>Zhotovitel odpovídá za vady, které má dílo v době jeho předání, jakož i za vady, které se projeví v záruční době.</p>
    <p>Objednatel je povinen vady díla reklamovat u zhotovitele bez zbytečného odkladu poté, co je zjistí, a to písemnou formou s popisem vady. Kontaktní osobou pro reklamace za objednatele je: <strong>{{kontaktni_osoba}}</strong>, tel: <strong>{{kontaktni_telefon}}</strong>.</p>
    <p>Zhotovitel je povinen nastoupit k odstranění reklamované vady do 5 pracovních dnů od obdržení reklamace a vadu odstranit v přiměřené lhůtě.</p>
  </div>

  <div class="section">
    <div class="section-title">VI. Smluvní pokuty a sankce</div>
    <p>Za prodlení zhotovitele s předáním díla v dohodnutém termínu je objednatel oprávněn požadovat smluvní pokutu ve výši <strong>0,05 %</strong> z celkové ceny díla za každý den prodlení.</p>
    <p>Za prodlení objednatele s úhradou zálohové nebo závěrečné faktury je zhotovitel oprávněn požadovat smluvní úrok z prodlení ve výši 0,05 % z dlužné částky za každý den prodlení.</p>
    <p>Uplatněním smluvní pokuty není dotčen nárok na náhradu škody v plné výši.</p>
  </div>

  <div class="section">
    <div class="section-title">VII. Bezpečnost a ochrana zdraví při práci</div>
    <p>Zhotovitel se zavazuje při provádění díla dodržovat veškeré platné předpisy o bezpečnosti a ochraně zdraví při práci (BOZP), požární ochraně a ochranu životního prostředí.</p>
    <p>Zhotovitel je povinen zajistit, aby všichni jeho zaměstnanci a subdodavatelé byli řádně proškoleni v oblasti BOZP a dodržovali bezpečnostní předpisy.</p>
    <p>Zhotovitel odpovídá za škody vzniklé při provádění díla třetím osobám, pokud jsou způsobeny jeho zaviněním nebo zaviněním jeho pracovníků.</p>
  </div>

  <div class="section">
    <div class="section-title">VIII. Změny díla</div>
    <p>Jakékoliv změny rozsahu díla, technického řešení nebo jiných parametrů smlouvy jsou možné pouze na základě písemné dohody obou smluvních stran, a to formou číslovaného dodatku k této smlouvě.</p>
    <p>Ústní dohody o změnách díla nejsou pro smluvní strany závazné.</p>
  </div>

  <div class="section">
    <div class="section-title">IX. Závěrečná ustanovení</div>
    <p>Tato smlouva nabývá platnosti a účinnosti dnem podpisu oběma smluvními stranami.</p>
    <p>Práva a povinnosti touto smlouvou výslovně neupravené se řídí příslušnými ustanoveními zákona č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů.</p>
    <p>Veškeré spory vzniklé z této smlouvy nebo v souvislosti s ní se smluvní strany zavazují řešit přednostně smírnou cestou. Nedojde-li k dohodě, bude spor rozhodnut příslušným soudem České republiky.</p>
    <p>Smluvní strany prohlašují, že si tuto smlouvu přečetly, že odpovídá jejich pravé a svobodné vůli, a na důkaz toho připojují své podpisy.</p>
  </div>

  <div class="section">
    <div class="section-title">X. Počet vyhotovení</div>
    <p>Tato smlouva je vyhotovena ve <strong>dvou</strong> stejnopisech s platností originálu, přičemž každá smluvní strana obdrží jedno vyhotovení.</p>
  </div>

  <div class="footer-bar">
    <div class="signatures">
      <div class="sig-box">
        <p><strong>Zhotovitel:</strong> {{org_nazev}}</p>
        <br><br><br>
        <p>Podpis: ________________________________</p>
        <p>Datum: ________________</p>
      </div>
      <div class="sig-box">
        <p><strong>Objednatel:</strong> {{klient_jmeno}}</p>
        <p style="margin-top:4px; font-size:11px;">Zástupce: {{kontaktni_osoba}}</p>
        <br><br>
        <p>Podpis: ________________________________</p>
        <p>Datum: ________________</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

const templateD = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1A1A2E; background: #fff; font-size: 14px; line-height: 1.6; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  .header { border-bottom: 3px solid #E8340A; padding-bottom: 24px; margin-bottom: 32px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-type { font-size: 24px; font-weight: 700; color: #E8340A; letter-spacing: -0.5px; }
  .doc-sub { font-size: 14px; color: #555; margin-top: 4px; }
  .doc-meta { text-align: right; font-size: 13px; color: #666; }
  .doc-meta .cislo { font-size: 16px; font-weight: 700; color: #1A1A2E; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .party-card { background: #f8f9fa; border-left: 4px solid #E8340A; padding: 16px; border-radius: 4px; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #E8340A; letter-spacing: 1px; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .party-detail { font-size: 12px; color: #555; line-height: 1.6; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 700; color: #E8340A; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #E8340A; padding-bottom: 6px; margin-bottom: 12px; }
  .section p { font-size: 13px; color: #333; margin-bottom: 8px; }
  .section ul { font-size: 13px; color: #333; padding-left: 20px; }
  .section ul li { margin-bottom: 4px; }
  .highlight-box { background: #fff8f8; border: 1px solid #fcc; padding: 14px 16px; border-radius: 4px; margin-bottom: 8px; }
  .highlight-box .amount { font-size: 20px; font-weight: 700; color: #E8340A; }
  .etapa-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .etapa-table th { background: #1A1A2E; color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .etapa-table td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #eee; }
  .etapa-table tr:nth-child(even) td { background: #f8f9fa; }
  .etapa-badge { display: inline-block; background: #E8340A; color: #fff; border-radius: 3px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
  .footer-bar { border-top: 2px solid #E8340A; padding-top: 24px; margin-top: 32px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig-box { border-top: 1px solid #ccc; padding-top: 8px; font-size: 12px; color: #666; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 20px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div>
        <div class="doc-type">SMLOUVA O DÍLO</div>
        <div class="doc-sub">uzavřená dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník — etapová realizace</div>
      </div>
      <div class="doc-meta">
        <div class="cislo">č. {{cislo_smlouvy}}</div>
        <div style="margin-top:4px; font-size:12px;">Datum: {{datum_dnes}}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party-card">
      <div class="party-label">Zhotovitel</div>
      <div class="party-name">{{org_nazev}}</div>
      <div class="party-detail">
        IČ: {{org_ico}}<br>
        Sídlo: {{org_sidlo}}
      </div>
    </div>
    <div class="party-card">
      <div class="party-label">Objednatel</div>
      <div class="party-name">{{klient_jmeno}}</div>
      <div class="party-detail">
        Email: {{klient_email}}<br>
        Telefon: {{klient_telefon}}<br>
        Adresa díla: {{adresa_dila}}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">I. Předmět díla</div>
    <p>Zhotovitel se zavazuje provést pro objednatele dílo spočívající v:</p>
    <p><strong>{{predmet}}</strong></p>
    <p>Dílo bude provedeno na adrese: <strong>{{adresa_dila}}</strong></p>
    <p>Zhotovitel se zavazuje provést dílo řádně, v souladu s obecně závaznými právními předpisy, technickými normami a pokyny objednatele.</p>
  </div>

  <div class="section">
    <div class="section-title">II. Termíny plnění — etapová realizace</div>
    <p>Předání staveniště objednatelem zhotoviteli: <strong>{{termin_prevzeti}}</strong></p>
    <p>Dílo bude realizováno ve dvou etapách dle následujícího harmonogramu:</p>
    <table class="etapa-table">
      <thead>
        <tr>
          <th>Etapa</th>
          <th>Název etapy</th>
          <th>Začátek montáže</th>
          <th>Délka realizace</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="etapa-badge">1</span></td>
          <td>{{etapa1_nazev}}</td>
          <td>{{etapa1_termin}}</td>
          <td>{{etapa1_doba}} pracovních dní</td>
        </tr>
        <tr>
          <td><span class="etapa-badge">2</span></td>
          <td>{{etapa2_nazev}}</td>
          <td>{{etapa2_termin}}</td>
          <td>{{etapa2_doba}} pracovních dní</td>
        </tr>
      </tbody>
    </table>
    <p style="margin-top:12px;">Termíny etap mohou být změněny pouze písemnou dohodou obou smluvních stran. Zhotovitel je povinen neprodleně informovat objednatele o okolnostech, které by mohly ohrozit termín dokončení kterékoliv etapy.</p>
  </div>

  <div class="section">
    <div class="section-title">III. Cena díla</div>
    <div class="highlight-box">
      <p>Cena díla bez DPH: <strong>{{hodnota_bez_dph}} Kč</strong></p>
      <p>DPH {{dph_sazba}}%: součást ceny</p>
      <p>Cena díla celkem s DPH: <span class="amount">{{hodnota_s_dph}} Kč</span></p>
    </div>
    <p>Cena je sjednána jako nejvýše přípustná a zahrnuje veškeré náklady zhotovitele spojené s provedením díla. Změnu ceny je možné provést pouze písemným dodatkem k této smlouvě.</p>
  </div>

  <div class="section">
    <div class="section-title">IV. Platební podmínky a záloha</div>
    <p>Záloha ve výši <strong>{{hodnota_zalohy}} Kč</strong> je splatná do <strong>{{splatnost_zalohy}}</strong> na základě zálohové faktury vystavené zhotovitelem.</p>
    <p>Doplatek zbývající části ceny díla bude fakturován po předání dokončeného díla objednateli. Splatnost závěrečné faktury je 14 dní od jejího doručení.</p>
    <p>V případě prodlení s úhradou je objednatel povinen zaplatit smluvní úrok z prodlení ve výši 0,05 % z dlužné částky za každý den prodlení.</p>
  </div>

  <div class="section">
    <div class="section-title">V. Odpovědnost za vady a záruky</div>
    <p>Zhotovitel poskytuje na provedené dílo záruku v délce <strong>24 měsíců</strong> od data předání a převzetí díla objednatelem.</p>
    <p>Zhotovitel odpovídá za vady, které má dílo v době jeho předání, jakož i za vady, které se projeví v záruční době.</p>
    <p>Objednatel je povinen vady díla reklamovat u zhotovitele bez zbytečného odkladu poté, co je zjistí, a to písemnou formou s popisem vady.</p>
    <p>Zhotovitel je povinen nastoupit k odstranění reklamované vady do 5 pracovních dnů od obdržení reklamace a vadu odstranit v přiměřené lhůtě.</p>
  </div>

  <div class="section">
    <div class="section-title">VI. Smluvní pokuty a sankce</div>
    <p>Za prodlení zhotovitele s předáním díla nebo jednotlivé etapy v dohodnutém termínu je objednatel oprávněn požadovat smluvní pokutu ve výši <strong>0,05 %</strong> z celkové ceny díla za každý den prodlení.</p>
    <p>Za prodlení objednatele s úhradou zálohové nebo závěrečné faktury je zhotovitel oprávněn požadovat smluvní úrok z prodlení ve výši 0,05 % z dlužné částky za každý den prodlení.</p>
    <p>Uplatněním smluvní pokuty není dotčen nárok na náhradu škody v plné výši.</p>
  </div>

  <div class="section">
    <div class="section-title">VII. Bezpečnost a ochrana zdraví při práci</div>
    <p>Zhotovitel se zavazuje při provádění díla dodržovat veškeré platné předpisy o bezpečnosti a ochraně zdraví při práci (BOZP), požární ochraně a ochranu životního prostředí.</p>
    <p>Zhotovitel je povinen zajistit, aby všichni jeho zaměstnanci a subdodavatelé byli řádně proškoleni v oblasti BOZP a dodržovali bezpečnostní předpisy.</p>
    <p>Zhotovitel odpovídá za škody vzniklé při provádění díla třetím osobám, pokud jsou způsobeny jeho zaviněním nebo zaviněním jeho pracovníků.</p>
  </div>

  <div class="section">
    <div class="section-title">VIII. Změny díla</div>
    <p>Jakékoliv změny rozsahu díla, technického řešení, harmonogramu etap nebo jiných parametrů smlouvy jsou možné pouze na základě písemné dohody obou smluvních stran, a to formou číslovaného dodatku k této smlouvě.</p>
    <p>Ústní dohody o změnách díla nejsou pro smluvní strany závazné.</p>
  </div>

  <div class="section">
    <div class="section-title">IX. Závěrečná ustanovení</div>
    <p>Tato smlouva nabývá platnosti a účinnosti dnem podpisu oběma smluvními stranami.</p>
    <p>Práva a povinnosti touto smlouvou výslovně neupravené se řídí příslušnými ustanoveními zákona č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů.</p>
    <p>Veškeré spory vzniklé z této smlouvy nebo v souvislosti s ní se smluvní strany zavazují řešit přednostně smírnou cestou. Nedojde-li k dohodě, bude spor rozhodnut příslušným soudem České republiky.</p>
    <p>Smluvní strany prohlašují, že si tuto smlouvu přečetly, že odpovídá jejich pravé a svobodné vůli, a na důkaz toho připojují své podpisy.</p>
  </div>

  <div class="section">
    <div class="section-title">X. Počet vyhotovení</div>
    <p>Tato smlouva je vyhotovena ve <strong>dvou</strong> stejnopisech s platností originálu, přičemž každá smluvní strana obdrží jedno vyhotovení.</p>
  </div>

  <div class="footer-bar">
    <div class="signatures">
      <div class="sig-box">
        <p><strong>Zhotovitel:</strong> {{org_nazev}}</p>
        <br><br><br>
        <p>Podpis: ________________________________</p>
        <p>Datum: ________________</p>
      </div>
      <div class="sig-box">
        <p><strong>Objednatel:</strong> {{klient_jmeno}}</p>
        <br><br><br>
        <p>Podpis: ________________________________</p>
        <p>Datum: ________________</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true } })

  const templates = [
    { nazev: 'Cenová nabídka', typSablony: 'html', obsah: templateA },
    { nazev: 'Smlouva o dílo - standard', typSablony: 'html', obsah: templateB },
    { nazev: 'Smlouva o dílo - s kontaktní osobou', typSablony: 'html', obsah: templateC },
    { nazev: 'Smlouva o dílo - etapová', typSablony: 'html', obsah: templateD },
  ]

  for (const org of orgs) {
    for (const t of templates) {
      const existing = await prisma.contractTemplate.findFirst({
        where: { orgId: org.id, nazev: t.nazev },
      })
      if (existing) {
        await prisma.contractTemplate.update({
          where: { id: existing.id },
          data: { obsah: t.obsah, typSablony: t.typSablony },
        })
      } else {
        await prisma.contractTemplate.create({
          data: { orgId: org.id, ...t },
        })
      }
    }
  }

  console.log('Templates seeded!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
