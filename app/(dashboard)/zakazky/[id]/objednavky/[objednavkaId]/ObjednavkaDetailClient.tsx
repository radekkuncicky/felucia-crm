'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ObjednavkaDetail, { type ObjednavkaDto } from '@/components/objednavky/ObjednavkaDetail'

interface Props {
  objednavka: ObjednavkaDto
  canEdit: boolean
  showNakupky: boolean
  emailConfigured: boolean
  zakazkaId: string
}

export default function ObjednavkaDetailClient({ objednavka: initial, canEdit, showNakupky, emailConfigured, zakazkaId }: Props) {
  const [o, setO] = useState(initial)
  const router = useRouter()
  return (
    <ObjednavkaDetail
      objednavka={o}
      canEdit={canEdit}
      showNakupky={showNakupky}
      emailConfigured={emailConfigured}
      onChange={next => { setO(next); router.refresh() }}
      onDeleted={() => router.push(`/zakazky/${zakazkaId}?tab=objednavky`)}
    />
  )
}
