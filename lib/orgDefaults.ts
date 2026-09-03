import type { Prisma } from '@prisma/client'

// Vzorová smlouva o dílo pro nově založenou organizaci. Obsah je HTML ve stejném
// formátu, jaký ukládá TipTap editor smluvních šablon (SodTemplateEditor) —
// jednoduché odstavce a nadpisy s {{placeholdery}} ze SOD_PLACEHOLDERS.
const VZOROVA_SMLOUVA_HTML = `
<h1>Smlouva o dílo č. {{cislo_smlouvy}}</h1>
<p>uzavřená podle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník, v platném znění</p>

<h2>I. Smluvní strany</h2>
<p><strong>Zhotovitel:</strong> {{organizace}}, se sídlem {{org_sidlo}}, IČO: {{org_ico}}, DIČ: {{org_dic}}</p>
<p><strong>Objednatel:</strong> {{klient_jmeno}}, {{klient_adresa}}, IČO: {{klient_ico}}, DIČ: {{klient_dic}}, e-mail: {{klient_email}}, tel.: {{klient_telefon}}</p>
<p>Kontaktní osoba objednatele: {{kontaktni_osoba}}, tel.: {{kontaktni_telefon}}</p>

<h2>II. Předmět díla</h2>
<p>Zhotovitel se zavazuje provést pro objednatele na svůj náklad a nebezpečí dílo: <strong>{{predmet}}</strong>, a to v rozsahu dle cenové nabídky k obchodnímu případu {{kod_op}}, která tvoří přílohu této smlouvy. Objednatel se zavazuje dokončené dílo převzít a zaplatit sjednanou cenu.</p>

<h2>III. Místo plnění</h2>
<p>Místem provedení díla je: {{adresa_dila}}.</p>

<h2>IV. Cena díla</h2>
<p>Cena díla je sjednána dohodou smluvních stran ve výši <strong>{{konecna_cena}} bez DPH</strong>, tj. <strong>{{cena_s_dph}} včetně DPH</strong> (sazba DPH {{dph_sazba}} %). Cena zahrnuje veškeré náklady zhotovitele spojené s provedením díla dle přílohy této smlouvy.</p>

<h2>V. Platební podmínky</h2>
<p>Objednatel uhradí zálohu ve výši <strong>{{hodnota_zalohy}}</strong> na základě zálohové faktury se splatností {{zaloha_splatnost}} dní od podpisu této smlouvy. Doplatek ceny díla je splatný na základě konečné faktury vystavené po předání a převzetí díla, se splatností 14 dní.</p>

<h2>VI. Termín plnění</h2>
<p>Zhotovitel provede dílo v termínu do {{termin_realizace}}, přičemž předpokládaná doba realizace činí {{pocet_dni_realizace}} dní. Případnou změnu termínu oznámí zhotovitel objednateli nejpozději do {{zmena_term}}. Termín se přiměřeně prodlužuje o dobu, po kterou nemohl zhotovitel dílo provádět z důvodů na straně objednatele nebo vyšší moci.</p>

<h2>VII. Předání a převzetí díla</h2>
<p>O předání a převzetí díla sepíší smluvní strany předávací protokol. Dílo se považuje za dokončené, je-li předvedena jeho způsobilost sloužit svému účelu. Objednatel není oprávněn odmítnout převzetí díla pro ojedinělé drobné vady, které samy o sobě ani ve spojení s jinými nebrání užívání díla.</p>

<h2>VIII. Záruka za jakost</h2>
<p>Zhotovitel poskytuje na provedené dílo záruku v délce 24 měsíců od předání díla, není-li u jednotlivých zařízení výrobcem stanovena záruka delší. Záruka se nevztahuje na vady způsobené neodborným zásahem, nesprávným užíváním nebo zanedbáním předepsané údržby.</p>

<h2>IX. Závěrečná ustanovení</h2>
<p>Tato smlouva nabývá platnosti a účinnosti dnem podpisu oběma smluvními stranami. Smlouvu lze měnit pouze písemnými dodatky. Práva a povinnosti touto smlouvou výslovně neupravené se řídí občanským zákoníkem. Smluvní strany prohlašují, že si smlouvu přečetly a s jejím obsahem souhlasí.</p>

<p>V ……………………… dne {{datum}}</p>
<p><strong>Zhotovitel:</strong> {{organizace}} ……………………………</p>
<p><strong>Objednatel:</strong> {{klient_jmeno}} ……………………………</p>
`.trim()

/**
 * Výchozí obsah pro nově registrovanou organizaci — volá se uvnitř registrační
 * transakce, aby nová org nezačínala s prázdnou appkou: jedna výchozí renderovací
 * šablona nabídky (stejná, jakou zakládá prisma/seed-quote-rendering-templates.ts)
 * a jedna vzorová smlouva o dílo s placeholdery.
 */
export async function seedOrgDefaults(tx: Prisma.TransactionClient, orgId: string) {
  await tx.quoteTemplate.create({
    data: {
      orgId,
      nazev: 'Základní nabídka',
      typ: 'BASE',
      isDefault: true,
      planRequired: 'STARTER',
      config: {
        create: { primaryColor: '#4CAF50' },
      },
    },
  })

  await tx.contractTemplate.create({
    data: {
      orgId,
      nazev: 'Smlouva o dílo — obecný vzor',
      popis: 'Vzorový text — před použitím nechte zkontrolovat právníkem.',
      typSablony: 'text',
      obsah: VZOROVA_SMLOUVA_HTML,
    },
  })
}
