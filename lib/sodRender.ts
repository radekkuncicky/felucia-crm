import { prisma } from './prisma'
import { predmetDilaByTechnologie } from './sodHelpers'

export interface SodRenderData {
  cisloSmlouvy: string
  datum: string
  klientJmeno: string
  klientAdresa: string
  klientEmail: string
  klientTelefon: string
  klientIco: string
  klientDic: string
  kontaktniOsoba: string
  kontaktniTelefon: string
  predmet: string
  adresaDila: string
  obchodnik: string
  terminRealizace: string
  terminPrevzeti: string
  pocetDniRealizace: string
  hodnotaZalohy: string
  zalohaSplatnost: string
  konecnaCena: string
  cenaSDph: string
  dphSazba: string
  kodOP: string
  organizace: string
  orgSidlo: string
  orgIco: string
  orgDic: string
}

export async function buildSodRenderData(dealId: string, orgId: string, cisloSmlouvy: string): Promise<SodRenderData> {
  const [deal, org] = await Promise.all([
    prisma.deal.findFirst({
      where: { id: dealId, orgId },
      include: {
        client: true,
        user: { select: { jmeno: true } },
        quotes: {
          where: { aktivni: true },
          include: { items: true },
          take: 1,
        },
      },
    }),
    prisma.organization.findFirst({
      where: { id: orgId },
      select: { nazev: true, sidlo: true, ico: true, dic: true },
    }),
  ])

  if (!deal || !org) throw new Error('Deal nebo organizace nenalezena')

  const quote = deal.quotes[0] ?? null
  const cenaBezDph = quote
    ? quote.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100), 0)
    : 0
  const dphSazba = Number(quote?.dphSazba ?? 21)
  const cenaSDph = cenaBezDph * (1 + dphSazba / 100)

  const klientJmeno = `${deal.client.jmeno} ${deal.client.prijmeni}`.trim()
  const klientAdresa = [deal.client.ulice, deal.client.psc, deal.client.mesto].filter(Boolean).join(', ')
  const adresaDila = deal.adresaDila ?? klientAdresa ?? ''

  const fmtKc = (n: number) => Math.round(n).toLocaleString('cs-CZ') + ' Kč'
  const fmtDate = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString('cs-CZ') : ''

  return {
    cisloSmlouvy,
    datum: new Date().toLocaleDateString('cs-CZ'),
    klientJmeno,
    klientAdresa,
    klientEmail: deal.client.email ?? '',
    klientTelefon: deal.client.telefon ?? '',
    klientIco: deal.client.ico ?? '',
    klientDic: deal.client.dic ?? '',
    kontaktniOsoba: deal.kontaktniOsoba ?? klientJmeno,
    kontaktniTelefon: deal.kontaktniTelefon ?? deal.client.telefon ?? '',
    predmet: deal.predmet ?? predmetDilaByTechnologie(deal.technologie ?? ''),
    adresaDila,
    obchodnik: deal.user?.jmeno ?? '',
    terminRealizace: fmtDate(deal.terminRealizace),
    terminPrevzeti: fmtDate(deal.terminPrevzeti),
    pocetDniRealizace: '',
    hodnotaZalohy: deal.hodnotaZalohy ? fmtKc(Number(deal.hodnotaZalohy)) : fmtKc(Math.round(cenaSDph * 0.7)),
    zalohaSplatnost: '14',
    konecnaCena: fmtKc(Math.round(cenaBezDph)),
    cenaSDph: fmtKc(Math.round(cenaSDph)),
    dphSazba: String(dphSazba),
    kodOP: deal.kod ?? '',
    organizace: org.nazev ?? '',
    orgSidlo: org.sidlo ?? '',
    orgIco: org.ico ?? '',
    orgDic: org.dic ?? '',
  }
}

export function renderSodTemplate(obsah: string, data: SodRenderData): string {
  const map: Record<string, string> = {
    '{{cislo_smlouvy}}': data.cisloSmlouvy,
    '{{datum}}': data.datum,
    '{{klient_jmeno}}': data.klientJmeno,
    '{{klient_adresa}}': data.klientAdresa,
    '{{klient_email}}': data.klientEmail,
    '{{klient_telefon}}': data.klientTelefon,
    '{{klient_ico}}': data.klientIco,
    '{{klient_dic}}': data.klientDic,
    '{{kontaktni_osoba}}': data.kontaktniOsoba,
    '{{kontaktni_telefon}}': data.kontaktniTelefon,
    '{{predmet}}': data.predmet,
    '{{adresa_dila}}': data.adresaDila,
    '{{obchodnik}}': data.obchodnik,
    '{{termin_realizace}}': data.terminRealizace,
    '{{termin_prevzeti}}': data.terminPrevzeti,
    '{{pocet_dni_realizace}}': data.pocetDniRealizace,
    '{{hodnota_zalohy}}': data.hodnotaZalohy,
    '{{zaloha_splatnost}}': data.zalohaSplatnost,
    '{{konecna_cena}}': data.konecnaCena,
    '{{cena_s_dph}}': data.cenaSDph,
    '{{dph_sazba}}': data.dphSazba,
    '{{kod_op}}': data.kodOP,
    '{{organizace}}': data.organizace,
    '{{org_sidlo}}': data.orgSidlo,
    '{{org_ico}}': data.orgIco,
    '{{org_dic}}': data.orgDic,
  }

  return Object.entries(map).reduce(
    (text, [placeholder, value]) => text.replaceAll(placeholder, value ?? ''),
    obsah
  )
}
