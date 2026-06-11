import { prisma } from './prisma'

type TypAkce = 'CREATE' | 'UPDATE' | 'DELETE'

export async function logAudit(opts: {
  orgId: string
  userId?: string | null
  typAkce: TypAkce
  typZaznamu: string
  zaznamId: string
  zaznamNazev: string
  zmeny?: Record<string, unknown>
}) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: opts.orgId,
        userId: opts.userId ?? null,
        typAkce: opts.typAkce,
        typZaznamu: opts.typZaznamu,
        zaznamId: opts.zaznamId,
        zaznamNazev: opts.zaznamNazev,
        zmeny: (opts.zmeny ?? {}) as object,
      },
    })
  } catch {
    // never fail the main request due to audit logging
  }
}
