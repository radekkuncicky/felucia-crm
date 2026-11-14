/**
 * Poznámka technika z appky → bell notifikace tomu, kdo ji má číst (audit APP_TECHNIK D1).
 * Příjemce: vedoucí zakázky; bez vedoucího manažeři (role MANAZER), bez nich vedení (ADMIN/JEDNATEL).
 * Obchodník ne — byl by to šum. Autor sám sobě nic nedostane.
 */
import { orgPrisma } from './orgPrisma'
import { createNotification } from './createNotification'

export async function prijemciPoznamky(orgId: string, zakazkaId: string, autorId: string): Promise<string[]> {
  const db = orgPrisma(orgId)
  const zakazka = await db.zakazka.findFirst({
    where: { id: zakazkaId, orgId },
    select: { vedouci: { select: { id: true, aktivni: true } } },
  })
  if (!zakazka) return []
  if (zakazka.vedouci?.aktivni) return zakazka.vedouci.id === autorId ? [] : [zakazka.vedouci.id]

  for (const role of [['MANAZER'], ['ADMIN', 'JEDNATEL']] as const) {
    const lide = await db.user.findMany({
      where: { orgId, aktivni: true, role: { in: [...role] }, id: { not: autorId } },
      select: { id: true },
    })
    if (lide.length > 0) return lide.map(u => u.id)
  }
  return []
}

export async function oznamPoznamkuTechnika(p: {
  orgId: string; zakazkaId: string; autorId: string; autorJmeno: string; text: string
}): Promise<void> {
  try {
    const prijemci = await prijemciPoznamky(p.orgId, p.zakazkaId, p.autorId)
    if (prijemci.length === 0) return
    const zakazka = await orgPrisma(p.orgId).zakazka.findFirst({
      where: { id: p.zakazkaId, orgId: p.orgId },
      select: { cislo: true },
    })
    const kratce = p.text.length > 120 ? `${p.text.slice(0, 117)}…` : p.text
    for (const userId of prijemci) {
      await createNotification({
        orgId: p.orgId,
        userId,
        typ: 'POZNAMKA_TECHNIKA',
        zprava: `${p.autorJmeno} k ${zakazka?.cislo ?? 'zakázce'}: „${kratce}“`,
        url: `/zakazky/${p.zakazkaId}?tab=historie`,
      })
    }
  } catch (e) {
    console.error('[poznamka-technika]', e) // notifikace nesmí shodit uložení poznámky
  }
}
