/**
 * Jediný zdroj pravdy, kdo co vidí v navigaci (Sidebar, BottomNav, paleta ⌘K).
 * Čisté TS bez JSX — ikony jsou klíče, komponenty je mapují na ui/Icons.
 * Viz docs/ux-audit/NAVRH.md (A2, E2, G2).
 */
import { isTechnikView, type Permissions } from './permissions'
import { getPlanLimits } from './planLimits'

export type NavIconKey =
  | 'home' | 'calendar' | 'users' | 'bell' | 'briefcase' | 'document' | 'clipboard' | 'warehouse'
  | 'wrench' | 'chart' | 'box' | 'activity' | 'contract' | 'cog' | 'folder' | 'key' | 'plus' | 'mapPin'

export interface NavItem {
  id: string
  href: string
  label: string
  /** Krátký popisek pro BottomNav */
  shortLabel?: string
  icon: NavIconKey
  /** Aktivní jen při přesné shodě cesty (jinak prefix) */
  exact?: boolean
}

export interface NavSection {
  id: string
  /** Nadpis sekce; bez nadpisu = jen oddělovač */
  title?: string
  items: NavItem[]
}

export interface NavCtx {
  perms: Permissions
  plan?: string | null
  orgSettings?: Partial<{
    modulServis: boolean
    modulLeady: boolean
    modulDokumenty: boolean
    modulAnalytiky: boolean
  }> | null
  isSuperAdmin?: boolean
}

export interface NavFlags {
  obchod: boolean
  technik: boolean
  leady: boolean
  servis: boolean
  servisDispecink: boolean
  zakazky: boolean
  protokoly: boolean
  sklad: boolean
  dokumenty: boolean
  analytiky: boolean
  nastaveni: boolean
  superadmin: boolean
}

export function navFlags({ perms, plan, orgSettings, isSuperAdmin }: NavCtx): NavFlags {
  const org = orgSettings ?? {}
  const technik = isTechnikView(perms)
  const servis = getPlanLimits(plan ?? 'STARTER').hasServiceModule && !!org.modulServis && perms.servis !== 'ZADNY'
  return {
    obchod: perms.obchod,
    technik,
    leady: perms.obchod && (plan ?? 'STARTER') !== 'STARTER' && org.modulLeady !== false,
    servis,
    servisDispecink: servis && perms.servisDispecink,
    zakazky: perms.zakazky !== 'ZADNE',
    protokoly: technik || perms.zakazkySchvalovani,
    sklad: perms.sklad !== 'ZADNY',
    // Dokumenty a analýzy jsou v middleware obchodní prefixy — technik je nevidí
    dokumenty: !technik && !!org.modulDokumenty,
    analytiky: !technik && !!org.modulAnalytiky && perms.analytiky,
    nastaveni: perms.spravaUzivatelu || perms.nastaveniOrg || perms.fakturace || perms.analytiky,
    superadmin: !!isSuperAdmin,
  }
}

const I = {
  dashboard: { id: 'dashboard', href: '/dashboard', label: 'Nástěnka', icon: 'home', exact: true },
  calendar: { id: 'calendar', href: '/calendar', label: 'Kalendář', icon: 'calendar' },
  clients: { id: 'clients', href: '/clients', label: 'Klienti', icon: 'users' },
  leady: { id: 'leady', href: '/leady', label: 'Leady', icon: 'bell' },
  deals: { id: 'deals', href: '/deals', label: 'Obchodní případy', shortLabel: 'OP', icon: 'briefcase' },
  quotes: { id: 'quotes', href: '/quotes', label: 'Nabídky', icon: 'document' },
  zakazky: { id: 'zakazky', href: '/zakazky', label: 'Zakázky', icon: 'clipboard' },
  predavaky: { id: 'predavaky', href: '/predavaky', label: 'Předávací protokoly', shortLabel: 'Protokoly', icon: 'contract' },
  sklad: { id: 'sklad', href: '/sklad', label: 'Sklad', icon: 'warehouse' },
  servis: { id: 'servis', href: '/servis', label: 'Přehled', shortLabel: 'Servis', icon: 'wrench', exact: true },
  servisZakazky: { id: 'servis-zakazky', href: '/servis/zakazky', label: 'Servisní zakázky', icon: 'wrench' },
  servisPlan: { id: 'servis-plan', href: '/servis/plan', label: 'Plán servisů', icon: 'calendar' },
  servisPortfolio: { id: 'servis-portfolio', href: '/servis/portfolio', label: 'Portfolio zařízení', icon: 'box' },
  activities: { id: 'activities', href: '/activities', label: 'Úkoly a aktivity', shortLabel: 'Úkoly', icon: 'activity' },
  products: { id: 'products', href: '/products', label: 'Produkty', icon: 'box' },
  quoteTemplates: { id: 'quote-templates', href: '/quote-templates', label: 'Vzorové nabídky', icon: 'document' },
  documents: { id: 'documents', href: '/documents', label: 'Dokumenty', icon: 'folder' },
  analytics: { id: 'analytics', href: '/analytics', label: 'Analýzy', icon: 'chart' },
  settings: { id: 'settings', href: '/settings', label: 'Nastavení', icon: 'cog' },
  superadmin: { id: 'superadmin', href: '/superadmin', label: 'Superadmin', icon: 'key' },
} satisfies Record<string, NavItem>

