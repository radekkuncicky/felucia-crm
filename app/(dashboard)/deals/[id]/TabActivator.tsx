'use client'

import { useEffect } from 'react'
import { useTabs } from '@/context/TabsContext'

const techShortcuts: Record<string, string> = {
  KLIMA: 'KL',
  TEPELNE_CERPADLO: 'TČ',
  REKUPERACE: 'RK',
  PODLAHOVE_TOPENI: 'PV',
  VZDUCHOTECHNIKA: 'VZT',
  JINE: '',
}

interface Props {
  id: string
  kod: string | null
  technologie: string
}

export default function TabActivator({ id, kod, technologie }: Props) {
  const { activateTab } = useTabs()

  useEffect(() => {
    const shortcut = techShortcuts[technologie] ?? ''
    const label = [kod, shortcut].filter(Boolean).join(' ') || id.slice(0, 8)
    activateTab({ id: `deal-${id}`, label, href: `/deals/${id}`, closable: true })
  }, [id, kod, technologie, activateTab])

  return null
}
