import { prisma } from './prisma'

export type OrgSettingsData = {
  id: string
  orgId: string
  modulServis: boolean
  modulAnalytiky: boolean
  modulDokumenty: boolean
  modulDasa: boolean
  modulCeniky: boolean
  povinnaAktivitaUOP: boolean
  automatickyServis: boolean
  schvaleniNabidky: boolean
  notifOpBezAktivity: boolean
  notifBlizkTermin: boolean
  notifNovyOP: boolean
  notifDniBezeAktivity: number
  defaultDphSazba: number
  defaultPlatnostDni: number
  zobrazitNakladoveCeny: boolean
  singleTemplate: boolean
  obchodnikJmeno: string | null
  obchodnikTelefon: string | null
  primaryColor: string
  sendServisniProtokolEmail: boolean
  zakazkyDefaultVedouciId: string | null
  zakazkyAutoAssignVedouci: boolean
  zakazkyAutoVyuctovani: boolean
  zakazkyPrefix: string | null
  zakazkyDefaultDph: number
  storageLimit: bigint
  modulLeady: boolean
  modulKpi: boolean
  notifNovyLead: boolean
  dokumentyStyl: string
  dokumentyPaticka: string | null
  dokumentyCislovani: boolean
  dokumentyHeaderHtml: string | null
  dokumentyFooterHtml: string | null
}

export async function getOrgSettings(orgId: string): Promise<OrgSettingsData> {
  try {
    return await prisma.orgSettings.upsert({
      where: { orgId },
      update: {},
      create: { orgId },
    })
  } catch (err) {
    // souběžné první volání (např. Promise.all) — řádek mezitím vložil jiný požadavek
    if ((err as { code?: string }).code !== 'P2002') throw err
    return prisma.orgSettings.findUniqueOrThrow({ where: { orgId } })
  }
}
