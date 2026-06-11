'use client'

import { createContext, useContext, useState } from 'react'
import type { OrgSettingsData } from '@/lib/orgSettings'

const defaultSettings: OrgSettingsData = {
  id: '',
  orgId: '',
  modulServis: true,
  modulAnalytiky: true,
  modulDokumenty: true,
  modulDasa: true,
  modulCeniky: true,
  povinnaAktivitaUOP: false,
  automatickyServis: true,
  schvaleniNabidky: false,
  notifOpBezAktivity: true,
  notifBlizkTermin: true,
  notifNovyOP: true,
  notifDniBezeAktivity: 7,
  defaultDphSazba: 12,
  defaultPlatnostDni: 30,
  zobrazitNakladoveCeny: false,
  singleTemplate: true,
  obchodnikJmeno: null,
  obchodnikTelefon: null,
  primaryColor: '#FFC93C',
  sendServisniProtokolEmail: false,
  zakazkyDefaultVedouciId: null,
  zakazkyAutoAssignVedouci: false,
  zakazkyAutoVyuctovani: true,
  zakazkyPrefix: null,
  zakazkyDefaultDph: 12,
  storageLimit: BigInt(3 * 1024 * 1024 * 1024),
  modulLeady: true,
  notifNovyLead: true,
}

const OrgSettingsContext = createContext<OrgSettingsData>(defaultSettings)
const OrgSettingsUpdateContext = createContext<(patch: Partial<OrgSettingsData>) => void>(() => {})

export function OrgSettingsProvider({
  settings: initial,
  children,
}: {
  settings: OrgSettingsData
  children: React.ReactNode
}) {
  const [settings, setSettings] = useState<OrgSettingsData>(initial)

  function updateSettings(patch: Partial<OrgSettingsData>) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  return (
    <OrgSettingsContext.Provider value={settings}>
      <OrgSettingsUpdateContext.Provider value={updateSettings}>
        {children}
      </OrgSettingsUpdateContext.Provider>
    </OrgSettingsContext.Provider>
  )
}

export function useOrgSettings(): OrgSettingsData {
  return useContext(OrgSettingsContext)
}

/** Call this to sync context after a successful PATCH /api/settings/org-settings */
export function useUpdateOrgSettings(): (patch: Partial<OrgSettingsData>) => void {
  return useContext(OrgSettingsUpdateContext)
}
