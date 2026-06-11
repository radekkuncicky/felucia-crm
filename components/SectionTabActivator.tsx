'use client'

import { useEffect } from 'react'
import { useTabs } from '@/context/TabsContext'

interface Props {
  id: string
  label: string
  href: string
}

export default function SectionTabActivator({ id, label, href }: Props) {
  const { activateTab } = useTabs()
  useEffect(() => {
    activateTab({ id, label, href, closable: true })
  }, [id, label, href, activateTab])
  return null
}
