import type { Permissions } from '@/lib/permissions'

/**
 * Kontext volání nástroje AI asistentky. Sestavuje ho VŽDY server — ze session
 * (web) nebo z ověřeného tokenu (MCP); model ho nikdy nedodává.
 */
export interface AiKontext {
  orgId: string
  userId: string
  role: string
  jmeno: string
  perms: Permissions
  zdroj: 'web' | 'mcp'
}

export interface AiToolResult {
  result: string
  navigateTo?: string
}

/** Shrnutí zápisové akce pro kartu „Potvrdit / Zrušit" */
export interface AiNahledAkce {
  titulek: string
  radky: string[]
}
