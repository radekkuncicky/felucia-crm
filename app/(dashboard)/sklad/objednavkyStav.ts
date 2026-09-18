/** Popisky a barvy stavů objednávky (sdílené: /sklad, zakázka, dodavatel) */
export const OBJ_STAV_LABELS: Record<string, string> = {
  NAVRH: 'Návrh',
  ODESLANA: 'Odeslána',
  CASTECNE_DORUCENA: 'Částečně doručena',
  DORUCENA: 'Doručena',
  ZRUSENA: 'Zrušena',
}

export const OBJ_STAV_COLORS: Record<string, string> = {
  NAVRH: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  ODESLANA: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  CASTECNE_DORUCENA: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  DORUCENA: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ZRUSENA: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

/** Otevřená = ještě čeká na (do)dodání */
export const OBJ_OTEVRENE = ['NAVRH', 'ODESLANA', 'CASTECNE_DORUCENA'] as const
