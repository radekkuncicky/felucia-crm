// Sdílená data veřejného webu - čte je homepage (UI), JSON-LD a llms.txt,
// aby se viditelný obsah, strukturovaná data a text pro LLM nerozešly.

export const SITE_URL = 'https://felucia.io'
export const SITE_NAME = 'Felucia'
export const SITE_TAGLINE = 'Systém pro montážní a servisní firmy'
export const SITE_TITLE = 'Felucia - systém pro montážní a servisní firmy'
export const SITE_DESCRIPTION =
  'Od poptávky přes smlouvu, sklad a práci technika po vyúčtování a servis. Jedna zakázka, jeden záznam. Pro firmy v oboru TČ, klimatizací a rekuperací.'

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
  /** Kč za firmu a měsíc bez DPH; null = individuální nabídka. Limity a funkce plánů
   *  jsou v lib/planLimits.ts (texty skládá components/marketing/homepage/planSouhrn.ts). */
  price: number | null
}

export const PLANS: Plan[] = [
  { id: 'STARTER', name: 'Starter', price: 490 },
  { id: 'STANDARD', name: 'Standard', price: 1490 },
  { id: 'PROFESSIONAL', name: 'Professional', price: 2490 },
  { id: 'ENTERPRISE', name: 'Enterprise', price: null },
]

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('cs-CZ').format(price)
}

// Odpovědi ověřené proti docs/homepage-facts.md (2026-10-01). Zdroj pro viditelné FAQ,
// JSON-LD FAQPage i llms.txt.
export const FAQS: { q: string; a: string }[] = [
  { q: 'Pro jaké firmy je Felucia vhodná?', a: 'Pro menší české montážní a servisní firmy v oboru tepelných čerpadel, klimatizací, rekuperací a vzduchotechniky, kde kancelář řídí obchod, zakázky a několik techniků v terénu.' },
  { q: 'Co technik zvládne v telefonu?', a: 'V aplikaci Felucia Tech vidí své dnešní a další zakázky, adresu stavby s navigací, kontakt na klienta, pokyny a podklady. Odškrtává položky, píše komentáře, fotí, vyplní předávací protokol se skutečně použitým materiálem a podpisem klienta. Se servisním modulem zapíše i servisní zásah. Aplikace je pro iOS, verzi pro Android připravujeme.' },
  { q: 'Vidí technik ceny?', a: 'Při montáži ne. V aplikaci Felucia Tech vidí technik u zakázky jen položky a množství. Prodejní ceny vidí Správce, Manažer zakázek a Obchodník, nákupní ceny a marže jen Správce a Manažer zakázek.' },
  { q: 'Funguje aplikace bez signálu?', a: 'Bez signálu se uloží odškrtnuté položky, komentáře, fotky i servisní protokol. Podpis a změnu stavu technik dokončí, až bude online.' },
  { q: 'Kdo vidí naše data?', a: 'Každá firma má oddělený prostor na vlastní subdoméně firma.felucia.io a její data jsou od ostatních firem oddělená v aplikaci i přímo v databázi. Uvnitř firmy rozhodují role Správce, Manažer zakázek, Obchodník, Hlavní technik a Technik: každý vidí jen to, co mu role dovolí, technik jen přiřazené zakázky.' },
  { q: 'Jak probíhá ukázka?', a: '20 minut online. Ukážeme průchod jednou zakázkou od poptávky po servis a probereme, jestli Felucia sedí vašemu provozu.' },
  { q: 'Jak se domlouvá zavedení?', a: 'Po ukázce se domluvíme na rozsahu a podmínkách a začínáme na konkrétní zakázce s vaším týmem. První firmy zavádíme osobně a postupně.' },
  { q: 'Jaká data lze importovat?', a: 'Produkty importujete z Excelu (XLSX) přes průvodce v nastavení. Kompletní migraci klientů, zakázek a historie z předchozího systému zatím neděláme. Na ukázce probereme, co je u vás potřeba.' },
  { q: 'Je nutné připojení k internetu?', a: 'Kancelářská část běží v prohlížeči a připojení potřebuje. Aplikace Felucia Tech zvládne část práce i bez signálu, viz otázka výše.' },
]

/** Poslední věcná změna obsahu veřejných stránek - pro sitemap <lastmod>. */
export const CONTENT_UPDATED = {
  home: '2026-10-01',
  terms: '2026-07-15',
  privacy: '2026-07-15',
  support: '2026-07-15',
}
