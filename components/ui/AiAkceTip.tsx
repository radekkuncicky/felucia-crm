'use client'

import { InfoTip } from './InfoTip'

export const AI_ZDROJ_LABEL: Record<string, string> = { web: 'web', mcp: 'hlasový konektor' }

/**
 * Nenápadné označení záznamu v Historii, který provedla AI asistentka jménem
 * uživatele: malá jiskra v barvě metadat, vysvětlení až na hover / ťuknutí.
 */
export function AiAkceTip({ zdroj }: { zdroj: string | null | undefined }) {
  const text = `Přes AI asistentku (${AI_ZDROJ_LABEL[zdroj ?? ''] ?? 'web'})`
  return (
    <InfoTip
      text={text}
      label={text}
      className="align-middle"
      icon={
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 11l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13z" />
        </svg>
      }
    />
  )
}
