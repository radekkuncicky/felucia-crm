'use client'

import { useState } from 'react'

interface Props {
  /** URL PDF, které se má zobrazit (musí vracet Content-Disposition: inline) */
  src: string
  title: string
  /** Odkaz ke stažení souboru (volitelné) */
  downloadHref?: string
  onClose: () => void
}

/**
 * Náhled PDF přímo v prohlížeči (iframe) — bez stahování souboru.
 * Vykresluje se nad ostatními modaly (z-[60]).
 */
export default function PdfNahledModal({ src, title, downloadHref, onClose }: Props) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h2>
          <div className="flex items-center gap-2">
            {downloadHref && (
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Stáhnout
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
              aria-label="Zavřít náhled"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="relative flex-1 bg-gray-100 dark:bg-slate-900">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 dark:text-slate-400">
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generuji náhled…
            </div>
          )}
          <iframe
            src={src}
            title={title}
            onLoad={() => setLoaded(true)}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  )
}

/** Tlačítko „Náhled", které otevře PdfNahledModal. */
export function PdfNahledButton({ src, title, downloadHref, className, children }: {
  src: string
  title: string
  downloadHref?: string
  className?: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Náhled
          </>
        )}
      </button>
      {open && <PdfNahledModal src={src} title={title} downloadHref={downloadHref} onClose={() => setOpen(false)} />}
    </>
  )
}
