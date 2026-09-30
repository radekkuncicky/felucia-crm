'use client'

import TechniciPicker, { type TechnikRef } from '@/components/TechniciPicker'
import { confirmDialog } from '@/components/ui/confirm'

/** Technici celé zakázky v hlavičce — řídí přístup technika (web i appka). */
export default function ZakazkaTechnici({ zakazkaId, technici, vsichni, canEdit, maEtapy }: {
  zakazkaId: string
  technici: TechnikRef[]
  vsichni: TechnikRef[]
  canEdit: boolean
  maEtapy: boolean
}) {
  return (
    <TechniciPicker
      technici={technici}
      vsichni={vsichni}
      canEdit={canEdit}
      addUrl={`/api/zakazky/${zakazkaId}/technici`}
      confirmRemove={maEtapy
        ? t => confirmDialog(`Odebrat ${t.jmeno} ze zakázky? Zmizí i ze všech etap a přestane zakázku vidět.`, { confirmLabel: 'Odebrat', danger: true })
        : undefined}
    />
  )
}
