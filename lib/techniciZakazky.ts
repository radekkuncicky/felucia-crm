import type { orgPrisma } from '@/lib/orgPrisma'
import { sendPushToUsers } from '@/lib/push'

type Db = ReturnType<typeof orgPrisma>

/**
 * Přiřadí technika k zakázce (idempotentně). Nové přiřazení posune zakázku
 * NOVA → PRIRAZENA a pošle technikovi push. Sdílí web (záložka/hlavička)
 * i přiřazení k etapě — technik etapy musí být i na zakázce kvůli přístupu.
 */
export async function priraditTechnikaKZakazce(
  db: Db,
  { orgId, userId, zakazka, technikId }: {
    orgId: string
    userId: string
    zakazka: { id: string; cislo: string; nazev: string; stav: string }
    technikId: string
  },
): Promise<{ novy: boolean; zakazkaNovyStav: 'PRIRAZENA' | null }> {
  const existuje = await db.technikZakazka.findFirst({ where: { zakazkaId: zakazka.id, technikId } })
  if (existuje) return { novy: false, zakazkaNovyStav: null }

  await db.technikZakazka.create({ data: { zakazkaId: zakazka.id, technikId } })
  // První přiřazený technik se stane hlavním, dokud hlavního nikdo neurčí
  await db.zakazka.updateMany({ where: { id: zakazka.id, hlavniTechnikId: null }, data: { hlavniTechnikId: technikId } })

  let zakazkaNovyStav: 'PRIRAZENA' | null = null
  if (zakazka.stav === 'NOVA') {
    await db.$transaction([
      db.zakazka.update({ where: { id: zakazka.id }, data: { stav: 'PRIRAZENA' } }),
      db.auditLog.create({
        data: {
          orgId,
          userId,
          typAkce: 'UPDATE',
          typZaznamu: 'Zakazka',
          zaznamId: zakazka.id,
          zaznamNazev: zakazka.nazev,
          zmeny: { from: 'NOVA', to: 'PRIRAZENA', duvod: 'Přiřazení technika' },
        },
      }),
    ])
    zakazkaNovyStav = 'PRIRAZENA'
  }

  await sendPushToUsers(orgId, [technikId], {
    title: 'Nová zakázka',
    body: `${zakazka.cislo} — ${zakazka.nazev}`,
    data: { type: 'zakazka', zakazkaId: zakazka.id },
  })

  return { novy: true, zakazkaNovyStav }
}

/** Odebere technika ze zakázky i ze všech jejích etap (bez zakázky by na etapu neviděl). */
export async function odebratTechnikaZeZakazky(db: Db, zakazkaId: string, technikId: string) {
  const etapy = await db.zakazkaEtapa.findMany({ where: { zakazkaId, hlavniTechnikId: technikId }, select: { id: true } })
  await db.$transaction([
    db.etapaTechnik.deleteMany({ where: { technikId, etapa: { zakazkaId } } }),
    db.technikZakazka.deleteMany({ where: { zakazkaId, technikId } }),
  ])
  await prevzitHlavnihoTechnikaZakazky(db, zakazkaId, technikId)
  for (const e of etapy) await prevzitHlavnihoTechnikaEtapy(db, e.id, technikId)
}

/** Odebraný hlavní technik zakázky → hlavním se stane nejdřív přiřazený ze zbylých (nebo nikdo). */
export async function prevzitHlavnihoTechnikaZakazky(db: Db, zakazkaId: string, odebranyId: string) {
  const dalsi = await db.technikZakazka.findFirst({ where: { zakazkaId }, orderBy: { prirazeno: 'asc' }, select: { technikId: true } })
  await db.zakazka.updateMany({
    where: { id: zakazkaId, hlavniTechnikId: odebranyId },
    data: { hlavniTechnikId: dalsi?.technikId ?? null },
  })
}

/** Totéž pro etapu (technici etapy). */
export async function prevzitHlavnihoTechnikaEtapy(db: Db, etapaId: string, odebranyId: string) {
  const dalsi = await db.etapaTechnik.findFirst({ where: { etapaId }, orderBy: { prirazeno: 'asc' }, select: { technikId: true } })
  await db.zakazkaEtapa.updateMany({
    where: { id: etapaId, hlavniTechnikId: odebranyId },
    data: { hlavniTechnikId: dalsi?.technikId ?? null },
  })
}
