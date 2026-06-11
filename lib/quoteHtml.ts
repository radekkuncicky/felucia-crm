import fs from 'fs/promises'
import path from 'path'

const techToTemplate: Record<string, string> = {
  TEPELNE_CERPADLO: 'cn-tepelne-cerpadlo.html',
  REKUPERACE: 'cn-rekuperace.html',
  KLIMA: 'cn-klimatizace.html',
  PODLAHOVE_TOPENI: 'cn-podlahove-topeni.html',
  VZDUCHOTECHNIKA: 'cn-vzduchotechnika.html',
  JINE: 'cn-jine.html',
}

type QuoteWithRelations = {
  id: string
  kod: string | null
  nazev: string
  popis: string | null
  dphSazba: number
  items: { nazev: string; mnozstvi: unknown; cenaZaKus: unknown; poznamky: string | null }[]
  deal: {
    kod: string | null
    technologie: string
    adresaDila: string | null
    hodnotaZalohy: unknown
    splatnostZalohy: Date | null
    dphSazba: number
    client: { jmeno: string; prijmeni: string; email: string | null; telefon: string | null; ulice?: string | null; mesto?: string | null; psc?: string | null; ico?: string | null; dic?: string | null }
    user: { jmeno: string; email: string; telefon: string | null } | null
    organization: { nazev: string; sidlo: string | null; email: string | null; ico: string | null }
  }
}

export async function buildQuoteHtml(quote: QuoteWithRelations): Promise<string> {
  const { deal } = quote
  const org = deal.organization
  const client = deal.client
  const user = deal.user

  const templateFile = techToTemplate[deal.technologie] ?? 'cn-jine.html'
  const templatePath = path.join(process.cwd(), 'public', 'templates', templateFile)
  let html = await fs.readFile(templatePath, 'utf-8')

  // Compute totals
  const bezDph = quote.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus), 0)
  const dphSazba = Number(quote.dphSazba ?? deal.dphSazba)
  const dphCastka = bezDph * (dphSazba / 100)
  const sDph = bezDph + dphCastka
  // Záloha: 70% from price WITH DPH
  const zaloha = deal.hodnotaZalohy ? Number(deal.hodnotaZalohy) : Math.round(sDph * 0.7)

  const fmt = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const today = new Date().toLocaleDateString('cs-CZ')

  const jmeno = user?.jmeno ?? ''
  const jmenoParts = jmeno.split(' ')
  const krestni = jmenoParts[0] ?? ''
  const prijmeni = jmenoParts.slice(1).join(' ')
  const inicialy = jmenoParts.map(p => p[0] ?? '').join('').toUpperCase()

  const replacements: Record<string, string> = {
    '{{nabidka_kod}}': quote.kod ?? '',
    '{{kod_op}}': deal.kod ?? '',
    '{{klient_jmeno}}': `${client.jmeno} ${client.prijmeni}`.trim(),
    '{{klient_email}}': client.email ?? '',
    '{{klient_telefon}}': client.telefon ?? '',
    '{{klient_adresa}}': [client.ulice, [client.mesto, client.psc].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    '{{klient_ico}}': client.ico ?? '',
    '{{klient_dic}}': client.dic ?? '',
    '{{adresa_dila}}': deal.adresaDila ?? '',
    '{{obchodnik_inicialy}}': inicialy,
    '{{obchodnik_krestni}}': krestni,
    '{{obchodnik_prijmeni}}': prijmeni,
    '{{obchodnik_telefon}}': user?.telefon ?? '',
    '{{obchodnik_email}}': user?.email ?? '',
    '{{datum_dnes}}': today,
    '{{hodnota_bez_dph}}': fmt(bezDph),
    '{{dph_sazba}}': String(dphSazba),
    '{{dph_castka}}': fmt(dphCastka),
    '{{hodnota_s_dph}}': fmt(sDph),
    '{{hodnota_zalohy}}': fmt(zaloha),
    '{{splatnost_zalohy}}': deal.splatnostZalohy
      ? new Date(deal.splatnostZalohy).toLocaleDateString('cs-CZ')
      : '',
    '{{org_sidlo}}': org.sidlo ?? org.nazev,
    '{{org_email}}': org.email ?? '',
    '{{org_ico}}': org.ico ?? '',
    '{{popis}}': quote.popis ?? '',
  }

  for (const [key, val] of Object.entries(replacements)) {
    html = html.replaceAll(key, val)
  }

  // {{#ma_popis}}...{{/ma_popis}} conditional
  if (!quote.popis) {
    html = html.replace(/\{\{#ma_popis\}\}[\s\S]*?\{\{\/ma_popis\}\}/g, '')
  } else {
    html = html.replace(/\{\{#ma_popis\}\}/g, '').replace(/\{\{\/ma_popis\}\}/g, '')
  }

  // {{#polozky}}...{{/polozky}} loop
  const polozkyMatch = html.match(/\{\{#polozky\}\}([\s\S]*?)\{\{\/polozky\}\}/)
  if (polozkyMatch) {
    const rowTemplate = polozkyMatch[1]
    const rows = quote.items.map((item, idx) => {
      const mnozstvi = Number(item.mnozstvi)
      const cena = Number(item.cenaZaKus)
      const total = mnozstvi * cena
      let row = rowTemplate
      row = row.replace(/\{\{polozka_cislo\}\}/g, String(idx + 1))
      row = row.replace(/\{\{polozka_nazev\}\}/g, item.nazev)
      row = row.replace(/\{\{polozka_mnozstvi\}\}/g, String(mnozstvi))
      row = row.replace(/\{\{polozka_cena_za_kus\}\}/g, fmt(cena))
      row = row.replace(/\{\{polozka_celkem\}\}/g, fmt(total))
      row = row.replace(/\{\{polozka_poznamky\}\}/g, item.poznamky ?? '')
      return row
    }).join('')
    html = html.replace(/\{\{#polozky\}\}[\s\S]*?\{\{\/polozky\}\}/g, rows)
  }

  return html
}
