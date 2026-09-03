import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Viessmann Vitocal 200-A ie (Comfort/Modular) — ceník 2026, rabat NANTO 30 %
// nakladovaCena = standardniCena (ceníková) × 0,7, stejná konvence jako u ostatních
// Vitocal produktů v DB (ověřeno na Z015216 apod.)
//
// Nahrazuje 4 starší chybné položky "VITOCAL 200-A ie Comfort a Modular Bxx"
// (Z034486-489), které mylně spojovaly Comfort a Modular do jednoho produktu.
// Ty nemají žádné navázané nabídky (quote_items), takže je bezpečné je smazat.

const COMMON_POPIS =
  'Monoblokové reverzibilní tepelné čerpadlo vzduch/voda s el. průtokovým ohřívačem 6,4 kW, ' +
  'vysoce efektivním oběhovým čerpadlem, kulovým kohoutem s magnetickým filtrem a funkcí chlazení. ' +
  'Chladivo R290 (GWP 0,02), COP až 5,4 (A7/W35), energetická třída vytápění A+++, výstupní teplota ' +
  'topné vody až 75 °C. Regulace One Base Intelligence se 7" barevným dotykovým displejem, WiFi/LAN ' +
  '+ appka ViCare, Smart Grid Ready, možnost řízení 3 směšovaných + 1 přímého okruhu. Napájení 230 V/50 Hz.'

const RADA_POPIS: Record<string, string> = {
  Comfort: 'Verze Comfort — vnitřní jednotka s integrovaným akumulačním zásobníkem 16 l.',
  Modular: 'Verze Modular — vnitřní jednotka bez akumulačního zásobníku (modulární provedení).',
}

const VYKON: Record<string, { a2w35: string; am7w35: string }> = {
  B06: { a2w35: '1,2 až 5,8', am7w35: '0,8 až 5,5' },
  B08: { a2w35: '1,2 až 6,8', am7w35: '0,8 až 6,8' },
  B10: { a2w35: '3,1 až 9,8', am7w35: '2,4 až 8,7' },
  B12: { a2w35: '3,1 až 10,5', am7w35: '2,4 až 9,7' },
}

const HLAVNI_JEDNOTKY = [
  { rada: 'Comfort', model: 'B06', kod: 'Z034486', cena: 150770 },
  { rada: 'Comfort', model: 'B08', kod: 'Z034487', cena: 154960 },
  { rada: 'Comfort', model: 'B10', kod: 'Z034488', cena: 182780 },
  { rada: 'Comfort', model: 'B12', kod: 'Z034489', cena: 189620 },
  { rada: 'Modular', model: 'B06', kod: 'Z034478', cena: 147810 },
  { rada: 'Modular', model: 'B08', kod: 'Z034479', cena: 152000 },
  { rada: 'Modular', model: 'B10', kod: 'Z034480', cena: 179820 },
  { rada: 'Modular', model: 'B12', kod: 'Z034481', cena: 186660 },
]

const STARE_CHYBNE_KODY = ['Z034486', 'Z034487', 'Z034488', 'Z034489']

