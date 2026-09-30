/** Spojí CSS třídy, vynechá prázdné hodnoty (náhrada clsx bez závislosti). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
