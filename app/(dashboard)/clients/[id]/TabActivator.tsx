'use client'

import { useEffect } from 'react'
import { useTabs } from '@/context/TabsContext'

interface Props {
  id: string
  nazev: string
}

export default function TabActivator({ id, nazev }: Props) {
  const { activateTab } = useTabs()

  useEffect(() => {
    activateTab({ id: `client-${id}`, label: nazev, href: `/clients/${id}`, closable: true })
  }, [id, nazev, activateTab])

  return null
}
