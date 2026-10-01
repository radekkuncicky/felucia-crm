// Texty nové homepage (docs/homepage-brief.md + ZMĚNY PO AUDITU, ověřeno proti
// docs/homepage-facts.md). Ceny a limity sem nepatří - berou se z lib/landing.ts,
// lib/planLimits.ts, lib/dasaLimits.ts a lib/modulPodpisy.ts (viz Cenik.tsx).

export const NAV = [
  { href: '#jak-to-funguje', label: 'Jak to funguje' },
  { href: '#technici', label: 'Technici' },
  { href: '#servis', label: 'Servis' },
  { href: '#funkce', label: 'Funkce' },
  { href: '#ceny', label: 'Ceny' },
  { href: '#faq', label: 'FAQ' },
] as const

export const HERO = {
  nadtitulek: 'Systém pro montážní a servisní firmy',
  h1: 'Co prodáte, to se namontuje. Co se použije, to se vyúčtuje.',
  podtitulek:
    'Felucia drží celou zakázku v jednom záznamu - od poptávky přes smlouvu, sklad a práci technika až po vyúčtování a pravidelný servis. Pro firmy v oboru tepelných čerpadel, klimatizací a rekuperací.',
  primarni: 'Domluvit 20minutovou ukázku',
  sekundarni: 'Projít zakázku krok za krokem',
  drobne: 'Bez závazků. Osobní rozhovor o vašem provozu.',
}

export const OBORY = ['Tepelná čerpadla', 'Klimatizace', 'Rekuperace', 'Podlahové vytápění', 'Vzduchotechnika', 'Servisní kontrakty']

export type KrokId = 'obchod' | 'smlouva' | 'priprava' | 'montaz' | 'predani' | 'servis'

export const PENIZE: { titulek: string; text: string; krok: KrokId; krokNazev: string }[] = [
  {
    titulek: 'Materiál navíc, který nikdo nevyúčtuje.',
    text: 'V nabídce 10 m potrubí, na stavbě padlo 12 m. Dva metry zmizí, pokud je technik nenapíše a kancelář nedohledá.',
    krok: 'predani',
    krokNazev: 'Předání a vyúčtování',
  },
  {
    titulek: 'Technik volá do kanceláře.',
    text: 'Adresa, kontakt, co se přesně prodalo, jestli je materiál připravený.',
    krok: 'montaz',
    krokNazev: 'Montáž',
  },
  {
    titulek: 'Smlouvy na papíře.',
    text: 'Tisk, podpis, sken, e-mail a pak hledání, která verze platí.',
    krok: 'smlouva',
    krokNazev: 'Smlouva',
  },
  {
    titulek: 'Servis, na který se zapomene.',
    text: 'Zařízení bez naplánované prohlídky je zákazník, kterého za dva roky obslouží někdo jiný.',
    krok: 'servis',
    krokNazev: 'Servis',
  },
]

export const JAK = {
  h2: 'Jedna zakázka od poptávky po servis',
  podtitulek: 'Obchod, kancelář, sklad i technici pracují nad stejnými daty. Každý krok přebírá to, co vzniklo v předchozím.',
}

export interface KrokPruvodce {
  id: KrokId
  cislo: number
  nazev: string
  /** skutečné role aplikace (lib/permissions.ts) */
  kdo: string
  body: string[]
  /** drobná poznámka pod body (dostupnost podle plánu) */
  pozn?: string
  dal: string
}

