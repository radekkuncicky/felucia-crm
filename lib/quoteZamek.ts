import type { OrgPrismaClient } from './orgPrisma'

/** SOD v těchto stavech už je u podpisu nebo podepsaná — aktivní nabídka OP se pak nemění */
export const SOD_ZAMYKA = ['K_INTERNIMU_PODPISU', 'ODESLANO', 'PODEPSANO'] as const

type NabidkaZamek = { dealId: string; aktivni: boolean; stav: string; odeslanoAt: Date | null; shareTokenHash: string | null }

/**
 * Proč nabídku nejde upravit (null = jde). Akceptovaná nabídka je uzavřená;
 * aktivní nabídka je podkladem SOD u podpisu nebo zakázky. Odeslaná
 * nabídka upravit jde — v UI se běžně opravuje a posílá znovu.
 */
export async function duvodZamkuNabidky(db: OrgPrismaClient, orgId: string, q: NabidkaZamek): Promise<string | null> {
  if (q.stav === 'AKCEPTOVANA') return 'Nabídka je akceptovaná klientem — udělej z ní kopii a uprav tu.'
  if (!q.aktivni) return null
  const [sod, zakazka] = await Promise.all([
    db.sod.findFirst({ where: { orgId, dealId: q.dealId, stav: { in: [...SOD_ZAMYKA] } }, select: { cislo: true } }),
    db.zakazka.findFirst({ where: { orgId, opId: q.dealId }, select: { cislo: true } }),
  ])
  if (sod) return `Aktivní nabídka je podkladem smlouvy ${sod.cislo}, která je u podpisu nebo podepsaná — uprav kopii.`
  if (zakazka) return `Aktivní nabídka je podkladem zakázky ${zakazka.cislo} — uprav kopii.`
  return null
}

/** Proč nabídku nejde smazat (null = jde): jen neaktivní rozpracovaná, nikdy neodeslaná ani nesdílená */
export function duvodNelzeSmazat(q: NabidkaZamek): string | null {
  if (q.aktivni) return 'Aktivní nabídku nejde smazat — nejdřív označ jako aktivní jinou.'
  if (q.stav !== 'ROZPRACOVANA' || q.odeslanoAt) return 'Nabídka už byla odeslaná klientovi — smazat jde jen rozpracovaná.'
  if (q.shareTokenHash) return 'Nabídka má sdílený odkaz pro klienta — nejdřív ho zruš.'
  return null
}
