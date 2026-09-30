'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  /** Popis pro čtečky, když dialog nemá viditelný nadpis */
  ariaLabel?: string
  children: React.ReactNode
  /** Tlačítka dole (zarovnaná vpravo) */
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Klik na ztmavené pozadí zavře dialog (výchozí ano) */
  closeOnBackdrop?: boolean
  /** Skrýt křížek v hlavičce (např. potvrzovací dialog) */
  hideClose?: boolean
  /** Vrstva — potvrzení otevírané z jiného dialogu musí být výš */
  layer?: 'base' | 'top'
  /** Na mobilu jako spodní panel (výchozí ano) */
  sheet?: boolean
}

const SIZE = { sm: 'md:max-w-sm', md: 'md:max-w-md', lg: 'md:max-w-lg', xl: 'md:max-w-2xl' }
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Zásobník otevřených dialogů — Esc/Tab řeší jen ten nejvyšší
const stack: string[] = []
let scrollLocks = 0

/**
 * Sdílený dialog (portál, ne nativní <dialog> — top layer by překryl toasty).
 * role=dialog + aria-modal, Esc, klik mimo, focus trap, návrat focusu, zámek scrollu.
 */
export function Dialog({
  open, onClose, title, ariaLabel, children, footer, size = 'md',
  closeOnBackdrop = true, hideClose = false, layer = 'base', sheet = true,
}: DialogProps) {
  const id = useId()
  const titleId = `${id}-title`
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    stack.push(id)
    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'

    // Fokus dovnitř: první pole s autoFocus, jinak první ovladatelný prvek, jinak panel
    const t = setTimeout(() => {
      const panel = panelRef.current
      if (!panel || panel.contains(document.activeElement)) return
      const auto = panel.querySelector<HTMLElement>('[autofocus],[data-autofocus]')
      const first = panel.querySelector<HTMLElement>(`[data-dialog-body] ${FOCUSABLE}`) ?? panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(auto ?? first ?? panel).focus()
    }, 0)

    function onKey(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null)
        if (items.length === 0) { e.preventDefault(); return }
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      const i = stack.lastIndexOf(id)
      if (i >= 0) stack.splice(i, 1)
      if (--scrollLocks === 0) document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [open, id])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex justify-center bg-black/50',
        layer === 'top' ? 'z-[60]' : 'z-50',
        sheet ? 'items-end md:items-center md:p-4' : 'items-center p-4',
      )}
      onMouseDown={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        className={cn(
          'w-full bg-white dark:bg-slate-800 shadow-xl flex flex-col max-h-[90vh] outline-none',
          sheet ? 'rounded-t-2xl md:rounded-2xl pb-safe md:pb-0' : 'rounded-2xl',
          SIZE[size],
        )}
      >
        {sheet && <div className="md:hidden w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mt-2.5" aria-hidden />}
        {(title || !hideClose) && (
          <div className={cn('flex items-center gap-3 px-5 pt-4', title ? 'pb-3 border-b border-gray-100 dark:border-slate-700' : 'pb-0')}>
            {title && <h2 id={titleId} className="flex-1 text-base font-semibold text-gray-900 dark:text-white">{title}</h2>}
            {!hideClose && (
              <IconButton label="Zavřít" onClick={onClose} className={title ? '-mr-2' : 'ml-auto -mr-2'}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </IconButton>
            )}
          </div>
        )}
        <div data-dialog-body className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 flex flex-wrap justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
