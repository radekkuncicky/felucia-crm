import type { ZakazkaStav } from '@prisma/client'
import type { OrgPrismaClient } from './orgPrisma'

/** Povolené přechody stavu zakázky — jediný zdroj pro web (PATCH /api/zakazky/[id]/stav) i AI asistentku */
export const ZAKAZKA_PRECHODY: Record<ZakazkaStav, ZakazkaStav[]> = {
  NOVA: ['PRIRAZENA'],
  PRIRAZENA: ['NOVA', 'V_REALIZACI'],
  V_REALIZACI: ['PRIRAZENA', 'PREDANA'],
  PREDANA: ['V_REALIZACI', 'VYUCTOVANA'],
  VYUCTOVANA: ['PREDANA', 'HOTOVO'],
  HOTOVO: ['VYUCTOVANA'],
}

export const ZAKAZKA_STAV_LABEL: Record<ZakazkaStav, string> = {
  NOVA: 'Nová',
  PRIRAZENA: 'Přiřazená',
  V_REALIZACI: 'V realizaci',
  PREDANA: 'Předaná',
  VYUCTOVANA: 'Vyúčtovaná',
  HOTOVO: 'Hotovo',
}

export function jeZakazkaStav(v: unknown): v is ZakazkaStav {
  return typeof v === 'string' && v in ZAKAZKA_PRECHODY
}

export type Aktor = { actorType: 'user' } | { actorType: 'ai'; aiSource: 'web' | 'mcp' }

/**
 * Změní stav zakázky (kontrola přechodu + záznam do historie). Přístup k zakázce
 * a právo editace ověřuje volající.
 */
export async function zmenStavZakazky(
  db: OrgPrismaClient,
  p: { orgId: string; userId: string; zakazkaId: string; stav: ZakazkaStav; aktor?: Aktor },
) {
  const zakazka = await db.zakazka.findFirst({ where: { id: p.zakazkaId, orgId: p.orgId } })
  if (!zakazka) return { ok: false as const, status: 404, chyba: 'Zakázka nenalezena' }

  if (!(ZAKAZKA_PRECHODY[zakazka.stav] ?? []).includes(p.stav)) {
    return { ok: false as const, status: 422, chyba: `Přechod ze stavu ${zakazka.stav} do ${p.stav} není povolen` }
  }

  const updated = await db.zakazka.update({
    where: { id: p.zakazkaId },
    data: { stav: p.stav, uzavreno: p.stav === 'HOTOVO' ? new Date() : undefined },
  })

  const aktor = p.aktor ?? { actorType: 'user' }
  await db.auditLog.create({
    data: {
      orgId: p.orgId,
      userId: p.userId,
      typAkce: 'UPDATE',
      typZaznamu: 'Zakazka',
      zaznamId: p.zakazkaId,
      zaznamNazev: zakazka.cislo,
      zmeny: { stavPred: zakazka.stav, stavPo: p.stav },
      actorType: aktor.actorType,
      aiSource: aktor.actorType === 'ai' ? aktor.aiSource : null,
    },
  })

  return { ok: true as const, zakazka: updated, stavPred: zakazka.stav }
}
