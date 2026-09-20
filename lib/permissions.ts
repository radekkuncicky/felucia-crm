/**
 * Centrální vrstva oprávnění.
 *
 * Role = preset (výchozí balíček oprávnění). Admin může u každého uživatele
 * jednotlivá oprávnění přepsat (`User.permissions` = jen přepisy, Partial<Permissions>).
 * Efektivní oprávnění = preset(role) + přepisy (přepisy jen na plánech s hasCustomPermissions).
 *
 * V API routách:
 *   const p = getPerms(session.user)
 *   if (!p.zakazkyEdit) return forbidden()
 *
 * Nikdy nekontroluj `session.user.role === '...'` přímo — přes role se nedá přepsat.
 * Výjimka: čistě informativní zobrazení (badge role).
 */
import { getPlanLimits } from './planLimits'

export type ZakazkyRozsah = 'ZADNE' | 'PRIRAZENE' | 'VSE'
export type SkladPristup = 'ZADNY' | 'CTENI' | 'PLNY'
export type ServisPristup = 'ZADNY' | 'VLASTNI' | 'VSE'

export interface Permissions {
  /** Vidí nákupní ceny a marže (OP, zakázky, produkty, sklad, klient, vyúčtování, PDF) */
  financeNakupky: boolean
  /** Edituje nákupní ceny / rabaty na položkách a nákladové ceny produktů */
  financeNakupkyEdit: boolean
  /** Vidí prodejní ceny na zakázkách, položkách a předávácích (technici standardně ne) */
  financeProdejni: boolean
  /** Obchodní modul: klienti, leady, OP, nabídky, vzorové nabídky, cenovka (= appka Felucia Sales) */
  obchod: boolean
  /** Vidí OP a leady ostatních uživatelů (jinak jen vlastní) */
  obchodCiziOP: boolean
  /** Maže / zneplatňuje OP, leady, SoD; anonymizuje klienty */
  obchodMazani: boolean
  /** Rozsah zakázek: žádné / přiřazené (technik, vedoucí, autor OP) / všechny (≠ ZADNE = appka Felucia Tech) */
  zakazky: ZakazkyRozsah
  /** Zakládá a edituje zakázky, etapy, položky, přiřazuje techniky, mění stav */
  zakazkyEdit: boolean
  /** Schvaluje předáváky a vyúčtování, může být vedoucím zakázky */
  zakazkySchvalovani: boolean
  /** Maže zakázky a etapy, otevírá schválené vyúčtování */
  zakazkyMazani: boolean
  /** Sklad: žádný / čtení / plný (příjem, storno, schvalování pohybů) */
  sklad: SkladPristup
  /** Servisní modul (Professional+): žádný / vlastní servisní zakázky / všechny */
  servis: ServisPristup
  /** Dispečink servisu: plánování, přiřazování techniků, zařízení, kontrakty */
  servisDispecink: boolean
  /** Správa uživatelů, rolí a oprávnění */
  spravaUzivatelu: boolean
  /** Nastavení organizace: firma, dokumenty, šablony, ceníky, e-mail, import, features, API */
  nastaveniOrg: boolean
  /** Fakturace a plán (Stripe) */
  fakturace: boolean
  /** Analýzy a audit log */
  analytiky: boolean
}

export type PermissionKey = keyof Permissions
export type PermissionOverrides = Partial<Permissions>

export const ROLES = ['ADMIN', 'MANAZER', 'OBCHODNIK', 'HLAVNI_TECHNIK', 'TECHNIK'] as const
export type RoleName = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: 'Správce',
  MANAZER: 'Manažer zakázek',
  OBCHODNIK: 'Obchodník',
  HLAVNI_TECHNIK: 'Hlavní technik',
  TECHNIK: 'Technik',
}

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  ADMIN: 'Vše včetně nastavení organizace, uživatelů a fakturace.',
  MANAZER: 'Obchod, zakázky, sklad, servis a schvalování. Bez nastavení organizace, uživatelů a fakturace.',
  OBCHODNIK: 'Klienti, leady, obchodní případy a nabídky. Zakázky ze svých OP jen ke čtení, bez nákupních cen.',
  HLAVNI_TECHNIK: 'Mistr: vidí všechny zakázky, přiřazuje techniky, zakládá předáváky, sklad ke čtení, servis.',
  TECHNIK: 'Jen přiřazené zakázky, předáváky a fotky. Servis podle oprávnění.',
}

const ALL: Permissions = {
  financeNakupky: true,
  financeNakupkyEdit: true,
  financeProdejni: true,
  obchod: true,
  obchodCiziOP: true,
  obchodMazani: true,
  zakazky: 'VSE',
  zakazkyEdit: true,
  zakazkySchvalovani: true,
  zakazkyMazani: true,
  sklad: 'PLNY',
  servis: 'VSE',
  servisDispecink: true,
  spravaUzivatelu: true,
  nastaveniOrg: true,
  fakturace: true,
  analytiky: true,
}

