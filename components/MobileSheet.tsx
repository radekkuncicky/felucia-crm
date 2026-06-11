'use client'

import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function MobileSheet({ open, onClose, title, children }: Props) {
  // Lock body scroll when open on mobile
  useEffect(() => {
    if (open && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div className="md:hidden">
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={onClose}
        />
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#0D1A0E] rounded-t-2xl max-h-[90vh] overflow-y-auto pb-safe">
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mt-3 mb-1" />
          {title && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-green-900/30">
              <h3 className="font-semibold text-base text-gray-900 dark:text-white">{title}</h3>
            </div>
          )}
          <div className="p-4">{children}</div>
        </div>
      </div>

      {/* Desktop: centered modal */}
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative">
          {title && <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">{title}</h3>}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Zavřít"
          >
            ✕
          </button>
          {children}
        </div>
      </div>
    </>
  )
}