const PRISLUSENSTVI = [
  { nazev: 'Sada kulových kohoutů Comfort', kod: '3211312', cena: 8640,
    popis: 'K hydraulickému připojení vnitřních jednotek š. 450 mm — 2× kulový kohout G 1¼" (proplach/napouštění/vypouštění topného/chladicího okruhu) + 2× kulový kohout G 1" pro připojení zásobníkového ohřívače vody' },
  { nazev: 'Sada přechodových kusů na Cu 22/28 mm, přímé', kod: '3210485', cena: 1910,
    popis: '4× přechodový kus G 1¼" na 28 mm s převlečnou maticí + 2× přechodový kus G 1" na 22 mm s převlečnou maticí' },
  { nazev: 'Vana kondenzátu s výhřevným pásem', kod: '3210415', cena: 2620,
    popis: 'Jen pro odvedení kondenzátu do kanalizace, vč. odtokového kolena a hadice 1,25 m' },
  { nazev: 'Vyhřívání prstence ventilátoru', kod: '3210407', cena: 5140,
    popis: 'Pro dodatečnou montáž v oblastech s přetrvávající mlhou při venkovních teplotách pod -6 °C' },
  { nazev: 'Kulový kohout s magnetickým filtrem', kod: '3205505', cena: 2280,
    popis: 'Připojení Rp 1¼", třída filtrace 500 µm' },
  { nazev: 'Sada silentblokových podstavců (2 ks)', kod: 'ZK06012', cena: 2150,
    popis: 'Pro instalaci venkovní jednotky na pevný povrch' },
  { nazev: 'Samostatná konzola pro venkovní jednotku — montáž na zem', kod: '3210409', cena: 5190,
    popis: null },
  { nazev: 'Samostatná konzola pro venkovní jednotku — montáž na stěnu', kod: '3210408', cena: 12920,
    popis: null },
  { nazev: 'Flexibilní nerezové potrubí s izolací', kod: '3210412', cena: 4010,
    popis: 'K hydraulickému připojení venkovní jednotky — 2× vlnitá trubka z nerezové oceli DN 25 × 570 mm s převlečnou maticí G 1, tepelná izolace Ø 28 × 32 mm' },
  { nazev: 'Ponorné čidlo teploty', kod: '7438702', cena: 2150,
    popis: 'NTC 10 kOhm, kabel 5,8 m, k měření teploty v jímce' },
  { nazev: 'Příložné čidlo teploty', kod: '7426463', cena: 2150,
    popis: 'NTC 10 kOhm, kabel 5,8 m' },
  { nazev: 'Přídavný snímač vlhkosti, 24 V', kod: '7181418', cena: 10310,
    popis: 'K měření rosného bodu 1 topného/chladicího okruhu bez akumulační nádoby' },
  { nazev: 'Přídavný snímač vlhkosti, 230 V', kod: '7452646', cena: 17170,
    popis: 'K měření rosného bodu u více topných/chladicích okruhů za akumulační nádobou' },
  { nazev: 'Protimrazový ventil 1"', kod: 'ZR00220', cena: 3450,
    popis: 'Instalace na výstupní a vratné potrubí venkovní jednotky' },
  { nazev: 'Systém protimrazové ochrany pro monobloková tepelná čerpadla', kod: '3215063', cena: 10340,
    popis: 'Napájecí a řídicí modul s teplotními čidly, záložní akumulátor 12 V / 18 Ah, oběhové čerpadlo' },
  { nazev: 'BUS komunikační kabel 5 m', kod: '7973122', cena: 1560,
    popis: 'K propojení venkovní jednotky s vnitřní jednotkou přes CAN-BUS' },
  { nazev: 'BUS komunikační kabel 15 m', kod: '7973123', cena: 2730,
    popis: 'K propojení venkovní jednotky s vnitřní jednotkou přes CAN-BUS' },
  { nazev: 'BUS komunikační kabel 30 m', kod: '7973124', cena: 4610,
    popis: 'K propojení venkovní jednotky s vnitřní jednotkou přes CAN-BUS' },
  { nazev: 'BUS propojovací kabel 5 m', kod: 'ZK06219', cena: 1640,
    popis: 'Pro připojení účastníků sběrnice CAN-BUS (Vitodens 200-W, Vitoair atd.)' },
  { nazev: 'BUS propojovací kabel 15 m', kod: 'ZK06220', cena: 3150,
    popis: 'Pro připojení účastníků sběrnice CAN-BUS (Vitodens 200-W, Vitoair atd.)' },
  { nazev: 'BUS propojovací kabel 30 m', kod: 'ZK06221', cena: 5720,
    popis: 'Pro připojení účastníků sběrnice CAN-BUS (Vitodens 200-W, Vitoair atd.)' },
]

