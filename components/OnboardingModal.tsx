'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const STEPS = [
  {
    label: 'Importovat produktový katalog',
    href: '/settings/import-products',
    icon: '📦',
  },
  {
    label: 'Přidat prvního technika',
    href: '/settings/users',
    icon: '👤',
  },
  {
    label: 'Vytvořit první obchodní případ',
    href: '/deals/new',
    icon: '📋',
  },
]

export default function OnboardingModal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('onboarding') === 'true') {
      setOpen(true)
    }
  }, [searchParams])

  function close() {
    setOpen(false)
    // Remove ?onboarding=true from URL without reload
    const url = new URL(window.location.href)
    url.searchParams.delete('onboarding')
    router.replace(url.pathname + (url.search || ''))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-md p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-[#111] dark:text-white" style={{ fontFamily: 'var(--font-montserrat, sans-serif)' }}>
            Vítejte v FELUCIA CRM!
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            Váš účet je připraven. Pojďme nastavit základní věci.
          </p>
        </div>

        {/* Checklist */}
        <div className="space-y-3 mb-8">
          {STEPS.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              onClick={close}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-[#FFC93C] hover:bg-[#FFC93C]/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-slate-600 group-hover:border-[#FFC93C] flex items-center justify-center text-sm flex-shrink-0 transition-colors">
                {step.icon}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-[#111] dark:group-hover:text-white transition-colors">
                {step.label}
              </span>
              <svg className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-[#FFC93C] ml-auto flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={close}
          className="w-full bg-[#FFC93C] hover:bg-[#ffb800] text-[#111] font-bold py-3.5 rounded-xl transition-colors text-sm"
        >
          Začít
        </button>

        <p className="text-center mt-3 text-xs text-gray-400 dark:text-slate-500">
          Tyto kroky můžete dokončit kdykoliv
        </p>
      </div>
    </div>
  )
}
