'use client'

import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

interface Props {
  isOpen: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title = 'Potvrdit akci',
  message,
  confirmLabel = 'Potvrdit',
  cancelLabel = 'Zrušit',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    // layer=top: musí být nad ostatními modaly, protože se často potvrzuje
    // mazání zevnitř už otevřeného editačního modalu
    <Dialog
      open={isOpen}
      onClose={() => { if (!loading) onCancel() }}
      title={title}
      size="sm"
      layer="top"
      hideClose
      sheet={false}
      footer={
        <>
          {/* Výchozí focus: u nevratné akce na Zrušit, ať Enter nic omylem nesmaže */}
          <Button variant="secondary" onClick={onCancel} disabled={loading} data-autofocus={danger ? '' : undefined}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus={danger ? undefined : ''}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line">{message}</p>
    </Dialog>
  )
}