export const ROLE_PRESETS: Record<RoleName, Permissions> = {
  ADMIN: ALL,
  MANAZER: {
    ...ALL,
    spravaUzivatelu: false,
    nastaveniOrg: false,
    fakturace: false,
  },
  OBCHODNIK: {
    financeNakupky: false,
    financeNakupkyEdit: false,
    financeProdejni: true,
    obchod: true,
    obchodCiziOP: true,
    obchodMazani: false,
    zakazky: 'PRIRAZENE',
    zakazkyEdit: false,
    zakazkySchvalovani: false,
    zakazkyMazani: false,
    sklad: 'ZADNY',
    servis: 'ZADNY',
    servisDispecink: false,
    spravaUzivatelu: false,
    nastaveniOrg: false,
    fakturace: false,
    analytiky: false,
  },
  HLAVNI_TECHNIK: {
    financeNakupky: false,
    financeNakupkyEdit: false,
    financeProdejni: false,
    obchod: false,
    obchodCiziOP: false,
    obchodMazani: false,
    zakazky: 'VSE',
    zakazkyEdit: true,
    zakazkySchvalovani: false,
    zakazkyMazani: false,
    sklad: 'CTENI',
    servis: 'VSE',
    servisDispecink: false,
    spravaUzivatelu: false,
    nastaveniOrg: false,
    fakturace: false,
    analytiky: false,
  },
  TECHNIK: {
    financeNakupky: false,
    financeNakupkyEdit: false,
    financeProdejni: false,
    obchod: false,
    obchodCiziOP: false,
    obchodMazani: false,
    zakazky: 'PRIRAZENE',
    zakazkyEdit: false,
    zakazkySchvalovani: false,
    zakazkyMazani: false,
    sklad: 'ZADNY',
    servis: 'ZADNY',
    servisDispecink: false,
    spravaUzivatelu: false,
    nastaveniOrg: false,
    fakturace: false,
    analytiky: false,
  },
}

/** Popis oprávnění pro UI (Nastavení → Uživatelé → Oprávnění) */
export interface PermissionMeta {
  key: PermissionKey
  label: string
  hint?: string
  options?: { value: string; label: string }[] // undefined = boolean přepínač
}
export interface PermissionGroup {
  id: string
  label: string
  items: PermissionMeta[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { key: 'financeNakupky', label: 'Vidí nákupní ceny a marže', hint: 'OP, zakázky, produkty, sklad, klient, vyúčtování i PDF' },
      { key: 'financeNakupkyEdit', label: 'Edituje nákupní ceny', hint: 'Nákupky a rabaty na položkách, nákladové ceny produktů' },
      { key: 'financeProdejni', label: 'Vidí prodejní ceny na zakázkách', hint: 'Položky zakázky, předáváky, PDF pro technika' },
    ],
  },
  {
    id: 'obchod',
    label: 'Obchod',
    items: [
      { key: 'obchod', label: 'Přístup k obchodu', hint: 'Klienti, leady, OP, nabídky — zapíná i appku Felucia Sales' },
      { key: 'obchodCiziOP', label: 'Vidí obchodní případy ostatních', hint: 'Jinak jen vlastní OP a leady' },
      { key: 'obchodMazani', label: 'Maže a zneplatňuje OP, leady a smlouvy' },
    ],
  },
  {
    id: 'zakazky',
    label: 'Zakázky',
    items: [
      {
        key: 'zakazky', label: 'Rozsah zakázek', hint: 'Jiné než „žádné" zapíná appku Felucia Tech',
        options: [
          { value: 'ZADNE', label: 'Žádné' },
          { value: 'PRIRAZENE', label: 'Jen přiřazené' },
          { value: 'VSE', label: 'Všechny' },
        ],
      },
      { key: 'zakazkyEdit', label: 'Zakládá a edituje zakázky', hint: 'Etapy, položky, přiřazení techniků, stav' },
      { key: 'zakazkySchvalovani', label: 'Schvaluje', hint: 'Předáváky, vyúčtování; může být vedoucím zakázky' },
      { key: 'zakazkyMazani', label: 'Maže zakázky a etapy' },
    ],
  },
  {
    id: 'sklad',
    label: 'Sklad',
    items: [
      {
        key: 'sklad', label: 'Sklad',
        options: [
          { value: 'ZADNY', label: 'Bez přístupu' },
          { value: 'CTENI', label: 'Jen čtení' },
          { value: 'PLNY', label: 'Plný (příjem, storno)' },
        ],
      },
    ],
  },
  {
    id: 'servis',
    label: 'Servis',
    items: [
      {
        key: 'servis', label: 'Servisní zakázky', hint: 'Vyžaduje plán Professional a zapnutý modul',
        options: [
          { value: 'ZADNY', label: 'Bez přístupu' },
          { value: 'VLASTNI', label: 'Jen vlastní' },
          { value: 'VSE', label: 'Všechny' },
        ],
      },
      { key: 'servisDispecink', label: 'Dispečink', hint: 'Plánování, přiřazování techniků, zařízení, kontrakty' },
    ],
  },
  {
    id: 'sprava',
    label: 'Správa',
    items: [
      { key: 'spravaUzivatelu', label: 'Spravuje uživatele a oprávnění' },
      { key: 'nastaveniOrg', label: 'Nastavení organizace', hint: 'Firma, dokumenty, šablony, ceníky, e-mail, import, funkce, API' },
      { key: 'fakturace', label: 'Fakturace a plán' },
      { key: 'analytiky', label: 'Analýzy a audit log' },
    ],
  },
]

