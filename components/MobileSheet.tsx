'use client'

import { Dialog } from '@/components/ui/Dialog'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/** Na mobilu spodní panel, na desktopu dialog uprostřed — tenká vrstva nad ui/Dialog. */
export default function MobileSheet({ open, onClose, title, children }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={title} ariaLabel={title} size="lg">
      {children}
    </Dialog>
  )
}
