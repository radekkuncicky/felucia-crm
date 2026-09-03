import type { Technologie } from '@prisma/client'

/**
 * Služba z webového formuláře přichází jako slug ("klimatizace", "tepelne-cerpadlo").
 * Tady se z ní dělá čitelný název pro UI i předmět OP a mapuje se na technologii.
 */

function normalize(sluzba: string): string {
  return sluzba
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .trim()
}

const SLUZBA_LABELS: Record<string, string> = {
  'klimatizace': 'Klimatizace',
  'klima': 'Klimatizace',
  'tepelne-cerpadlo': 'Tepelné čerpadlo',
  'tepelna-cerpadla': 'Tepelné čerpadlo',
  'rekuperace': 'Rekuperace',
  'podlahove-topeni': 'Podlahové topení',
  'vzduchotechnika': 'Vzduchotechnika',
  'servis': 'Servis',
  'jine': 'Jiné',
}

const SLUZBA_TECHNOLOGIE: Record<string, Technologie> = {
  'klimatizace': 'KLIMA',
  'klima': 'KLIMA',
  'tepelne-cerpadlo': 'TEPELNE_CERPADLO',
  'tepelna-cerpadla': 'TEPELNE_CERPADLO',
  'rekuperace': 'REKUPERACE',
  'podlahove-topeni': 'PODLAHOVE_TOPENI',
  'vzduchotechnika': 'VZDUCHOTECHNIKA',
}

/** Čitelný název služby — známé slugy dle mapy, neznámé jen s velkým písmenem. */
export function sluzbaLabel(sluzba: string | null | undefined): string | null {
  if (!sluzba?.trim()) return null
  const key = normalize(sluzba)
  if (SLUZBA_LABELS[key]) return SLUZBA_LABELS[key]
  const raw = sluzba.trim()
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** Technologie pro předvyplnění při převodu na OP. */
export function sluzbaToTechnologie(sluzba: string | null | undefined): Technologie {
  if (!sluzba?.trim()) return 'JINE'
  return SLUZBA_TECHNOLOGIE[normalize(sluzba)] ?? 'JINE'
}

const PREDMET_MAX = 80

/** Zkrátí text na hranici slova, ne uprostřed. */
function zkrat(text: string, max = PREDMET_MAX): string {
  const jednoradkovy = text.replace(/\s+/g, ' ').trim()
  if (jednoradkovy.length <= max) return jednoradkovy
  const rez = jednoradkovy.slice(0, max)
  const mezera = rez.lastIndexOf(' ')
  return (mezera > max / 2 ? rez.slice(0, mezera) : rez).trimEnd() + '…'
}

/**
 * Předmět OP při převodu leadu: název služby, jinak začátek zprávy od klienta,
 * jinak jméno. Nikdy ne technická hlavička formuláře.
 */
export function leadPredmet(lead: { sluzba?: string | null; zprava?: string | null; jmeno: string }): string {
  const sluzba = sluzbaLabel(lead.sluzba)
  if (sluzba) return sluzba
  const zprava = lead.zprava?.trim()
  if (zprava) return zkrat(zprava)
  return lead.jmeno
}
