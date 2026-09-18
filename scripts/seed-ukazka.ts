/**
 * Ukázková organizace „Klima Servis Ukázka s.r.o." (slug `applereview`) —
 * slouží pro screenshoty na web, TestFlight/Apple review demo účet a osobní
 * ukázky. Naplní ji smyšlenými klienty, OP + nabídkami, zakázkami s přiřazeným
 * technikem, předávákem a vyúčtováním, servisem (zařízení, kontrakty, zásahy)
 * a produkty zkopírovanými z knihovny NANTO (jen produkty — žádní klienti,
 * adresy ani telefony).
 *
 * Idempotentní: opakované spuštění smaže obsah org a založí ho znovu; účty
 * zůstávají (upsert podle e-mailu), takže funguje i jako reset před ukázkou.
 *
 * Hesla z .env: SEED_ADMIN_PASSWORD (admin), SEED_TECHNIK_PASSWORD (technici
 * i obchodník) — nejsou v gitu.
 *
 * Run: npx tsx scripts/seed-ukazka.ts
 */

import {
  PrismaClient, ZakazkaStav, ZakazkaPolozkaStav, EtapaStav, PredavakStav, VyuctovaniStav,
  StavDealu, Technologie, TypAktivity, ActivityStav, ZarizeniTyp, ServisTyp, NavstevaTyp,
  ServisniZakazkaStav, ServisniPolozkaTyp,
} from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import { seedOrgDefaults } from '../lib/orgDefaults'
import { orgPrisma } from '../lib/orgPrisma'
import { createSodFromDeal } from '../lib/sodCreate'
import { buildSodBaseHtml } from '../lib/sodHtml'
import { sha256 } from '../lib/sodPodpis'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const SLUG = 'applereview'
const SOURCE_SLUG = 'nanto'

const USERS = {
  admin:     { email: 'admin.applereview@felucia.io', jmeno: 'Jana Ukázková', role: 'ADMIN' as const,     telefon: '+420 777 000 101' },
  obchodnik: { email: 'obchod.demo@felucia.io',       jmeno: 'Martin Obchodník', role: 'OBCHODNIK' as const, telefon: '+420 777 000 102' },
  technik:   { email: 'technik.demo@felucia.io',      jmeno: 'Tomáš Technik', role: 'TECHNIK' as const,    telefon: '+420 777 000 103' },
  technik2:  { email: 'technik2.demo@felucia.io',     jmeno: 'Petr Montér', role: 'TECHNIK' as const,      telefon: '+420 777 000 104' },
}

function requireEnv(name: string) {
  const val = process.env[name]
  if (!val) {
    console.error(`✗ Chybí ${name} v .env — bez něj by seed nastavil neznámé heslo.`)
    process.exit(1)
  }
  return val
}
const ADMIN_PASSWORD = requireEnv('SEED_ADMIN_PASSWORD')
const TECHNIK_PASSWORD = requireEnv('SEED_TECHNIK_PASSWORD')

// Produktové řady / kódy z knihovny NANTO, které se zkopírují (jen produkty).
const COPY_RADY = ['AIRY', 'CEBU', 'LUZON', 'AVANT', 'COMFORT', 'PULAR', 'CLIVIA', 'Příslušenství', 'Zásobník TV', 'Filtr']
const COPY_KODY = ['Cu6/10', 'Cu6/12', 'Cu6/16', 'MontCelkem', 'DoprRAC', 'Doprava_TC', 'KONZ1', 'VZT_POTR', 'VZT_EPP', 'MONT_VZT_2E', 'VZT-doprava', '3210408', '3210409', '3215063']
const COPY_NAZVY = ['Daikin Altherma 3 R 8kW - tepelné čerpadlo', 'Montáž klimatizace - split systém']

/** Smyšlený podpis jako data URI (detail SOD i PDF ho kreslí přes <img>). */
const podpisDataUri = (path: string) =>
  'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="${path}" fill="none" stroke="#1A2E1B" stroke-width="2.5" stroke-linecap="round"/></svg>`).toString('base64')

const d = (offsetDays: number, hour = 8, minute = 0) => {
  const x = new Date()
  x.setDate(x.getDate() + offsetDays)
  x.setHours(hour, minute, 0, 0)
  return x
}

