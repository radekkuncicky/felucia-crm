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
  notifNovyLead: boolean
}

export async function getOrgSettings(orgId: string): Promise<OrgSettingsData> {
  const settings = await prisma.orgSettings.upsert({
    where: { orgId },
    update: {},
    create: { orgId },
  })
  return settings
}
