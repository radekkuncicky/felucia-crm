import type { OrgPrismaClient } from './orgPrisma'

/** SOD v těchto stavech už je u podpisu nebo podepsaná — aktivní nabídka OP se pak nemění */
export const SOD_ZAMYKA = ['K_INTERNIMU_PODPISU', 'ODESLANO', 'PODEPSANO'] as const

type NabidkaZamek = { dealId: string; aktivni: boolean; stav: string; odeslanoAt: Date | null; shareTokenHash: string | null }

/** Co v OP zamyká aktivní nabídku: smlouva u podpisu / podepsaná, jinak zakázka */
export type PodkladOp = { typ: 'sod' | 'zakazka'; cislo: string } | null

export async function podkladOp(db: OrgPrismaClient, orgId: string, dealId: string): Promise<PodkladOp> {
  const [sod, zakazka] = await Promise.all([
    db.sod.findFirst({ where: { orgId, dealId, stav: { in: [...SOD_ZAMYKA] } }, select: { cislo: true } }),
    db.zakazka.findFirst({ where: { orgId, opId: dealId }, select: { cislo: true } }),
  ])
  return sod ? { typ: 'sod', cislo: sod.cislo } : zakazka ? { typ: 'zakazka', cislo: zakazka.cislo } : null
}

/**
 * Proč nabídku nejde upravit ani smazat (null = jde) — sdílí API i editor v UI.
 * Akceptovaná nabídka je uzavřená; aktivní nabídka je podkladem SOD u podpisu
 * nebo zakázky. Odeslaná nabídka upravit jde — běžně se opravuje a posílá znovu.
 */
export function zamekNabidky(q: { aktivni: boolean; stav: string }, podklad: PodkladOp): string | null {
  if (q.stav === 'AKCEPTOVANA') return 'Nabídka je akceptovaná klientem — udělej z ní kopii a uprav tu.'
  if (!q.aktivni || !podklad) return null
  return podklad.typ === 'sod'
    ? `Aktivní nabídka je podkladem smlouvy ${podklad.cislo}, která je u podpisu nebo podepsaná — uprav kopii.`
    : `Aktivní nabídka je podkladem zakázky ${podklad.cislo} — uprav kopii.`
}

export async function duvodZamkuNabidky(db: OrgPrismaClient, orgId: string, q: NabidkaZamek): Promise<string | null> {
  if (q.stav === 'AKCEPTOVANA' || !q.aktivni) return zamekNabidky(q, null)
  return zamekNabidky(q, await podkladOp(db, orgId, q.dealId))
}

/**
 * Proč v OP nejde změnit aktivní nabídku (prázdné = jde): současná aktivní je
 * akceptovaná, nebo OP má smlouvu u podpisu / podepsanou či zakázku — aktivní
 * nabídka je jejich cenový podklad. Hlídá se i u OP zatím bez aktivní nabídky.
 */
export async function duvodyZamkuAktivace(
  db: OrgPrismaClient, orgId: string, dealId: string, soucasna: { kod: string | null; stav: string } | null,
): Promise<string[]> {
  const [sod, zakazka] = await Promise.all([
    db.sod.findFirst({ where: { orgId, dealId, stav: { in: [...SOD_ZAMYKA] } }, select: { cislo: true, stav: true } }),
    db.zakazka.findFirst({ where: { orgId, opId: dealId }, select: { cislo: true } }),
  ])
  return [
    ...(soucasna?.stav === 'AKCEPTOVANA' ? [`současná aktivní nabídka ${soucasna.kod ?? ''} je akceptovaná klientem`] : []),
    ...(sod ? [`OP má smlouvu ${sod.cislo} ${sod.stav === 'PODEPSANO' ? 'podepsanou' : 'u podpisu'}`] : []),
    ...(zakazka ? [`OP má zakázku ${zakazka.cislo}`] : []),
  ]
}

/** Proč nabídku nejde smazat (null = jde): jen neaktivní rozpracovaná, nikdy neodeslaná ani nesdílená */
export function duvodNelzeSmazat(q: NabidkaZamek): string | null {
  if (q.aktivni) return 'Aktivní nabídku nejde smazat — nejdřív nastav jako aktivní jinou nabídku OP (set_active_quote).'
  if (q.stav !== 'ROZPRACOVANA' || q.odeslanoAt) return 'Nabídka už byla odeslaná klientovi — smazat jde jen rozpracovaná.'
  if (q.shareTokenHash) return 'Nabídka má sdílený odkaz pro klienta — nejdřív ho zruš.'
  return null
}