export const KROKY: KrokPruvodce[] = [
  {
    id: 'obchod', cislo: 1, nazev: 'Obchod', kdo: 'Obchodník',
    body: [
      'Lead jedním kliknutím na obchodní případ, údaje klienta se převezmou, Felucia hlídá duplicity.',
      'Nabídka z položek materiálu a práce z katalogu s cenami podle ceníku, nebo zkopírovaná z jiného případu.',
      'PDF nabídky ve vlastním designu firmy.',
    ],
    dal: 'klient, adresa díla, položky nabídky.',
  },
  {
    id: 'smlouva', cislo: 2, nazev: 'Smlouva', kdo: 'Obchodník a klient',
    body: [
      'SOD vygenerovaná ze šablony s proměnnými.',
      'Elektronický podpis ověřený SMS kódem: firma podepíše v aplikaci, klient na počítači nebo mobilu.',
      'Podepsané PDF uložené u obchodního případu.',
    ],
    // doplní se z lib/modulPodpisy.ts (cena a limit příplatku) - viz podpisDostupnost()
    dal: 'podepsaný rozsah díla.',
  },
  {
    id: 'priprava', cislo: 3, nazev: 'Příprava', kdo: 'Manažer zakázek, Hlavní technik',
    body: [
      'Zakázka vznikne sama po podpisu smlouvy a převezme klienta a položky nabídky.',
      'Termín montáže, technik a vedoucí zakázky.',
      'Materiál ve stavech Objednáno, Rezervováno, Vydáno. Naskladňuje Manažer zakázek.',
    ],
    dal: 'co přesně a kde montovat.',
  },
  {
    id: 'montaz', cislo: 4, nazev: 'Montáž', kdo: 'Technik',
    body: [
      'Aplikace Felucia Tech: Můj den, navigace, kontakt, podklady.',
      'Odškrtnuté položky, skutečně použitý materiál, komentáře a fotky.',
      'Při montáži technik ceny nevidí.',
    ],
    dal: 'skutečně provedená práce a použitý materiál.',
  },
  {
    id: 'predani', cislo: 5, nazev: 'Předání a vyúčtování', kdo: 'Technik, Manažer zakázek',
    body: [
      'Předávací protokol plán vs skutečnost, podpis klienta na displeji telefonu.',
      'Manažer zakázek protokol schválí a vyúčtování vznikne z protokolu se skutečně použitým množstvím.',
      'Manažer zakázek vyúčtování zkontroluje a schválí.',
    ],
    dal: 'namontovaná zařízení.',
  },
  {
    id: 'servis', cislo: 6, nazev: 'Servis', kdo: 'Technik, Manažer zakázek',
    body: [
      'Zařízení se zárukou, servisní kontrakty a plánované prohlídky.',
      'Servisní zakázka v šesti fázích: Nová, Naplánovaná, Probíhá, Dokončená, Vyúčtovaná, Uzavřená.',
    ],
    // doplní se z lib/planLimits.ts (hasServiceModule) - viz servisDostupnost()
    dal: 'další prohlídka a další zakázka.',
  },
]

export const PLAN_VS = {
  h2: 'Nabídka 10 m. Použito 12 m. Vyúčtováno 12 m.',
  odstavce: [
    'Technik zapíše skutečně použitý materiál přímo na místě. Předávací protokol ho porovná s nabídkou, Manažer zakázek rozdíl zkontroluje a schválí a vyúčtování vznikne z protokolu. Nic se nedohledává zpětně.',
    'Při montáži technik ceny nevidí. Konečné vyúčtování kontroluje a schvaluje Manažer zakázek.',
  ],
}

export const TECHNICI = {
  h2: 'Kancelář vidí celou zakázku. Technik jen to, co potřebuje na stavbě.',
  body: [
    'Vše k zakázce v telefonu: adresa, kontakt, pokyny a podklady.',
    'Navigace na stavbu jedním klepnutím.',
    'Odškrtnuté položky, komentáře a skutečně použitý materiál v protokolu.',
    'Fotky přímo z telefonu.',
    'Podpis zákazníka v políčku na displeji.',
  ],
  offline: 'Bez signálu se uloží odškrtnuté položky, komentáře, fotky i servisní protokol. Podpis a změnu stavu technik dokončí, až bude online.',
  android: 'Verzi pro Android připravujeme.',
}

export const SERVIS = {
  h2: 'Montáží zakázka nekončí.',
  text: 'Každé namontované zařízení zůstává v evidenci u zákazníka i původní zakázky - se zárukou, historií zásahů a servisním kontraktem. Felucia hlídá termíny prohlídek a technik zapíše zásah v telefonu.',
}

export const DETAILY_H2 = 'Detaily, na kterých to v praxi stojí'

export const DASA = {
  h2: 'Dáša. AI asistentka, která pracuje s vašimi obchodními případy.',
  text: 'Zeptáte se nebo zadáte úkol, Dáša ho provede a potvrdí, co udělala. Nenahrazuje postup zakázky, šetří kliky.',
  umi: [
    'najde obchodní případ, klienta nebo produkt',
    'založí klienta a obchodní případ',
    'připraví nabídku podle vzoru',
    'zapíše aktivitu',
    'změní stav obchodního případu',
  ],
}

export const DATA = {
  h2: 'Vaše data zůstávají vaše.',
}

export const CENY = {
  h2: 'Cena podle velikosti týmu',
  podtitulek: 'Na ukázce doporučíme plán podle počtu lidí a provozu.',
  jednotka: 'bez DPH, za firmu a měsíc',
}

export const UKAZKA = {
  h2: 'Ukážeme vám to na zakázce, jakou děláte každý týden.',
  text: 'Projdeme jednu zakázku od poptávky po servis a probereme, jestli Felucia sedí vašemu provozu.',
  kroky: [
    'Krátká ukázka a rozhovor o vašem provozu.',
    'Dohoda na rozsahu a podmínkách zavedení.',
    'Začátek na konkrétní zakázce s vaším týmem.',
  ],
}

export const PATICKA = {
  popis: 'Felucia je systém pro montážní a servisní firmy v oboru tepelných čerpadel, klimatizací, rekuperací a vzduchotechniky. Jedna zakázka od poptávky po servis.',
  puvod: 'Vyvinuto v provozu montážní firmy.',
}
