// Sdílená data veřejného webu — čte je landing (UI), JSON-LD a llms.txt,
// aby se viditelný obsah, strukturovaná data a text pro LLM nerozešly.

export const SITE_URL = 'https://felucia.io'
export const SITE_NAME = 'Felucia'
export const SITE_TAGLINE = 'Software pro montážní a servisní firmy'
export const SITE_TITLE = 'Felucia — software pro montážní a servisní firmy'
export const SITE_DESCRIPTION =
  'Felucia je CRM pro řízení montážních a servisních firem — klimatizace, tepelná čerpadla, rekuperace a vzduchotechnika. Nabídky, zakázky, technici v terénu i následný servis na jednom místě.'

export const CONTACT = {
  email: 'info@felucia.io',
  phone: '+420724347986',
  phoneDisplay: '724 347 986',
}

export const OPERATOR = {
  name: 'EFIKU SOLUTIONS s.r.o.',
  ico: '29703972',
  street: 'Výstavní 2224/8',
  city: 'Ostrava',
  zip: '709 00',
  country: 'CZ',
  email: 'info@efiku.cz',
}

export type PlanId = 'STARTER' | 'STANDARD' | 'PROFESSIONAL' | 'ENTERPRISE'

export interface Plan {
  id: PlanId
  name: string
  /** Kč za měsíc; null = individuální nabídka */
  price: number | null
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'STARTER', name: 'Starter', price: 490,
    features: ['1 uživatel', '20 obchodních případů', '100 produktů', '1 šablona nabídky', 'Subdoména firma.felucia.io', 'Email podpora 48 h'],
  },
  {
    id: 'STANDARD', name: 'Standard', price: 1490,
    features: ['2–5 uživatelů', 'Neomezené zakázky', 'Všechny šablony + editace', 'AI Dáša (500/měsíc)', 'Ceníky a analytiky'],
  },
  {
    id: 'PROFESSIONAL', name: 'Professional', price: 2490,
    features: ['5–20 uživatelů', 'Vše ze Standard', 'Servisní modul', 'AI Dáša neomezená', 'White-label + API'],
  },
  {
    id: 'ENTERPRISE', name: 'Enterprise', price: null,
    features: ['20+ uživatelů', 'Vše z Professional', 'Dedikovaný onboarding', 'SLA garance', 'Vlastní integrace + školení'],
  },
]

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('cs-CZ').format(price)
}

export const FAQS: { q: string; a: string }[] = [
  { q: 'Pro jaké firmy je Felucia vhodná?', a: 'Pro menší české montážní a servisní firmy — typicky klimatizace a tepelná čerpadla — kde majitel koordinuje obchod, zakázky a několik techniků v terénu.' },
  { q: 'Co technik zvládne v telefonu?', a: 'V aplikaci Felucia Tech vidí dnešní a nadcházející zakázky, navigaci a kontakty na stavbě, pokyny a podklady k montáži. Může odškrtávat položky, přidávat fotky a poznámky a na konci vyplnit předávací protokol s podpisem zákazníka. Mobilní funkce jsme ověřili ve zdrojovém kódu, provozní zkušenosti průběžně sbíráme s prvními firmami.' },
  { q: 'Jak probíhá ukázka?', a: '20 minut online. Ukážeme průchod jednou zakázkou od nabídky po servis a probereme, jestli Felucia sedí vašemu provozu.' },
  { q: 'Jak se domlouvá zavedení?', a: 'Po ukázce se domluvíme na rozsahu a podmínkách a začínáme na konkrétní zakázce s vaším týmem. První firmy zavádíme osobně a postupně.' },
  { q: 'Jaká data lze importovat?', a: 'Podporujeme import produktů z Excel souboru (XLSX) přes průvodce v nastavení. Kompletní migraci klientů, zakázek a historie z předchozího systému aktuálně neděláme — probereme na ukázce, co je u vás potřeba.' },
  { q: 'Je nutné připojení k internetu?', a: 'Felucia běží jako webová a mobilní aplikace, takže část funkcí vyžaduje internetové připojení. Plně offline provoz negarantujeme.' },
]

/**
 * Účetní software, do kterého umíme předat podklady z vyúčtování.
 * Seznam je připravený na další systémy - stačí doplnit další položku,
 * viditelný text i llms.txt se poskládají samy.
 */
export const ACCOUNTING_SOFTWARE = ['ABRA Flexi']

