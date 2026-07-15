// DOCX generation for SOD using docxtemplater + PizZip
// Builds the Word XML template in memory, then fills {{placeholders}} via docxtemplater

import { SodDocData, isPdp, seZalohou } from './sodDocument'
import { formatCislo } from '@/lib/format'

// XML character escaping (for static text only — not for {{placeholders}})
function x(s: string | null | undefined): string {
  if (!s) return '—'
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

// Build a paragraph: array of {text, bold?, placeholder?} segments
// If placeholder=true, text is a docxtemplater marker like {{foo}} — not XML-escaped
interface Seg { text: string; bold?: boolean; size?: number; placeholder?: boolean }
function para(segs: Seg | Seg[], opts?: { center?: boolean; before?: number; after?: number; indent?: number }): string {
  const arr = Array.isArray(segs) ? segs : [segs]
  const jc = opts?.center ? `<w:jc w:val="center"/>` : ''
  const ind = opts?.indent ? `<w:ind w:left="${opts.indent}"/>` : ''
  const sp = `<w:spacing w:before="${opts?.before ?? 0}" w:after="${opts?.after ?? 120}"/>`
  const runs = arr.map(seg => {
    const b = seg.bold ? '<w:b/><w:bCs/>' : ''
    const sz = seg.size ? `<w:sz w:val="${seg.size * 2}"/><w:szCs w:val="${seg.size * 2}"/>` : '<w:sz w:val="22"/><w:szCs w:val="22"/>'
    const txt = seg.placeholder ? seg.text : x(seg.text)
    return `<w:r><w:rPr>${b}${sz}</w:rPr><w:t xml:space="preserve">${txt}</w:t></w:r>`
  }).join('')
  return `<w:p><w:pPr>${jc}${ind}${sp}</w:pPr>${runs}</w:p>`
}

function heading(text: string, level: 1 | 2 = 2): string {
  if (level === 1) {
    return para({ text, bold: true, size: 16 }, { center: true, before: 160, after: 80 })
  }
  // level 2: section heading with border bottom (using paragraph border)
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="200" w:after="100"/>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="FFC93C"/></w:pBdr>
    </w:pPr>
    <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="1A2744"/></w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r>
  </w:p>`
}

function labelRow(label: string, placeholder: string): string {
  return para([
    { text: label + ' ', bold: true },
    { text: placeholder, placeholder: true },
  ], { after: 60 })
}

function emptyLine(): string {
  return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`
}

function buildDocumentXml(d: SodDocData): string {
  const pdp = isPdp(d.typ)
  const zaloha = seZalohou(d.typ)

  const TYP_LABELS: Record<string, string> = {
    DPH_12_BEZ_ZALOHY: '12% DPH bez zálohy',
    DPH_12_SE_ZALOHOU: '12% DPH se zálohou',
    DPH_21_BEZ_ZALOHY: '21% DPH bez zálohy',
    DPH_21_SE_ZALOHOU: '21% DPH se zálohou',
    PDP_BEZ_ZALOHY: 'PDP bez zálohy',
    PDP_SE_ZALOHOU: 'PDP se zálohou',
  }

  const artNums = zaloha
    ? { odp: 'VI', zav: 'VII' }
    : { odp: 'V', zav: 'VI' }

  const zalohaSection = zaloha ? `
    ${heading(`Článek V. — Záloha`)}
    ${para([{ text: '5.1. Objednatel se zavazuje uhradit zálohu ve výši ' }, { text: '{{zaloha_kc}}', placeholder: true }, { text: ' Kč (kategorie: ' }, { text: '{{zaloha_kategorie}}', placeholder: true }, { text: ').' }])}
    ${para([{ text: '5.2. Záloha je splatná do ' }, { text: '{{zaloha_splatnost}}', placeholder: true }, { text: ' dnů od podpisu smlouvy.' }])}
    ${para({ text: '5.3. Záloha bude zohledněna při konečném vyúčtování díla.' })}
  ` : ''

  const dphParagraph = pdp
    ? para({ text: 'Tato smlouva podléhá režimu přenesení daňové povinnosti dle § 92a zákona č. 235/2004 Sb. o DPH. DPH přiznává a odvádí objednatel.' })
    : para([{ text: 'DPH ' }, { text: '{{dph_sazba}}', placeholder: true }, { text: ' % bude účtována dle platné legislativy.' }])

  const body = `
    ${heading('SMLOUVA O DÍLO', 1)}
    ${para({ text: 'uzavřená dle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník' }, { center: true, after: 40 })}
    ${para([{ text: 'Číslo smlouvy: ', bold: true }, { text: '{{cislo_sod}}', placeholder: true }, { text: '   |   Datum: ', bold: true }, { text: '{{datum}}', placeholder: true }, { text: '   |   Typ: ', bold: true }, { text: x(TYP_LABELS[d.typ]) }], { center: true, before: 80, after: 200 })}

    ${heading('Článek I. — Smluvní strany')}
    ${para({ text: 'Zhotovitel:', bold: true }, { after: 40 })}
    ${labelRow('Obchodní firma:', '{{org_nazev}}')}
    ${labelRow('Sídlo:', '{{org_sidlo}}')}
    ${labelRow('IČO:', '{{org_ico}}')}
    ${labelRow('DIČ:', '{{org_dic}}')}
    ${emptyLine()}
    ${para({ text: 'Objednatel:', bold: true }, { after: 40 })}
    ${labelRow('Jméno a příjmení:', '{{klient_jmeno}}')}
    ${labelRow('Adresa:', '{{klient_adresa}}')}
    ${labelRow('E-mail:', '{{klient_email}}')}
    ${labelRow('Telefon:', '{{klient_telefon}}')}
    ${labelRow('IČO:', '{{klient_ico}}')}
    ${labelRow('DIČ:', '{{klient_dic}}')}
    ${emptyLine()}
    ${para([{ text: '1.3. Kontaktní osoba objednatele: ' }, { text: '{{kontaktni_osoba}}', placeholder: true }, { text: ', tel.: ' }, { text: '{{kontaktni_telefon}}', placeholder: true }])}
    ${para({ text: 'Zhotovitel a objednatel jsou dále souhrnně označováni jako „smluvní strany".' })}

    ${heading('Článek II. — Předmět díla')}
    ${para({ text: '2.1. Zhotovitel se zavazuje provést pro objednatele následující dílo:' })}
    ${para([{ text: '{{predmet_dila}}', placeholder: true, bold: true, size: 12 }], { indent: 360, before: 60, after: 60 })}
    ${para([{ text: '2.2. Místem plnění je: ' }, { text: '{{adresa_dila}}', placeholder: true, bold: true }])}
    ${para({ text: '2.3. Zhotovitel se zavazuje provést dílo řádně, v souladu s platnými technickými normami a pokyny výrobce, a předat jej bez vad a nedodělků.' })}

    ${heading('Článek III. — Termín plnění')}
    ${labelRow('3.1. Termín převzetí staveniště:', '{{termin_prevzeti}}')}
    ${para([{ text: '3.2. Délka realizace: ' }, { text: '{{pocet_dni_realizace}}', placeholder: true }, { text: ' pracovních dnů.' }])}
    ${labelRow('3.3. Nejzazší termín změny objednávky:', '{{zmena_term}}')}
    ${para({ text: '3.4. Zhotovitel je oprávněn přerušit provádění díla v případě, že objednatel neposkytne potřebnou součinnost.' })}

    ${heading('Článek IV. — Cena díla a platební podmínky')}
    ${labelRow('4.1. Cena díla bez DPH:', '{{cena_bez_dph}} Kč')}
    ${labelRow(pdp ? '4.2. Celková cena (DPH v režimu PDP):' : `4.2. DPH ${pdp ? '' : '{{dph_sazba}}'} % / Celková cena s DPH:`, '{{cena_s_dph}} Kč')}
    ${dphParagraph}
    ${para({ text: '4.3. Cena je splatná na základě daňového dokladu vystaveného po předání díla. Faktura je splatná do 14 dnů od doručení objednateli.' })}
    ${para({ text: '4.4. V případě prodlení objednatele s úhradou je zhotovitel oprávněn účtovat smluvní pokutu ve výši 0,05 % z dlužné částky za každý den prodlení.' })}

    ${zalohaSection}

    ${heading(`Článek ${artNums.odp}. — Odpovědnost a záruky`)}
    ${para([{ text: `${artNums.odp}.1. Zhotovitel poskytuje na provedené dílo záruku v délce ` }, { text: '24 měsíců', bold: true }, { text: ' od předání díla objednateli.' }])}
    ${para({ text: `${artNums.odp}.2. Záruční lhůta počíná běžet dnem podpisu předávacího protokolu.` })}
    ${para({ text: `${artNums.odp}.3. Zhotovitel neodpovídá za škody způsobené nesprávným používáním, nedostatečnou údržbou nebo zásahy třetích osob.` })}
    ${para({ text: `${artNums.odp}.4. Reklamace musí být uplatněna písemně bez zbytečného odkladu po zjištění vady.` })}

    ${heading(`Článek ${artNums.zav}. — Závěrečná ustanovení`)}
    ${para({ text: `${artNums.zav}.1. Tato smlouva se řídí právním řádem České republiky, zejména zákonem č. 89/2012 Sb., občanský zákoník.` })}
    ${para({ text: `${artNums.zav}.2. Veškeré změny a doplňky smlouvy musí být provedeny písemným dodatkem podepsaným oběma smluvními stranami.` })}
    ${para({ text: `${artNums.zav}.3. Smlouva je vyhotovena ve dvou stejnopisech, z nichž každá smluvní strana obdrží jeden.` })}
    ${para({ text: `${artNums.zav}.4. Smluvní strany prohlašují, že si smlouvu přečetly, porozuměly jejímu obsahu a uzavřely ji svobodně a vážně.` })}

    ${heading('Podpisy smluvních stran')}
    ${para([{ text: 'V _______________________ dne ' }, { text: '{{datum}}', placeholder: true }], { before: 80, after: 240 })}

    <w:p>
      <w:pPr><w:spacing w:before="0" w:after="600"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">Zhotovitel: </w:t></w:r>
      <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{{org_nazev}}</w:t></w:r>
      <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:tab/></w:r>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">Objednatel: </w:t></w:r>
      <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{{klient_jmeno}}</w:t></w:r>
    </w:p>
    ${para([{ text: '...................................' }, { text: '                                        ' }, { text: '...................................' }], { after: 40 })}
    ${para([{ text: 'podpis + razítko' }, { text: '                                           ' }, { text: 'podpis' }], { after: 200 })}
  `

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

function buildContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
}

function buildRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
}

function buildWordRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function buildStyles(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="120"/></w:pPr>
    <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
</w:styles>`
}

export async function generateSodDocx(d: SodDocData): Promise<Buffer> {
  // Dynamic imports — these are CommonJS-compatible
  const PizZip = (await import('pizzip')).default
  const Docxtemplater = (await import('docxtemplater')).default

  // Build the template DOCX in memory
  const docXml = buildDocumentXml(d)

  const zip = new PizZip()
  zip.file('[Content_Types].xml', buildContentTypes())
  zip.file('_rels/.rels', buildRels())
  zip.folder('word')
  zip.file('word/document.xml', docXml)
  zip.file('word/styles.xml', buildStyles())
  zip.file('word/_rels/document.xml.rels', buildWordRels())

  // Fill placeholders with docxtemplater
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  })

  const fmtKc = (n: number | null | undefined) =>
    n != null ? formatCislo(n) : '—'

  doc.render({
    cislo_sod: d.cislo,
    datum: d.datum,
    klient_jmeno: d.klientJmeno ?? '—',
    klient_adresa: d.klientAdresa ?? '—',
    klient_email: d.klientEmail ?? '—',
    klient_telefon: d.klientTelefon ?? '—',
    klient_ico: d.klientIco ?? '—',
    klient_dic: d.klientDic ?? '—',
    kontaktni_osoba: d.kontaktniOsoba ?? '—',
    kontaktni_telefon: d.kontaktniTelefon ?? '—',
    predmet_dila: d.predmetDila,
    adresa_dila: d.adresaDila ?? '—',
    termin_prevzeti: d.terminPrevzeti ?? '—',
    pocet_dni_realizace: d.pocetDniRealizace != null ? String(d.pocetDniRealizace) : '—',
    zmena_term: d.zmenaTerm ?? '—',
    cena_bez_dph: fmtKc(d.cenaBezDph),
    cena_s_dph: fmtKc(d.cenaSDph),
    dph_sazba: String(d.dphSazba),
    zaloha_kc: fmtKc(d.zalohaKc),
    zaloha_splatnost: d.zalohaSplatnost != null ? String(d.zalohaSplatnost) : '14',
    zaloha_kategorie: d.zalohaKategorie ?? '—',
    org_nazev: d.org.nazev,
    org_sidlo: d.org.sidlo ?? '—',
    org_ico: d.org.ico ?? '—',
    org_dic: d.org.dic ?? '—',
  })

  const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  return buf
}