const ENUM_VALUES: Partial<Record<PermissionKey, readonly string[]>> = {
  zakazky: ['ZADNE', 'PRIRAZENE', 'VSE'],
  sklad: ['ZADNY', 'CTENI', 'PLNY'],
  servis: ['ZADNY', 'VLASTNI', 'VSE'],
}

export function isRoleName(v: unknown): v is RoleName {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

/** Vyčistí neznámé klíče a špatné hodnoty (např. z DB JSON nebo z requestu) */
export function parseOverrides(input: unknown): PermissionOverrides {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: PermissionOverrides = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!(k in ALL)) continue
    const key = k as PermissionKey
    const allowed = ENUM_VALUES[key]
    if (allowed) {
      if (typeof v === 'string' && allowed.includes(v)) (out as Record<string, unknown>)[key] = v
    } else if (typeof v === 'boolean') {
      ;(out as Record<string, unknown>)[key] = v
    }
  }
  return out
}

/** Nechá v přepisech jen hodnoty, které se liší od presetu role */
export function diffFromPreset(role: RoleName, perms: Partial<Permissions>): PermissionOverrides {
  const preset = ROLE_PRESETS[role]
  const out: PermissionOverrides = {}
  for (const [k, v] of Object.entries(perms)) {
    const key = k as PermissionKey
    if (v !== undefined && preset[key] !== v) (out as Record<string, unknown>)[key] = v
  }
  return out
}

export function resolvePermissions(role: string, overrides?: unknown, plan?: string): Permissions {
  const preset = ROLE_PRESETS[isRoleName(role) ? role : 'TECHNIK']
  if (plan && !getPlanLimits(plan).hasCustomPermissions) return preset
  return { ...preset, ...parseOverrides(overrides) }
}

/** Minimální tvar uživatele, který `getPerms` potřebuje (web session i mobile session) */
export interface PermUser {
  role: string
  isSuperAdmin?: boolean
  perms?: Permissions
}

/**
 * Efektivní oprávnění uživatele. Web session je má v JWT (`session.user.perms`);
 * kde chybí (mobile bez načtení), spadne na preset role. Superadmin má vše.
 */
export function getPerms(user: PermUser): Permissions {
  if (user.isSuperAdmin) return ALL
  return user.perms ?? ROLE_PRESETS[isRoleName(user.role) ? user.role : 'TECHNIK']
}

/** 403 pro API routy (plain Response, aby šel modul importovat i z klientských komponent) */
export function forbidden(message = 'Forbidden') {
  return Response.json({ error: message }, { status: 403 })
}

/** Prisma `where` pro zakázky viditelné uživateli podle rozsahu. `null` = nic. */
export function zakazkyScopeWhere(perms: Permissions, userId: string): Record<string, unknown> | null {
  if (perms.zakazky === 'ZADNE') return null
  if (perms.zakazky === 'VSE') return {}
  return {
    OR: [
      { techniciRel: { some: { technikId: userId } } },
      { vedouciId: userId },
      { op: { userId } },
    ],
  }
}

/** Prisma `where` pro obchodní případy: bez `obchodCiziOP` jen vlastní OP. `null` = žádný přístup k obchodu. */
export function dealScopeWhere(perms: Permissions, userId: string): Record<string, unknown> | null {
  if (!perms.obchod) return null
  if (perms.obchodCiziOP) return {}
  return { userId }
}

/**
 * Prisma `where` pro klienty: obchod vidí všechny, jinak jen klienty ze
 * zakázek / servisních zakázek v rozsahu uživatele (technik nemá vidět celou
 * databázi kontaktů). `null` = nic.
 */
export function clientScopeWhere(perms: Permissions, userId: string): Record<string, unknown> | null {
  if (perms.obchod) return {}
  const or: Record<string, unknown>[] = []
  const z = zakazkyScopeWhere(perms, userId)
  if (z !== null) or.push({ zakazky: { some: z } })
  const s = servisScopeWhere(perms, userId)
  if (s !== null) or.push({ servisniZakazky: { some: s } })
  if (or.length === 0) return null
  return { OR: or }
}

/** Prisma `where` pro servisní zakázky. `null` = nic. */
export function servisScopeWhere(perms: Permissions, userId: string): Record<string, unknown> | null {
  if (perms.servis === 'ZADNY') return null
  if (perms.servis === 'VSE') return {}
  return { technikId: userId }
}

/** Uživatel je „jen technik" — vidí pouze přiřazené zakázky a nic z obchodu (řídí menu a redirecty) */
export function isTechnikView(perms: Permissions): boolean {
  return !perms.obchod && perms.zakazky !== 'ZADNE'
}