function pick(pairs: [boolean, NavItem][]): NavItem[] {
  return pairs.filter(([ok]) => ok).map(([, item]) => item)
}

function section(id: string, title: string | undefined, items: NavItem[]): NavSection[] {
  return items.length ? [{ id, title, items }] : []
}

/** Hlavní menu (Sidebar i mobilní drawer). Nastavení a superadmin jsou v patičce — viz footerItems. */
export function sidebarSections(ctx: NavCtx): NavSection[] {
  const f = navFlags(ctx)

  if (f.technik) {
    const vlastni = ctx.perms.zakazky === 'PRIRAZENE'
    return section('technik', undefined, pick([
      [true, I.dashboard],
      [true, { ...I.zakazky, label: vlastni ? 'Moje zakázky' : 'Zakázky' }],
      [f.servis, I.servisZakazky],
      [f.protokoly, I.predavaky],
      [f.sklad, I.sklad],
      [true, I.calendar],
    ]))
  }

  return [
    ...section('zaklad', undefined, pick([[true, I.dashboard], [true, I.calendar], [f.obchod, I.clients]])),
    ...section('obchod', 'Obchod', pick([[f.leady, I.leady], [f.obchod, I.deals], [f.obchod, I.quotes]])),
    ...section('realizace', 'Realizace', pick([[f.zakazky, I.zakazky], [f.protokoly, I.predavaky], [f.sklad, I.sklad]])),
    ...section('servis', 'Servis', pick([
      [f.servis, I.servis], [f.servis, I.servisZakazky], [f.servis, I.servisPlan], [f.servis, I.servisPortfolio],
    ])),
    ...section('aktivity', undefined, pick([[f.obchod, I.activities]])),
    ...section('katalog', 'Katalog', pick([[f.obchod, I.products], [f.obchod, I.quoteTemplates]])),
    ...section('vice', undefined, pick([[f.dokumenty, I.documents], [f.analytiky, I.analytics]])),
  ]
}

/** Patička sidebaru (nad profilem). */
export function footerItems(ctx: NavCtx): NavItem[] {
  const f = navFlags(ctx)
  return pick([[f.nastaveni, I.settings], [f.superadmin, I.superadmin]])
}

/** Spodní lišta na mobilu — max. 4 položky podle role (Dáša se přidává zvlášť). */
export function bottomNavItems(ctx: NavCtx): NavItem[] {
  const f = navFlags(ctx)
  if (f.technik) return pick([[true, I.dashboard], [true, I.zakazky], [f.protokoly, I.predavaky]])
  if (f.obchod && !ctx.perms.zakazkySchvalovani) {
    return pick([[true, I.dashboard], [true, I.deals], [true, I.activities], [true, I.clients]])
  }
  return pick([
    [true, I.dashboard],
    [f.obchod, I.deals],
    [f.zakazky, I.zakazky],
    [f.servis, I.servis],
    [!f.servis && f.obchod, I.clients],
  ]).slice(0, 4)
}

/** Paleta ⌘K — „Přejít na" (vše, co uživatel smí) a rychlé akce. */
export function paletteItems(ctx: NavCtx): { navigace: NavItem[]; akce: NavItem[] } {
  const f = navFlags(ctx)
  const navigace = [...sidebarSections(ctx).flatMap(s => s.items), ...footerItems(ctx).filter(i => i.id !== 'superadmin')]
  const akce = pick([
    [f.obchod, { id: 'new-deal', href: '/deals/new', label: 'Nový obchodní případ', icon: 'plus' }],
    [f.obchod, { id: 'new-client', href: '/clients/new', label: 'Nový klient', icon: 'plus' }],
    [f.servisDispecink, { id: 'new-servis', href: '/servis/nova', label: 'Nová servisní akce', icon: 'plus' }],
  ])
  return { navigace, akce }
}
