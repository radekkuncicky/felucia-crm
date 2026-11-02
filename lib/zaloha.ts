/**
 * Záloha na SOD: min. 70 % ceny S DPH (KPI 1, pravidlo R1). Výchozí částka se
 * zaokrouhluje NAHORU na tisíce — kulaté číslo, které 70 % nikdy nepodstřelí.
 * Nižší zálohu lze zadat (výjimku schvaluje jednatel), UI na ni jen upozorní.
 */
export const ZALOHA_MIN_PODIL = 0.7

/** Výchozí záloha: 70 % ceny s DPH nahoru na tisíce */
export function vychoziZaloha(cenaSDph: number): number {
  return cenaSDph > 0 ? Math.ceil((cenaSDph * ZALOHA_MIN_PODIL) / 1000) * 1000 : 0
}

/** Je záloha pod 70 % ceny s DPH? (bez ceny nebo zálohy nic nehlásí) */
export function zalohaPodMinimem(zaloha: number, cenaSDph: number): boolean {
  return zaloha > 0 && cenaSDph > 0 && zaloha < Math.ceil(cenaSDph * ZALOHA_MIN_PODIL)
}
