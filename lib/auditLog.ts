import { prisma } from './prisma'
import { TypAkce, Prisma } from '@prisma/client'
import { readImpersonateCookie } from './impersonate'

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
    // Během impersonace se akce dějí pod účtem admina zákazníka — do záznamu
    // se přidá skutečný původce (superadmin), aby byl zásah dohledatelný
    const imp = readImpersonateCookie()
    const zmeny = imp
      ? { ...(params.zmeny ?? {}), _impersonator: { superAdminId: imp.superAdminId, jmeno: imp.superAdminJmeno } }
      : (params.zmeny ?? {})
    await prisma.auditLog.create({
      data: {
        orgId: params.orgId,
        userId: params.userId ?? null,
        typAkce: params.typAkce,
        typZaznamu: params.typZaznamu,
        zaznamId: params.zaznamId,
        zaznamNazev: params.zaznamNazev,
        zmeny: zmeny as Prisma.InputJsonValue,
      },
    })
  } catch {
    // Audit log nikdy nesmí shodit hlavní akci
  }
}
