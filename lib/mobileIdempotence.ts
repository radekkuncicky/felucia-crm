import { Prisma } from '@prisma/client'

/**
 * Idempotence zápisů z offline fronty appky. Appka posílá `mobileId`
 * (uuid) a při výpadku stejný požadavek opakuje. Opakovaný `mobileId`
 * vrátí už uložený záznam (200), nikdy 409 — jinak by ho fronta brala jako
 * trvalou chybu. Souběh dvou stejných požadavků zachytí unique index
 * (P2002) a záznam se dohledá.
 */

/** Platné mobileId: 8–64 znaků [A-Za-z0-9_-], jinak null (zápis bez idempotence) */
export function parseMobileId(v: unknown): string | null {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : null
}

function jeKolizeMobileId(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false
  const target = (e.meta as { target?: unknown } | undefined)?.target
  if (Array.isArray(target)) return target.includes('mobileId')
  return typeof target === 'string' ? target.includes('mobileId') : true
}

export class MobileIdKolize extends Error {
  constructor() {
    super('mobileId patří jinému záznamu')
  }
}

/**
 * `najdi` hledá podle mobileId v rámci orgu, `vytvor` zakládá.
 * Vrací { zaznam, novy }. Bez mobileId jen zavolá `vytvor`.
 */
export async function idempotentne<T>(
  mobileId: string | null,
  najdi: (mobileId: string) => Promise<T | null>,
  vytvor: () => Promise<T>,
): Promise<{ zaznam: T; novy: boolean }> {
  if (!mobileId) return { zaznam: await vytvor(), novy: true }
  const existujici = await najdi(mobileId)
  if (existujici) return { zaznam: existujici, novy: false }
  try {
    return { zaznam: await vytvor(), novy: true }
  } catch (e) {
    if (!jeKolizeMobileId(e)) throw e
    const po = await najdi(mobileId)
    // kolize s cizím orgem (orgPrisma ho nevidí) — nemělo by nastat (uuid)
    if (!po) throw new MobileIdKolize()
    return { zaznam: po, novy: false }
  }
}