const RABAT = 0.3

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'nanto' } })
  if (!org) throw new Error('NANTO org nenalezena!')
  console.log(`✓ Org: ${org.nazev}`)

  // 1) Smazat staré chybné "Comfort a Modular" položky (bez navázaných nabídek)
  for (const kod of STARE_CHYBNE_KODY) {
    const existing = await prisma.product.findFirst({ where: { orgId: org.id, kod } })
    if (!existing) continue
    const vazby = await prisma.quoteItem.count({ where: { productId: existing.id } })
    if (vazby > 0) {
      console.log(`   ⚠ Nemažu ${kod} — má ${vazby} navázaných položek nabídek`)
      continue
    }
    await prisma.product.delete({ where: { id: existing.id } })
    console.log(`   ✓ Smazána stará položka ${kod} (${existing.nazev})`)
  }

  // 2) Hlavní jednotky — vytvořit 8 nových
  let created = 0
  for (const p of HLAVNI_JEDNOTKY) {
    const nazev = `Vitocal 200-A ie ${p.rada} ${p.model} 230V`
    const existing = await prisma.product.findFirst({ where: { orgId: org.id, kod: p.kod } })
    if (existing) {
      console.log(`   ~ Přeskočeno (existuje): ${nazev} (${p.kod})`)
      continue
    }
    const vykon = VYKON[p.model]
    const popis = `${COMMON_POPIS} ${RADA_POPIS[p.rada]} Rozsah tepelného výkonu ${p.model}: A2/W35 ${vykon.a2w35} kW, A-7/W35 ${vykon.am7w35} kW.`
    const nakladovaCena = Math.round(p.cena * (1 - RABAT))

    await prisma.product.create({
      data: {
        orgId: org.id,
        nazev,
        kod: p.kod,
        produktovaRada: '200-A',
        popis,
        standardniCena: p.cena,
        nakladovaCena,
        jednotka: 'ks',
        dphSazba: 12,
        aktivni: true,
      },
    })
    console.log(`   ✓ ${nazev} (${p.kod}) — ${p.cena.toLocaleString('cs-CZ')} Kč / nákup ${nakladovaCena.toLocaleString('cs-CZ')} Kč`)
    created++
  }

  // 3) Příslušenství — update pokud kod existuje (zachová vazby na nabídky), jinak create
  let updated = 0
  let createdAcc = 0
  for (const a of PRISLUSENSTVI) {
    const nakladovaCena = Math.round(a.cena * (1 - RABAT))
    const existing = await prisma.product.findFirst({ where: { orgId: org.id, kod: a.kod } })
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          nazev: a.nazev,
          produktovaRada: '200-A',
          popis: a.popis,
          standardniCena: a.cena,
          nakladovaCena,
        },
      })
      console.log(`   ↻ Aktualizováno: ${a.nazev} (${a.kod}) — ${a.cena.toLocaleString('cs-CZ')} Kč / nákup ${nakladovaCena.toLocaleString('cs-CZ')} Kč`)
      updated++
      continue
    }
    await prisma.product.create({
      data: {
        orgId: org.id,
        nazev: a.nazev,
        kod: a.kod,
        produktovaRada: '200-A',
        popis: a.popis,
        standardniCena: a.cena,
        nakladovaCena,
        jednotka: 'ks',
        dphSazba: 12,
        aktivni: true,
      },
    })
    console.log(`   ✓ ${a.nazev} (${a.kod}) — ${a.cena.toLocaleString('cs-CZ')} Kč / nákup ${nakladovaCena.toLocaleString('cs-CZ')} Kč`)
    createdAcc++
  }

  console.log(`\n✅ Hotovo! Hlavní jednotky: ${created} vytvořeno. Příslušenství: ${createdAcc} vytvořeno, ${updated} aktualizováno.`)
}

main()
  .catch(e => { console.error('❌ Chyba:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
