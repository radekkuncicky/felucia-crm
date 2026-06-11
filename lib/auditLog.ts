import { prisma } from './prisma'
import { TypAkce, Prisma } from '@prisma/client'

interface LogParams {
  orgId: string
  userId?: string | null
  typAkce: TypAkce
  typZaznamu: string
  zaznamId: string
  zaznamNazev: string
  zmeny?: Record<string, unknown>
}

export async function logAction(params: LogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: params.orgId,
        userId: params.userId ?? null,
        typAkce: params.typAkce,
        typZaznamu: params.typZaznamu,
        zaznamId: params.zaznamId,
        zaznamNazev: params.zaznamNazev,
        zmeny: (params.zmeny ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch {
    // Audit log nikdy nesmí shodit hlavní akci
  }
}
