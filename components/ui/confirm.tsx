'use client'

import { useState, useEffect } from 'react'
import ConfirmModal from '@/components/ConfirmModal'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type Trigger = (message: string, opts?: ConfirmOptions) => Promise<boolean>

let trigger: Trigger | null = null

/** Imperativní náhrada window.confirm() — vrací Promise<boolean>, renderuje ConfirmModal. */
export function confirmDialog(message: string, opts?: ConfirmOptions): Promise<boolean> {
  // eslint-disable-next-line no-restricted-properties -- záměrný fallback, když ConfirmHost ještě není namountovaný
  if (!trigger) return Promise.resolve(window.confirm(message))
  return trigger(message, opts)
}

export function ConfirmHost() {
  const [state, setState] = useState<{ message: string; opts?: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

  useEffect(() => {
    trigger = (message, opts) => new Promise(resolve => setState({ message, opts, resolve }))
    return () => { trigger = null }
  }, [])

  if (!state) return null

  const close = (value: boolean) => {
    state.resolve(value)
    setState(null)
  }

  return (
    <ConfirmModal
      isOpen
      title={state.opts?.title}
      message={state.message}
      confirmLabel={state.opts?.confirmLabel}
      cancelLabel={state.opts?.cancelLabel}
      danger={state.opts?.danger ?? true}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  )
}