async function resetOrgContent(orgId: string) {
  // Děti → rodiče; modely bez orgId přes relaci.
  await prisma.servisniPolozka.deleteMany({ where: { orgId } })
  await prisma.servisniZakazka.deleteMany({ where: { orgId } })
  await prisma.servisniKontrakt.deleteMany({ where: { orgId } })
  await prisma.zarizeni.deleteMany({ where: { orgId } })
  await prisma.sodUdalost.deleteMany({ where: { orgId } })
  await prisma.sodPodpisRelace.deleteMany({ where: { orgId } })
  await prisma.sodVerze.deleteMany({ where: { orgId } })
  await prisma.sod.deleteMany({ where: { orgId } })
  await prisma.vyuctovaniPolozka.deleteMany({ where: { vyuctovani: { orgId } } })
  await prisma.vyuctovani.deleteMany({ where: { orgId } })
  await prisma.predavakPolozka.deleteMany({ where: { predavak: { orgId } } })
  await prisma.predavakFoto.deleteMany({ where: { predavak: { orgId } } })
  await prisma.predavak.deleteMany({ where: { orgId } })
  await prisma.skladPohyb.deleteMany({ where: { orgId } })
  await prisma.zakazkaKomentar.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazkaFoto.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakázkaDokument.deleteMany({ where: { orgId } })
  await prisma.zakazkaKontakt.deleteMany({ where: { orgId } })
  await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.technikZakazka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazkaEtapa.deleteMany({ where: { orgId } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.sodPodpisRelace.deleteMany({ where: { orgId } })
  await prisma.sodUdalost.deleteMany({ where: { orgId } })
  await prisma.sodVerze.deleteMany({ where: { orgId } })
  await prisma.sod.deleteMany({ where: { orgId } })
  await prisma.zamereniFoto.deleteMany({ where: { orgId } })
  await prisma.zamereni.deleteMany({ where: { orgId } })
  await prisma.photo.deleteMany({ where: { orgId } })
  await prisma.activity.deleteMany({ where: { deal: { orgId } } })
  await prisma.quoteItem.deleteMany({ where: { deal: { orgId } } })
  await prisma.quote.deleteMany({ where: { orgId } })
  await prisma.leadNote.deleteMany({ where: { lead: { orgId } } })
  await prisma.lead.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.cenikPolozka.deleteMany({ where: { cenik: { orgId } } })
  await prisma.cenik.deleteMany({ where: { orgId } })
  await prisma.product.deleteMany({ where: { orgId } })
  await prisma.category.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.aiUsageLog.deleteMany({ where: { orgId } })
}

async function main() {
  console.log('🌱 Seed ukázkové organizace…')

  // ── Org ───────────────────────────────────────────────────────────────────
  const orgData = {
    nazev: 'Klima Servis Ukázka s.r.o.',
    email: 'info@klimaservis-ukazka.cz',
    telefon: '+420 777 000 100',
    ico: '99999999',
    dic: 'CZ99999999',
    sidlo: 'Ukázková 1, 702 00 Ostrava',
    web: 'https://felucia.io',
    plan: 'PROFESSIONAL' as const,
    aktivni: true,
    onboardingDone: true,
    onboardingStep: 99,
  }
  const org = await prisma.organization.upsert({
    where: { slug: SLUG },
    create: { slug: SLUG, ...orgData },
    update: orgData,
  })
  await resetOrgContent(org.id)
  console.log('  ✓ Org připravena, obsah vyčištěn')

  await prisma.orgSettings.upsert({
    where: { orgId: org.id },
    create: { orgId: org.id, modulServis: true, modulDokumenty: true, modulAnalytiky: true, modulLeady: true, primaryColor: '#4CAF50', zobrazitNakladoveCeny: true, singleTemplate: false },
    update: { modulServis: true, modulDokumenty: true, modulAnalytiky: true, modulLeady: true, primaryColor: '#4CAF50', zobrazitNakladoveCeny: true, singleTemplate: false },
  })

  const hasTemplate = await prisma.quoteTemplate.findFirst({ where: { orgId: org.id } })
  if (!hasTemplate) await prisma.$transaction(tx => seedOrgDefaults(tx, org.id))
  const template = await prisma.quoteTemplate.findFirst({ where: { orgId: org.id, isDefault: true } })

  // ── Uživatelé (upsert podle e-mailu — hesla se vždy nastaví znovu) ────────
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const technikHash = await bcrypt.hash(TECHNIK_PASSWORD, 12)
  const u: Record<keyof typeof USERS, { id: string }> = {} as never
  for (const [key, def] of Object.entries(USERS) as [keyof typeof USERS, typeof USERS[keyof typeof USERS]][]) {
    const hesloHash = def.role === 'ADMIN' ? adminHash : technikHash
    // Technici navíc vidí své servisní zásahy (kvůli screenshotům servisu v appce).
    const permissions = def.role === 'TECHNIK' ? { servis: 'VLASTNI' } : undefined
    const existing = await prisma.user.findFirst({ where: { email: def.email, orgId: org.id } })
    u[key] = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { jmeno: def.jmeno, role: def.role, telefon: def.telefon, hesloHash, aktivni: true, permissions } })
      : await prisma.user.create({ data: { orgId: org.id, email: def.email, jmeno: def.jmeno, role: def.role, telefon: def.telefon, hesloHash, aktivni: true, permissions } })
  }
  await prisma.orgSettings.update({ where: { orgId: org.id }, data: { zakazkyDefaultVedouciId: u.admin.id, obchodnikJmeno: USERS.obchodnik.jmeno, obchodnikTelefon: USERS.obchodnik.telefon } })
  console.log('  ✓ Uživatelé:', Object.values(USERS).map(x => x.email).join(', '))

  // ── Kategorie + produkty zkopírované z NANTO ─────────────────────────────
  // Zdroj produktů: org `nanto` v téže DB; když tam není (např. nanto_crm_test
  // při pořizování snímků pro web), čte se read-only z SEED_SOURCE_DATABASE_URL.
  let srcPrisma = prisma
  let src = await prisma.organization.findUnique({ where: { slug: SOURCE_SLUG } })
  if (!src && process.env.SEED_SOURCE_DATABASE_URL) {
    srcPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.SEED_SOURCE_DATABASE_URL }) })
    src = await srcPrisma.organization.findUnique({ where: { slug: SOURCE_SLUG } })
  }
  if (!src) throw new Error(`Zdrojová org ${SOURCE_SLUG} nenalezena (ani přes SEED_SOURCE_DATABASE_URL)`)
  const srcCategories = await srcPrisma.category.findMany({ where: { orgId: src.id }, orderBy: { poradi: 'asc' } })
  const catMap = new Map<string, string>()
  for (const c of srcCategories) {
    const nc = await prisma.category.create({ data: { orgId: org.id, nazev: c.nazev, barva: c.barva, poradi: c.poradi } })
    catMap.set(c.id, nc.id)
  }
  const extraCats: Record<string, string> = {}
  const extraDefs: [string, string][] = [['Tepelná čerpadla', '#2E7D32'], ['Materiál a práce', '#A0845C']]
  for (let i = 0; i < extraDefs.length; i++) {
    const [nazev, barva] = extraDefs[i]
    const c = await prisma.category.create({ data: { orgId: org.id, nazev, barva, poradi: srcCategories.length + i } })
    extraCats[nazev] = c.id
  }

  const srcProducts = await srcPrisma.product.findMany({
    where: {
      orgId: src.id, aktivni: true,
      OR: [{ produktovaRada: { in: COPY_RADY } }, { kod: { in: COPY_KODY } }, { nazev: { in: COPY_NAZVY } }],
    },
    include: { categories: { select: { id: true } } },
    orderBy: [{ produktovaRada: 'asc' }, { nazev: 'asc' }],
  })
  const prodByKod = new Map<string, { id: string; nazev: string; jednotka: string; cena: number; nakup: number | null }>()
  const prodByNazev = new Map<string, { id: string; nazev: string; jednotka: string; cena: number; nakup: number | null }>()
  for (const p of srcProducts) {
    let cats = p.categories.map(c => catMap.get(c.id)).filter((x): x is string => !!x)
    if (p.nazev.toLowerCase().includes('tepeln') || p.produktovaRada === '200-A') cats = [extraCats['Tepelná čerpadla']]
    if (/^(Cu|Mont|Dopr|KONZ|VZT)/.test(p.kod ?? '') || p.nazev.startsWith('Montáž')) cats = [extraCats['Materiál a práce']]
    const np = await prisma.product.create({
      data: {
        orgId: org.id, kod: p.kod, nazev: p.nazev, produktovaRada: p.produktovaRada, jednotka: p.jednotka, popis: p.popis,
        dphSazba: p.dphSazba, standardniCena: p.standardniCena, nakladovaCena: p.nakladovaCena,
        objednaciKod: p.objednaciKod, dodaciLhuta: p.dodaciLhuta, aktivni: true,
        categories: cats.length ? { connect: cats.map(id => ({ id })) } : undefined,
      },
    })
    const rec = { id: np.id, nazev: np.nazev, jednotka: np.jednotka, cena: Number(np.standardniCena), nakup: np.nakladovaCena ? Number(np.nakladovaCena) : null }
    if (np.kod) prodByKod.set(np.kod, rec)
    prodByNazev.set(np.nazev, rec)
  }
  console.log(`  ✓ Produkty: ${srcProducts.length} zkopírováno z ${SOURCE_SLUG} (${srcCategories.length + 2} kategorií)`)
  if (srcPrisma !== prisma) await srcPrisma.$disconnect()

  // pomocné položky (fallback, když by konkrétní produkt v knihovně chyběl)
  const P = (kodOrNazev: string, fallback: { nazev: string; jednotka?: string; cena: number; nakup?: number }) =>
    prodByKod.get(kodOrNazev) ?? prodByNazev.get(kodOrNazev) ?? { id: undefined as string | undefined, nazev: fallback.nazev, jednotka: fallback.jednotka ?? 'ks', cena: fallback.cena, nakup: fallback.nakup ?? null }
  const anyRada = (rada: string, idx = 0) => srcProducts.filter(p => p.produktovaRada === rada)[idx]
  const unit = (rada: string, idx = 0) => {
    const s = anyRada(rada, idx)
    return s ? prodByNazev.get(s.nazev)! : P('x', { nazev: `Klimatizace ${rada}`, cena: 24900, nakup: 17400 })
  }
  const potrubi = P('Cu6/10', { nazev: 'Cu potrubí 6/10 dual', jednotka: 'm', cena: 400, nakup: 170 })
  const konzola = P('KONZ1', { nazev: 'Fasádní konzola přiznaná bílá', cena: 1700, nakup: 900 })
  const montaz = P('Montáž klimatizace - split systém', { nazev: 'Montáž klimatizace - split systém', cena: 8500, nakup: 4000 })
  const doprava = P('DoprRAC', { nazev: 'Doprava', jednotka: 'km', cena: 8, nakup: 8 })
  const tc = P('Daikin Altherma 3 R 8kW - tepelné čerpadlo', { nazev: 'Tepelné čerpadlo vzduch-voda 8 kW', cena: 189000, nakup: 145000 })
  const tcKonzola = P('3210409', { nazev: 'Konzola pro venkovní jednotku — na zem', cena: 5190, nakup: 3633 })
  const tcProtimraz = P('3215063', { nazev: 'Systém protimrazové ochrany', cena: 10340, nakup: 7238 })
  const tcDoprava = P('Doprava_TC', { nazev: 'Doprava TČ', cena: 1700, nakup: 1190 })
  const montazTc = P('MontCelkem', { nazev: 'Montáž', cena: 12000, nakup: 0 })

  // ── Klienti (smyšlení) ───────────────────────────────────────────────────
  const mk = (data: Parameters<typeof prisma.client.create>[0]['data']) => prisma.client.create({ data })
  const cl = {
    horak:    await mk({ orgId: org.id, typKlienta: 'FYZICKA_OSOBA', jmeno: 'Petr', prijmeni: 'Horák', telefon: '+420 777 000 201', email: 'petr.horak@example.cz', ulice: 'Sadová 14', mesto: 'Ostrava', psc: '702 00' }),
    novakova: await mk({ orgId: org.id, typKlienta: 'FYZICKA_OSOBA', jmeno: 'Eva', prijmeni: 'Nováková', telefon: '+420 777 000 202', email: 'eva.novakova@example.cz', ulice: 'Lipová 8', mesto: 'Frýdek-Místek', psc: '738 01' }),
    penzion:  await mk({ orgId: org.id, typKlienta: 'FIRMA', jmeno: 'Penzion U Lípy', prijmeni: 's.r.o.', telefon: '+420 777 000 203', email: 'recepce@penzion-ulipy.example', ico: '11223344', dic: 'CZ11223344', ulice: 'Beskydská 120', mesto: 'Frenštát pod Radhoštěm', psc: '744 01' }),
    dvorak:   await mk({ orgId: org.id, typKlienta: 'FYZICKA_OSOBA', jmeno: 'Martin', prijmeni: 'Dvořák', telefon: '+420 777 000 204', email: 'm.dvorak@example.cz', ulice: 'Polní 33', mesto: 'Hlučín', psc: '748 01' }),
    kancelare: await mk({ orgId: org.id, typKlienta: 'FIRMA', jmeno: 'Moravia Office Park', prijmeni: 'a.s.', telefon: '+420 777 000 205', email: 'sprava@mop.example', ico: '55667788', ulice: 'Nádražní 200', mesto: 'Ostrava', psc: '702 00' }),
    svoboda:  await mk({ orgId: org.id, typKlienta: 'FYZICKA_OSOBA', jmeno: 'Lucie', prijmeni: 'Svobodová', telefon: '+420 777 000 206', email: 'lucie.s@example.cz', ulice: 'Na Výsluní 5', mesto: 'Opava', psc: '746 01' }),
    skolka:   await mk({ orgId: org.id, typKlienta: 'FIRMA', jmeno: 'Mateřská škola Sluníčko', prijmeni: 'p. o.', telefon: '+420 777 000 207', email: 'reditelka@ms-slunicko.example', ico: '99887766', ulice: 'Školní 2', mesto: 'Havířov', psc: '736 01' }),
    benes:    await mk({ orgId: org.id, typKlienta: 'FYZICKA_OSOBA', jmeno: 'Tomáš', prijmeni: 'Beneš', telefon: '+420 777 000 208', email: 't.benes@example.cz', ulice: 'Zahradní 17', mesto: 'Karviná', psc: '733 01' }),
  }
  console.log('  ✓ Klienti:', Object.keys(cl).length)

  // ── Obchodní případy + nabídky + aktivity ────────────────────────────────
  type Item = { p: ReturnType<typeof P>; mnozstvi: number }
  async function createDeal(opts: {
    kod: string; client: { id: string }; tech: Technologie; stav: StavDealu; predmet: string; adresa: string;
    user: { id: string }; items?: Item[]; nabKod?: string; terminRealizace?: Date; poznamky?: string; vytvoreno?: Date
  }) {
    const deal = await prisma.deal.create({
      data: {
        orgId: org.id, clientId: opts.client.id, userId: opts.user.id, kod: opts.kod, technologie: opts.tech, stav: opts.stav,
        predmet: opts.predmet, adresaDila: opts.adresa, terminRealizace: opts.terminRealizace, poznamky: opts.poznamky,
        vytvoreno: opts.vytvoreno,
      },
    })
    if (opts.items) {
      const quote = await prisma.quote.create({
        data: { orgId: org.id, dealId: deal.id, templateId: template?.id, kod: opts.nabKod, nazev: 'Nabídka', aktivni: true, platnostDo: d(30) },
      })
      await prisma.quoteItem.createMany({
        data: opts.items.map((it, i) => ({
          dealId: deal.id, quoteId: quote.id, productId: it.p.id, nazev: it.p.nazev, mnozstvi: it.mnozstvi, jednotka: it.p.jednotka,
          cenaZaKus: it.p.cena, nakupniCena: it.p.nakup, poradi: i,
        })),
      })
    }
    return deal
  }

  const splitItems = (rada: string, ks: number, m: number): Item[] => [
    { p: unit(rada, 0), mnozstvi: ks }, { p: potrubi, mnozstvi: m }, { p: konzola, mnozstvi: ks }, { p: montaz, mnozstvi: ks }, { p: doprava, mnozstvi: 40 },
  ]

  const dealHorak = await createDeal({ kod: 'OP-26-101', client: cl.horak, tech: 'KLIMA', stav: 'USPECH', predmet: 'Klimatizace do bytu 3+kk (2 vnitřní jednotky)', adresa: 'Sadová 14, 702 00 Ostrava', user: u.obchodnik, items: splitItems('AIRY', 2, 10), nabKod: 'NAB-26-0101', terminRealizace: d(0), vytvoreno: d(-21), poznamky: 'Byt ve 4. patře, venkovní jednotka na balkon (přiznaná konzola). Klient chce tichý režim v ložnici — doporučena řada AIRY.' })
  const dealPenzion = await createDeal({ kod: 'OP-26-102', client: cl.penzion, tech: 'KLIMA', stav: 'USPECH', predmet: 'Klimatizace 6 pokojů penzionu', adresa: 'Beskydská 120, 744 01 Frenštát pod Radhoštěm', user: u.obchodnik, items: splitItems('CEBU', 6, 42), nabKod: 'NAB-26-0102', terminRealizace: d(1), vytvoreno: d(-30) })
  const dealNovakova = await createDeal({ kod: 'OP-26-098', client: cl.novakova, tech: 'TEPELNE_CERPADLO', stav: 'USPECH', predmet: 'Tepelné čerpadlo vzduch-voda 8 kW pro RD', adresa: 'Lipová 8, 738 01 Frýdek-Místek', user: u.obchodnik, items: [{ p: tc, mnozstvi: 1 }, { p: tcKonzola, mnozstvi: 1 }, { p: tcProtimraz, mnozstvi: 1 }, { p: montazTc, mnozstvi: 1 }, { p: tcDoprava, mnozstvi: 1 }], nabKod: 'NAB-26-0098', terminRealizace: d(-8), vytvoreno: d(-60) })
  const dealDvorak = await createDeal({ kod: 'OP-26-095', client: cl.dvorak, tech: 'KLIMA', stav: 'USPECH', predmet: 'Klimatizace ložnice + obývák', adresa: 'Polní 33, 748 01 Hlučín', user: u.obchodnik, items: splitItems('LUZON', 2, 12), nabKod: 'NAB-26-0095', terminRealizace: d(-25), vytvoreno: d(-70) })
  const dealKancelare = await createDeal({ kod: 'OP-26-105', client: cl.kancelare, tech: 'KLIMA', stav: 'PRED_UZAVRENIM', predmet: 'Klimatizace open-space 3. NP (multisplit)', adresa: 'Nádražní 200, 702 00 Ostrava', user: u.obchodnik, items: splitItems('AVANT', 4, 60), nabKod: 'NAB-26-0105', terminRealizace: d(14), vytvoreno: d(-10), poznamky: 'Čeká se na schválení rozpočtu správní radou.' })
  const dealSvoboda = await createDeal({ kod: 'OP-26-106', client: cl.svoboda, tech: 'KLIMA', stav: 'NABIDKA', predmet: 'Klimatizace do podkroví', adresa: 'Na Výsluní 5, 746 01 Opava', user: u.obchodnik, items: splitItems('COMFORT', 1, 8), nabKod: 'NAB-26-0106', vytvoreno: d(-5) })
  const dealSkolka = await createDeal({ kod: 'OP-26-107', client: cl.skolka, tech: 'REKUPERACE', stav: 'JEDNANI', predmet: 'Rekuperace pro 2 třídy MŠ', adresa: 'Školní 2, 736 01 Havířov', user: u.obchodnik, vytvoreno: d(-3), poznamky: 'Zaměření domluveno na příští týden.' })
  await createDeal({ kod: 'OP-26-108', client: cl.benes, tech: 'KLIMA', stav: 'NOVY', predmet: 'Poptávka z webu — klimatizace do RD', adresa: 'Zahradní 17, 733 01 Karviná', user: u.obchodnik, vytvoreno: d(-1) })
  await createDeal({ kod: 'OP-26-090', client: cl.benes, tech: 'TEPELNE_CERPADLO', stav: 'PAS', predmet: 'Tepelné čerpadlo — starší poptávka', adresa: 'Zahradní 17, 733 01 Karviná', user: u.obchodnik, vytvoreno: d(-90), poznamky: 'Klient zvolil jiného dodavatele kvůli termínu.' })

  await prisma.activity.createMany({
    data: [
      { dealId: dealKancelare.id, userId: u.obchodnik.id, resitelId: u.obchodnik.id, typ: TypAktivity.SCHUZKA, popis: 'Prezentace nabídky správní radě', misto: 'Nádražní 200, Ostrava', datum: d(2, 10), cas: '10:00', trvaniMin: 60, stav: ActivityStav.PLANOVANA },
      { dealId: dealSvoboda.id, userId: u.obchodnik.id, resitelId: u.obchodnik.id, typ: TypAktivity.HOVOR, popis: 'Follow-up k nabídce NAB-26-0106', datum: d(1, 9), cas: '09:00', trvaniMin: 15, stav: ActivityStav.PLANOVANA },
      { dealId: dealSkolka.id, userId: u.obchodnik.id, resitelId: u.technik.id, typ: TypAktivity.SCHUZKA, popis: 'Zaměření na místě — 2 třídy, rozvody v podhledu', misto: 'Školní 2, Havířov', datum: d(6, 13), cas: '13:00', trvaniMin: 90, stav: ActivityStav.PLANOVANA },
      { dealId: dealHorak.id, userId: u.obchodnik.id, resitelId: u.obchodnik.id, typ: TypAktivity.HOVOR, popis: 'Potvrzení termínu montáže', vysledek: 'Termín potvrzen, klient bude doma od 8:00.', datum: d(-2, 15), cas: '15:00', trvaniMin: 10, splneno: true, stav: ActivityStav.DOKONCENA },
      { dealId: dealPenzion.id, userId: u.obchodnik.id, resitelId: u.obchodnik.id, typ: TypAktivity.EMAIL, popis: 'Odeslána nabídka + harmonogram montáže', datum: d(-12, 11), cas: '11:00', splneno: true, stav: ActivityStav.DOKONCENA },
    ],
  })
  console.log('  ✓ Obchodní případy: 9 (5 s nabídkou), aktivity: 5')

  // ── Zakázky ──────────────────────────────────────────────────────────────
  type ZItem = { p: ReturnType<typeof P>; mnozstvi: number; stav: ZakazkaPolozkaStav; hotovo: boolean; pouzito?: number }
  async function createZakazka(opts: {
    cislo: string; deal?: { id: string }; client: { id: string }; nazev: string; tech: string; stav: ZakazkaStav; misto: string;
    od: Date; do_: Date; technici: { id: string }[]; pokyny?: string; poznamka?: string; items: ZItem[];
    kontakty?: { profese: string; jmeno: string; telefon: string; poznamka?: string }[]; komentare?: { user: { id: string }; text: string; kdy: Date }[];
    etapy?: { cislo: number; nazev: string; od: Date; do_: Date; stav: EtapaStav }[]; uzavreno?: Date
  }) {
    const z = await prisma.zakazka.create({
      data: {
        orgId: org.id, cislo: opts.cislo, opId: opts.deal?.id, klientId: opts.client.id, nazev: opts.nazev, technologie: opts.tech,
        vedouciId: u.admin.id, stav: opts.stav, mistoStavby: opts.misto, montazOd: opts.od, montazDo: opts.do_, pokyny: opts.pokyny, poznamka: opts.poznamka, uzavreno: opts.uzavreno,
      },
    })
    for (const t of opts.technici) await prisma.technikZakazka.create({ data: { zakazkaId: z.id, technikId: t.id } })
    await prisma.zakazkaPolozka.createMany({
      data: opts.items.map((it, i) => ({
        zakazkaId: z.id, nazev: it.p.nazev, mnozstvi: it.mnozstvi, jednotka: it.p.jednotka, prodejniCena: it.p.cena, nakupniCena: it.p.nakup,
        mnozstviPouzito: it.pouzito, stav: it.stav, hotovo: it.hotovo, poradi: i + 1,
      })),
    })
    if (opts.kontakty) await prisma.zakazkaKontakt.createMany({ data: opts.kontakty.map(k => ({ orgId: org.id, zakazkaId: z.id, ...k, vytvorilId: u.admin.id })) })
    if (opts.komentare) await prisma.zakazkaKomentar.createMany({ data: opts.komentare.map(k => ({ zakazkaId: z.id, userId: k.user.id, text: k.text, vytvoreno: k.kdy })) })
    const etapy: { id: string; cislo: number }[] = []
    if (opts.etapy) for (const e of opts.etapy) {
      const et = await prisma.zakazkaEtapa.create({ data: { orgId: org.id, zakazkaId: z.id, cislo: e.cislo, nazev: e.nazev, montazOd: e.od, montazDo: e.do_, stav: e.stav } })
      etapy.push({ id: et.id, cislo: e.cislo })
    }
    return { z, etapy }
  }

  // Dnes — probíhá, technik 1
  const zHorak = await createZakazka({
    cislo: '26-901', deal: dealHorak, client: cl.horak, nazev: 'Montáž klimatizace — byt 3+kk', tech: 'KLIMA', stav: 'V_REALIZACI',
    misto: 'Sadová 14, 702 00 Ostrava', od: d(0, 8), do_: d(0, 16), technici: [u.technik],
    pokyny: 'Zvonek „Horák", 4. patro, výtah funguje. Venkovní jednotka na balkon, vnitřní jednotky obývák + ložnice. Klient má psa — zavřít dveře na chodbu.',
    items: [
      { p: unit('AIRY', 0), mnozstvi: 2, stav: 'VYDANO', hotovo: true },
      { p: potrubi, mnozstvi: 10, stav: 'VYDANO', hotovo: true, pouzito: 12 },
      { p: konzola, mnozstvi: 1, stav: 'VYDANO', hotovo: true },
      { p: montaz, mnozstvi: 2, stav: 'VYDANO', hotovo: true, pouzito: 2 },
      { p: doprava, mnozstvi: 40, stav: 'VYDANO', hotovo: true, pouzito: 40 },
    ],
    kontakty: [
      { profese: 'Majitel', jmeno: 'Petr Horák', telefon: '+420 777 000 201' },
      { profese: 'Správce domu', jmeno: 'pan Kolář', telefon: '+420 777 000 301', poznamka: 'Klíče od střechy / technické místnosti' },
    ],
    komentare: [
      { user: u.admin, text: 'Zákazník bude doma od 8:00. Potrubí je v nabídce na 10 m, počítejte s rezervou.', kdy: d(-1, 16, 20) },
      { user: u.technik, text: 'Na místě. Venkovní jednotka namontována, vnitřní obě hotové. Potrubí vyšlo na 12 m kvůli vedení kolem překladu — zapíšu do protokolu.', kdy: d(0, 11, 5) },
      { user: u.technik, text: 'Hotovo, zprovozněno, klient proškolen. Předávák podepsán, posílám ke schválení.', kdy: d(0, 15, 40) },
    ],
    etapy: [{ cislo: 1, nazev: 'Montáž a zprovoznění', od: d(0, 8), do_: d(0, 16), stav: 'PREDANA' }],
  })
  // Horák je hrdina příběhu na webu (felucia.io): má celý řetěz OP → nabídka →
  // podepsaná SOD → zakázka → předávák (číslo sedí s mobilními snímky) →
  // vyúčtování ke schválení → zařízení v záruce + servisní kontrakt.
  {
    const db = orgPrisma(org.id)
    const sablona = await prisma.contractTemplate.findFirst({ where: { orgId: org.id }, orderBy: { vytvoreno: 'asc' } })
    const res = await createSodFromDeal(db, org.id, {
      dealId: dealHorak.id, templateId: sablona?.id ?? null, typ: 'DPH_12_SE_ZALOHOU',
      form: { terminRealizaceOd: d(0).toISOString().slice(0, 10), terminRealizaceDo: d(0).toISOString().slice(0, 10), pocetDniRealizace: 1, zalohaKc: 30000 },
    })
    if ('error' in res) throw new Error(`SOD Horák: ${res.error}`)
    const sod = await prisma.sod.findUniqueOrThrow({ where: { id: res.sod.id }, include: { organization: { select: { nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true } } } })
    const hash = sha256(buildSodBaseHtml(sod))
    await prisma.sod.update({
      where: { id: sod.id },
      data: {
        stav: 'PODEPSANO', vytvoreno: d(-19, 10),
        zhotovitelPodpisSvg: podpisDataUri('M20 60 C 50 10, 80 90, 110 50 S 170 20, 200 60 S 250 80, 280 30'), zhotovitelPodepsano: d(-19, 10, 30), zhotovitelPodepsalJmeno: USERS.admin.jmeno, zhotovitelPodepsalId: u.admin.id, zhotovitelTextHash: hash,
        podpisSvg: podpisDataUri('M30 70 C 60 20, 90 80, 130 40 S 200 30, 230 70 S 260 40, 280 50'), podepsano: d(-18, 19, 12), podepsalJmeno: 'Petr Horák', podpisTextHash: hash,
      },
    })
    await prisma.sodUdalost.createMany({
      data: [
        { orgId: org.id, sodId: sod.id, typ: 'PODEPSANO_ZHOTOVITELEM', userId: u.admin.id, meta: { jmeno: USERS.admin.jmeno }, vytvoreno: d(-19, 10, 30) },
        { orgId: org.id, sodId: sod.id, typ: 'ODESLANO', userId: u.obchodnik.id, meta: { email: 'petr.horak@example.cz' }, vytvoreno: d(-19, 10, 35) },
        { orgId: org.id, sodId: sod.id, typ: 'PODEPSANO', meta: { jmeno: 'Petr Horák' }, vytvoreno: d(-18, 19, 12) },
      ],
    })

    const polozky = await prisma.zakazkaPolozka.findMany({ where: { zakazkaId: zHorak.z.id }, orderBy: { poradi: 'asc' } })
    const pred = await prisma.predavak.create({
      data: {
        orgId: org.id, zakazkaId: zHorak.z.id, cislo: 'PP-26-032', technikId: u.technik.id, stav: PredavakStav.PODPISAN, klientPritomen: true,
        etapaId: zHorak.etapy[0]?.id, podpisano: d(0, 15, 35), poznamka: 'Potrubí 12 m místo 10 m (vedení kolem překladu). Klient proškolen na ovládání.',
        podpisSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="M30 70 C 60 20, 90 80, 130 40 S 200 30, 230 70 S 260 40, 280 50" fill="none" stroke="#1A2E1B" stroke-width="2.5" stroke-linecap="round"/></svg>',
      },
    })
    await prisma.predavakPolozka.createMany({
      data: polozky.map(p => ({ predavakId: pred.id, zakazkaPolozkaId: p.id, nazev: p.nazev, planovanoMnozstvi: p.mnozstvi, mnozstviPouzito: p.mnozstviPouzito ?? p.mnozstvi, jednotka: p.jednotka })),
    })
    const vy = await prisma.vyuctovani.create({
      data: { orgId: org.id, zakazkaId: zHorak.z.id, cislo: 'VYU-26-032', stav: VyuctovaniStav.KE_SCHVALENI, etapaId: zHorak.etapy[0]?.id, predavakId: pred.id, poznamka: 'Dle podepsaného předávacího protokolu PP-26-032.' },
    })
    await prisma.vyuctovaniPolozka.createMany({
      data: polozky.map((p, i) => ({ vyuctovaniId: vy.id, nazev: p.nazev, mnozstvi: p.mnozstviPouzito ?? p.mnozstvi, jednotka: p.jednotka, nakupniCena: p.nakupniCena, prodejniCena: p.prodejniCena ?? 0, poradi: i })),
    })
    await prisma.zakazka.update({ where: { id: zHorak.z.id }, data: { stav: 'PREDANA' } })
  }

  // Dnes odpoledne — technik 2 + technik 1, přiřazená
  await createZakazka({
    cislo: '26-904', client: cl.svoboda, nazev: 'Servisní prohlídka klimatizace — podkroví', tech: 'KLIMA', stav: 'PRIRAZENA',
    misto: 'Na Výsluní 5, 746 01 Opava', od: d(0, 14), do_: d(0, 16), technici: [u.technik2],
    pokyny: 'Jednotka v podkroví, přístup po skládacích schodech. Vzít náhradní filtry.',
    items: [
      { p: P('x', { nazev: 'Kontrola tlaku chladiva a těsnosti', cena: 900, nakup: 0 }), mnozstvi: 1, stav: 'CEKA', hotovo: false },
      { p: P('x', { nazev: 'Čištění filtrů a výparníku', cena: 700, nakup: 0 }), mnozstvi: 1, stav: 'CEKA', hotovo: false },
    ],
    kontakty: [{ profese: 'Majitelka', jmeno: 'Lucie Svobodová', telefon: '+420 777 000 206' }],
  })

  // Zítra–pozítří — penzion, 2 dny, oba technici, 2 etapy
  await createZakazka({
    cislo: '26-902', deal: dealPenzion, client: cl.penzion, nazev: 'Klimatizace 6 pokojů — Penzion U Lípy', tech: 'KLIMA', stav: 'PRIRAZENA',
    misto: 'Beskydská 120, 744 01 Frenštát pod Radhoštěm', od: d(1, 8), do_: d(2, 17), technici: [u.technik, u.technik2],
    pokyny: 'Hlásit se na recepci. Venkovní jednotky na severní fasádu (konzoly), průrazy přes obvodovou zeď 90 mm. 1. den pokoje 1–3, 2. den pokoje 4–6 + zprovoznění.',
    items: [
      { p: unit('CEBU', 0), mnozstvi: 6, stav: 'NASKLADNENO', hotovo: false },
      { p: potrubi, mnozstvi: 42, stav: 'NASKLADNENO', hotovo: false },
      { p: konzola, mnozstvi: 6, stav: 'OBJEDNANO', hotovo: false },
      { p: montaz, mnozstvi: 6, stav: 'CEKA', hotovo: false },
      { p: doprava, mnozstvi: 90, stav: 'CEKA', hotovo: false },
    ],
    kontakty: [
      { profese: 'Recepce', jmeno: 'Recepce penzionu', telefon: '+420 777 000 203' },
      { profese: 'Provozní', jmeno: 'paní Vaňková', telefon: '+420 777 000 302', poznamka: 'Rozhoduje o umístění venkovních jednotek' },
    ],
    komentare: [{ user: u.admin, text: 'Konzoly dorazí zítra ráno rovnou na místo (dodavatel potvrdil).', kdy: d(-1, 9) }],
    etapy: [
      { cislo: 1, nazev: 'Pokoje 1–3', od: d(1, 8), do_: d(1, 17), stav: 'PLANOVANA' },
      { cislo: 2, nazev: 'Pokoje 4–6 + zprovoznění', od: d(2, 8), do_: d(2, 17), stav: 'PLANOVANA' },
    ],
  })

  // Za týden — nová, zatím jen technik 2
  await createZakazka({
    cislo: '26-905', client: cl.kancelare, nazev: 'Obhlídka a zaměření — open-space 3. NP', tech: 'KLIMA', stav: 'NOVA',
    misto: 'Nádražní 200, 702 00 Ostrava', od: d(7, 9), do_: d(7, 11), technici: [u.technik2],
    pokyny: 'Zaměřit trasy potrubí v podhledu, vyfotit rozvaděč. Sraz se správcem budovy u recepce.',
    items: [{ p: P('x', { nazev: 'Zaměření a technická obhlídka', cena: 0, nakup: 0 }), mnozstvi: 1, stav: 'CEKA', hotovo: false }],
    kontakty: [{ profese: 'Správce budovy', jmeno: 'pan Šimek', telefon: '+420 777 000 303' }],
  })

  // Minulý týden — TČ, předáno, protokol podepsán, vyúčtování ke schválení
  const zNovakova = await createZakazka({
    cislo: '26-898', deal: dealNovakova, client: cl.novakova, nazev: 'Montáž tepelného čerpadla vzduch-voda 8 kW', tech: 'TEPELNE_CERPADLO', stav: 'PREDANA',
    misto: 'Lipová 8, 738 01 Frýdek-Místek', od: d(-8, 8), do_: d(-7, 16), technici: [u.technik],
    pokyny: 'Venkovní jednotka na betonový základ za domem, hydrobox v technické místnosti.',
    poznamka: 'Realizace 2 dny, bez komplikací. Klient proškolen na ovládání.',
    items: [
      { p: tc, mnozstvi: 1, stav: 'VYDANO', hotovo: true, pouzito: 1 },
      { p: tcKonzola, mnozstvi: 1, stav: 'VYDANO', hotovo: true, pouzito: 1 },
      { p: tcProtimraz, mnozstvi: 1, stav: 'VYDANO', hotovo: true, pouzito: 1 },
      { p: montazTc, mnozstvi: 1, stav: 'VYDANO', hotovo: true, pouzito: 1 },
      { p: tcDoprava, mnozstvi: 1, stav: 'VYDANO', hotovo: true, pouzito: 1 },
    ],
    kontakty: [{ profese: 'Majitelka', jmeno: 'Eva Nováková', telefon: '+420 777 000 202' }],
    komentare: [
      { user: u.technik, text: 'Den 1: základ + venkovní jednotka + propojení. Zítra hydrobox a zprovoznění.', kdy: d(-8, 16, 30) },
      { user: u.technik, text: 'Zprovozněno, topná zkouška OK, klientka podepsala protokol.', kdy: d(-7, 15, 40) },
    ],
    etapy: [{ cislo: 1, nazev: 'Montáž a zprovoznění', od: d(-8, 8), do_: d(-7, 16), stav: 'PREDANA' }],
  })
  {
    const polozky = await prisma.zakazkaPolozka.findMany({ where: { zakazkaId: zNovakova.z.id }, orderBy: { poradi: 'asc' } })
    const pred = await prisma.predavak.create({
      data: {
        orgId: org.id, zakazkaId: zNovakova.z.id, cislo: 'PP-26-031', technikId: u.technik.id, stav: PredavakStav.PODPISAN, klientPritomen: true,
        etapaId: zNovakova.etapy[0]?.id, podpisano: d(-7, 15, 35), poznamka: 'Předáno vč. návodu a zaškolení obsluhy.',
        podpisSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="M20 70 C 40 20, 60 20, 80 60 S 120 90, 140 50 S 180 20, 200 60 S 240 80, 280 40" fill="none" stroke="#1A2E1B" stroke-width="2.5" stroke-linecap="round"/></svg>',
      },
    })
    await prisma.predavakPolozka.createMany({
      data: polozky.map(p => ({ predavakId: pred.id, zakazkaPolozkaId: p.id, nazev: p.nazev, planovanoMnozstvi: p.mnozstvi, mnozstviPouzito: p.mnozstviPouzito ?? p.mnozstvi, jednotka: p.jednotka })),
    })
    const vy = await prisma.vyuctovani.create({
      data: { orgId: org.id, zakazkaId: zNovakova.z.id, cislo: 'VYU-26-031', stav: VyuctovaniStav.KE_SCHVALENI, etapaId: zNovakova.etapy[0]?.id, predavakId: pred.id, poznamka: 'Dle podepsaného předávacího protokolu.' },
    })
    await prisma.vyuctovaniPolozka.createMany({
      data: polozky.map((p, i) => ({ vyuctovaniId: vy.id, nazev: p.nazev, mnozstvi: p.mnozstviPouzito ?? p.mnozstvi, jednotka: p.jednotka, nakupniCena: p.nakupniCena, prodejniCena: p.prodejniCena ?? 0, poradi: i })),
    })
  }

  // Před 3 týdny — hotovo, vyúčtováno
  const zDvorak = await createZakazka({
    cislo: '26-895', deal: dealDvorak, client: cl.dvorak, nazev: 'Klimatizace ložnice + obývák', tech: 'KLIMA', stav: 'HOTOVO',
    misto: 'Polní 33, 748 01 Hlučín', od: d(-25, 8), do_: d(-25, 15), technici: [u.technik2], uzavreno: d(-20, 10),
    items: [
      { p: unit('LUZON', 0), mnozstvi: 2, stav: 'VYDANO', hotovo: true, pouzito: 2 },
      { p: potrubi, mnozstvi: 12, stav: 'VYDANO', hotovo: true, pouzito: 11 },
      { p: konzola, mnozstvi: 2, stav: 'VYDANO', hotovo: true, pouzito: 2 },
      { p: montaz, mnozstvi: 2, stav: 'VYDANO', hotovo: true, pouzito: 2 },
      { p: doprava, mnozstvi: 30, stav: 'VYDANO', hotovo: true, pouzito: 30 },
    ],
    komentare: [{ user: u.technik2, text: 'Hotovo, předáno, klient spokojen.', kdy: d(-25, 15, 10) }],
    etapy: [{ cislo: 1, nazev: 'Montáž', od: d(-25, 8), do_: d(-25, 15), stav: 'PREDANA' }],
  })
  {
    const polozky = await prisma.zakazkaPolozka.findMany({ where: { zakazkaId: zDvorak.z.id }, orderBy: { poradi: 'asc' } })
    const pred = await prisma.predavak.create({
      data: { orgId: org.id, zakazkaId: zDvorak.z.id, cislo: 'PP-26-027', technikId: u.technik2.id, stav: PredavakStav.SCHVALEN, etapaId: zDvorak.etapy[0]?.id, podpisano: d(-25, 15), schvaleno: d(-24, 9), schvalenoId: u.admin.id, podpisSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="M20 60 C 50 10, 80 90, 110 50 S 170 20, 200 60 S 250 80, 280 30" fill="none" stroke="#1A2E1B" stroke-width="2.5" stroke-linecap="round"/></svg>' },
    })
    await prisma.predavakPolozka.createMany({ data: polozky.map(p => ({ predavakId: pred.id, zakazkaPolozkaId: p.id, nazev: p.nazev, planovanoMnozstvi: p.mnozstvi, mnozstviPouzito: p.mnozstviPouzito ?? p.mnozstvi, jednotka: p.jednotka })) })
    const vy = await prisma.vyuctovani.create({ data: { orgId: org.id, zakazkaId: zDvorak.z.id, cislo: 'VYU-26-027', stav: VyuctovaniStav.SCHVALENO, etapaId: zDvorak.etapy[0]?.id, predavakId: pred.id, schvaleno: d(-24, 9, 5), schvalenoId: u.admin.id } })
    await prisma.vyuctovaniPolozka.createMany({ data: polozky.map((p, i) => ({ vyuctovaniId: vy.id, nazev: p.nazev, mnozstvi: p.mnozstviPouzito ?? p.mnozstvi, jednotka: p.jednotka, nakupniCena: p.nakupniCena, prodejniCena: p.prodejniCena ?? 0, poradi: i })) })
  }
  console.log('  ✓ Zakázky: 26-901 (dnes, předána — SOD + předávák PP-26-032 + vyúčtování ke schválení), 26-904 (dnes odp.), 26-902 (zítra–pozítří, 2 etapy), 26-905 (za týden), 26-898 (předána + vyúčtování ke schválení), 26-895 (hotovo)')

  // ── Servis: zařízení, kontrakty, servisní zakázky ────────────────────────
  const zarHorak = await prisma.zarizeni.create({ data: { orgId: org.id, klientId: cl.horak.id, dealId: dealHorak.id, nazev: `${unit('AIRY', 0).nazev} — obývák`, typ: ZarizeniTyp.KLIMATIZACE, vyrobniCislo: 'SN-DEMO-26101', datumInstalace: d(0), zarukaDo: d(3 * 365) } })
  await prisma.zarizeni.create({ data: { orgId: org.id, klientId: cl.horak.id, dealId: dealHorak.id, nazev: `${unit('AIRY', 0).nazev} — ložnice`, typ: ZarizeniTyp.KLIMATIZACE, vyrobniCislo: 'SN-DEMO-26102', datumInstalace: d(0), zarukaDo: d(3 * 365) } })
  const zarDvorak = await prisma.zarizeni.create({ data: { orgId: org.id, klientId: cl.dvorak.id, dealId: dealDvorak.id, nazev: `${unit('LUZON', 0).nazev} — ložnice`, typ: ZarizeniTyp.KLIMATIZACE, vyrobniCislo: 'SN-DEMO-24011', datumInstalace: d(-25), zarukaDo: d(-25 + 3 * 365) } })
  await prisma.zarizeni.create({ data: { orgId: org.id, klientId: cl.dvorak.id, dealId: dealDvorak.id, nazev: `${unit('LUZON', 0).nazev} — obývák`, typ: ZarizeniTyp.KLIMATIZACE, vyrobniCislo: 'SN-DEMO-24012', datumInstalace: d(-25), zarukaDo: d(-25 + 3 * 365) } })
  const zarNovakova = await prisma.zarizeni.create({ data: { orgId: org.id, klientId: cl.novakova.id, dealId: dealNovakova.id, nazev: tc.nazev, typ: ZarizeniTyp.TEPELNE_CERPADLO, vyrobniCislo: 'SN-DEMO-TC-0087', datumInstalace: d(-7), zarukaDo: d(-7 + 5 * 365), poznamka: 'Prodloužená záruka 5 let podmíněna ročními prohlídkami.' } })
  const zarSvoboda = await prisma.zarizeni.create({ data: { orgId: org.id, klientId: cl.svoboda.id, nazev: 'Klimatizace podkroví (instalace 2024, jiný dodavatel)', typ: ZarizeniTyp.KLIMATIZACE, vyrobniCislo: 'SN-DEMO-EXT-2024', datumInstalace: d(-500) } })
  const zarPenzionOld = await prisma.zarizeni.create({ data: { orgId: org.id, klientId: cl.penzion.id, nazev: 'VRF systém restaurace (2021)', typ: ZarizeniTyp.KLIMATIZACE, vyrobniCislo: 'SN-DEMO-VRF-2021', datumInstalace: d(-1500) } })

  const kNovakova = await prisma.servisniKontrakt.create({ data: { orgId: org.id, klientId: cl.novakova.id, dealId: dealNovakova.id, zarizeniId: zarNovakova.id, cisloKontraktu: 'SK-26-004', nazev: 'Roční prohlídka TČ (podmínka záruky)', typ: ServisTyp.ROCNI, intervalMesicu: 12, cena: 2900, zacatek: d(-7), autoRenewal: true, aktivni: true } })
  const kPenzion = await prisma.servisniKontrakt.create({ data: { orgId: org.id, klientId: cl.penzion.id, zarizeniId: zarPenzionOld.id, cisloKontraktu: 'SK-25-011', nazev: 'Pololetní servis VRF — restaurace', typ: ServisTyp.POLOLETNI, intervalMesicu: 6, cena: 4800, zacatek: d(-400), autoRenewal: true, aktivni: true } })
  const kHorak = await prisma.servisniKontrakt.create({ data: { orgId: org.id, klientId: cl.horak.id, dealId: dealHorak.id, zarizeniId: zarHorak.id, cisloKontraktu: 'SK-26-006', nazev: 'Roční servis klimatizace (2 jednotky)', typ: ServisTyp.ROCNI, intervalMesicu: 12, cena: 2400, zacatek: d(0), autoRenewal: true, aktivni: true } })
  await prisma.servisniKontrakt.create({ data: { orgId: org.id, klientId: cl.dvorak.id, dealId: dealDvorak.id, zarizeniId: zarDvorak.id, cisloKontraktu: 'SK-26-005', nazev: 'Roční servis klimatizace', typ: ServisTyp.ROCNI, intervalMesicu: 12, cena: 1900, zacatek: d(-20), aktivni: true } })

  // dokončený zásah (porucha) s protokolem
  const szPenzion = await prisma.servisniZakazka.create({
    data: {
      orgId: org.id, kontraktId: kPenzion.id, zarizeniId: zarPenzionOld.id, klientId: cl.penzion.id, cislo: 'SZ-26-018', typ: NavstevaTyp.PORUCHA, stav: ServisniZakazkaStav.DOKONCENA,
      planovanyTermin: d(-4, 9), skutecnyTermin: d(-4, 9, 20), trvaniMinut: 95, technikId: u.technik.id,
      zprava: 'Jednotka v restauraci nechladila. Zjištěn zanesený výměník venkovní jednotky a nízký tlak chladiva. Provedeno čištění, dohledán únik na šroubení, dotaženo, doplněno chladivo, zkouška těsnosti OK.',
      nalezeneZavady: 'Únik chladiva na šroubení venkovní jednotky; silně zanesený kondenzátor.',
      doporuceni: 'Doplnit ochrannou mřížku venkovní jednotky (padá listí ze stromů). Příští pololetní servis dle kontraktu.',
      nakladyCas: 1900, nakladyMaterial: 1450, protokolDokoncen: d(-4, 11),
      podpisKlienta: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="M30 70 C 60 20, 90 80, 130 40 S 200 30, 230 70 S 260 40, 280 50" fill="none" stroke="#1A2E1B" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  })
  await prisma.servisniPolozka.createMany({
    data: [
      { orgId: org.id, servisniZakazkaId: szPenzion.id, typ: ServisniPolozkaTyp.PRACE, popis: 'Diagnostika a oprava úniku, čištění kondenzátoru', mnozstvi: 1.5, jednotka: 'h', cenaZaJednotku: 900, krytoKontraktem: false, poradi: 1 },
      { orgId: org.id, servisniZakazkaId: szPenzion.id, typ: ServisniPolozkaTyp.MATERIAL, popis: 'Chladivo R32 doplnění', mnozstvi: 0.6, jednotka: 'kg', cenaZaJednotku: 1900, poradi: 2 },
      { orgId: org.id, servisniZakazkaId: szPenzion.id, typ: ServisniPolozkaTyp.MATERIAL, popis: 'Těsnění šroubení', mnozstvi: 2, jednotka: 'ks', cenaZaJednotku: 155, poradi: 3 },
      { orgId: org.id, servisniZakazkaId: szPenzion.id, typ: ServisniPolozkaTyp.DOPRAVA, popis: 'Doprava', mnozstvi: 90, jednotka: 'km', cenaZaJednotku: 8, krytoKontraktem: true, poradi: 4 },
    ],
  })
  // naplánovaná prohlídka (technik 1, příští týden)
  await prisma.servisniZakazka.create({ data: { orgId: org.id, kontraktId: kPenzion.id, zarizeniId: zarPenzionOld.id, klientId: cl.penzion.id, cislo: 'SZ-26-021', typ: NavstevaTyp.PLANOVANY_SERVIS, stav: ServisniZakazkaStav.NAPLANOVANA, planovanyTermin: d(9, 9), technikId: u.technik.id, poznamka: 'Pololetní servis dle kontraktu SK-25-011. Vzít filtry.' } })
  // servis dnes odpoledne u Svobodové (navazuje na zakázku 26-904)
  await prisma.servisniZakazka.create({ data: { orgId: org.id, zarizeniId: zarSvoboda.id, klientId: cl.svoboda.id, cislo: 'SZ-26-022', typ: NavstevaTyp.KONTROLA, stav: ServisniZakazkaStav.NAPLANOVANA, planovanyTermin: d(0, 14), technikId: u.technik2.id, poznamka: 'Kontrola jednotky od jiného dodavatele — klientka zvažuje servisní smlouvu.' } })
  // nová bez technika (čeká na dispečink)
  await prisma.servisniZakazka.create({ data: { orgId: org.id, klientId: cl.dvorak.id, zarizeniId: zarDvorak.id, cislo: 'SZ-26-023', typ: NavstevaTyp.ZARUCNI_OPRAVA, stav: ServisniZakazkaStav.NOVA, poznamka: 'Klient hlásí, že jednotka v ložnici občas kape. Domluvit termín.' } })
  // první roční servis u Horáka za rok (z kontraktu)
  await prisma.servisniZakazka.create({ data: { orgId: org.id, kontraktId: kHorak.id, zarizeniId: zarHorak.id, klientId: cl.horak.id, cislo: 'SZ-26-025', typ: NavstevaTyp.PLANOVANY_SERVIS, stav: ServisniZakazkaStav.NOVA, planovanyTermin: d(365, 9), poznamka: 'Roční servis dle kontraktu SK-26-006 — obě jednotky.' } })
  // roční prohlídka TČ za rok (z kontraktu)
  await prisma.servisniZakazka.create({ data: { orgId: org.id, kontraktId: kNovakova.id, zarizeniId: zarNovakova.id, klientId: cl.novakova.id, cislo: 'SZ-26-024', typ: NavstevaTyp.PLANOVANY_SERVIS, stav: ServisniZakazkaStav.NOVA, planovanyTermin: d(358, 9) } })
  console.log('  ✓ Servis: 7 zařízení, 4 kontrakty, 6 servisních zakázek (1 dokončená s protokolem)')


  console.log('\n✅ Hotovo.')
  console.log(`   Web:     https://${SLUG}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'}/auth/signin`)
  console.log(`   Admin:   ${USERS.admin.email}`)
  console.log(`   Obchod:  ${USERS.obchodnik.email}`)
  console.log(`   Technik: ${USERS.technik.email}, ${USERS.technik2.email}`)
  console.log('   Hesla:   SEED_ADMIN_PASSWORD (admin) / SEED_TECHNIK_PASSWORD (ostatní) v .env')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