/** "ABRA Flexi" / "ABRA Flexi a Pohoda" / "ABRA Flexi, Pohoda a Money S3" */
export function formatAccountingSoftware(list: string[] = ACCOUNTING_SOFTWARE): string {
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} a ${list[list.length - 1]}`
}

export interface WorkflowStep {
  /** Pořadí v celém procesu (1-8), ne v rámci fáze. */
  n: number
  title: string
  desc: string
  bullets: string[]
  /** Štítek nad nadpisem kroku - zvýrazňuje samostatný produkt. */
  badge?: string
}

export interface WorkflowPhase {
  id: string
  name: string
  steps: WorkflowStep[]
}

export const WORKFLOW_PHASES: WorkflowPhase[] = [
  {
    id: 'obchod',
    name: 'Obchod',
    steps: [
      {
        n: 1,
        title: 'Převedete poptávku na obchodní případ',
        desc: 'Z leadu jedním kliknutím vytvoříte obchodní případ se všemi údaji o klientovi.',
        bullets: [
          'Kontakt, adresa a historie komunikace se převezmou automaticky',
          'Jasný stav případu a přehled, kdo na něm pracuje',
          'Žádné ruční přepisování údajů',
        ],
      },
      {
        n: 2,
        title: 'Připravíte nabídku',
        desc: 'Nabídku sestavíte z materiálu a práce, nebo ji převezmete z již hotové.',
        bullets: [
          'Kopírování a duplikace nabídek z jiných obchodních případů',
          'Převzetí nabídky od jiného klienta jako šablony',
          'Přehledné položky materiálu a práce s cenami',
        ],
      },
      {
        n: 3,
        title: 'Klient podepíše smlouvu o dílo online',
        desc: 'Smlouvu podepíše klient z počítače nebo mobilu, bez tisku a skenování.',
        bullets: [
          'Certifikovaný elektronický podpis',
          'Podepsaný dokument uložený přímo u obchodního případu',
          'Okamžitý přehled, které smlouvy jsou podepsané',
        ],
      },
    ],
  },
  {
    id: 'realizace',
    name: 'Realizace',
    steps: [
      {
        n: 4,
        title: 'Předáte obchodní případ na realizaci',
        desc: 'Z podepsaného obchodního případu vznikne zakázka se všemi podklady.',
        bullets: [
          'Nabídka, smlouva a dokumenty se přenesou do zakázky',
          'Termín, místo montáže a kontakty na jednom místě',
          'Realizační tým vidí přesně to, co bylo klientovi prodáno',
        ],
      },
      {
        n: 5,
        title: 'Evidujete materiál',
        desc: 'U každé zakázky víte, v jakém stavu je potřebný materiál.',
        bullets: [
          'Stavy: objednáno, naskladněno, vydáno',
          'Kontrola, zda je vše připraveno před montáží',
          'Přehled skutečně spotřebovaného materiálu',
        ],
      },
      {
        n: 6,
        badge: 'Mobilní aplikace',
        title: 'Přiřadíte technika a evidujete montáž',
        desc: 'Technici pracují v samostatné aplikaci pro techniky přímo na místě.',
        bullets: [
          'Přiřazení technika k zakázce a termínu',
          'Technik vidí adresu, kontakty a podklady k práci',
          'Záznam provedené práce, fotografií a použitého materiálu',
        ],
      },
    ],
  },
  {
    id: 'predani',
    name: 'Předání a vyúčtování',
    steps: [
      {
        n: 7,
        title: 'Vytvoříte předávací protokol',
        desc: 'Protokol z montáže slouží jako podklad pro vyúčtování.',
        bullets: [
          'Vzniká ze skutečně provedené práce a použitého materiálu',
          'Fotografie a podpis klienta při předání',
          'Žádné dohledávání, co se na zakázce reálně dělalo',
        ],
      },
      {
        n: 8,
        title: 'Schválíte vyúčtování a odešlete podklady do účetnictví',
        desc: 'Po kontrole protokolu schválíte vyúčtování a podklady odejdou do účetního softwaru.',
        bullets: [
          'Schválení vyúčtování odpovědnou osobou',
          `Export podkladů do účetního softwaru ${formatAccountingSoftware()}`,
          'Zakázka připravená pro navazující servisní návštěvy',
        ],
      },
    ],
  },
]

/** Plochý seznam všech kroků - pro llms.txt a strukturovaná data. */
export const WORKFLOW_STEPS: WorkflowStep[] = WORKFLOW_PHASES.flatMap(p => p.steps)

export const WORKFLOW_HEADING = 'Jedna zakázka od poptávky po vyúčtování'
export const WORKFLOW_PEREX =
  'Celý proces na jednom místě. Obchod, sklad, technici i účetní pracují se stejnými daty, nic se nepřepisuje a nic se neztratí mezi e-mailem, Excelem a papírem.'

export const FEATURE_LIST = [
  'Obchodní případy a nabídky s materiálem a prací',
  'Smlouva o dílo s elektronickým podpisem online',
  'Propojení nabídky s montážní zakázkou',
  'Stav materiálu u zakázky (objednáno, naskladněno, vydáno)',
  'Položky zakázky, jejich stav a přiřazení techniků',
  'Etapy montáže, pokyny, dokumenty a fotografie',
  'Předávací protokoly a vyúčtování',
  'Evidence zařízení, servisní kontrakty a plánované návštěvy',
  'Servisní zásah se zprávou, závadami, doporučením, podpisem a podklady k vyúčtování',
  'Mobilní aplikace Felucia Tech pro techniky v terénu',
  'AI asistentka Dáša (plány Standard a Professional)',
]

/** Poslední věcná změna obsahu veřejných stránek — pro sitemap <lastmod>. */
export const CONTENT_UPDATED = {
  home: '2026-09-16',
  terms: '2026-07-15',
  privacy: '2026-07-15',
  support: '2026-07-15',
}
