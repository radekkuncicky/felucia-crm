'use client'

import { forwardRef, useState } from 'react'
import Link from 'next/link'
import { Input, type InputProps } from '@/components/ui/Field'

/**
 * Společný rámec stránek mimo aplikaci (zapomenuté heslo, nastavení hesla,
 * přihlášení odkazem) — stejný vzhled jako přihlášení: světle zelená plocha,
 * list Felucie, v tmavém režimu marketingová „noc“.
 */
export function AuthShell({ podtitul, children }: { podtitul?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4FAF4] dark:bg-[#0A120A] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-7">
          <Link href="/auth/signin" className="inline-flex flex-col items-center gap-2.5 no-underline">
            <LogoLeaf />
            <span className="font-['Space_Grotesk',sans-serif] text-2xl font-bold tracking-tight text-[#1A2E1B] dark:text-[#E8F5E9]">felucia</span>
          </Link>
          {podtitul && <p className="mt-1.5 text-[13px] text-[#4A6B4A] dark:text-[#6B8F6B]">{podtitul}</p>}
        </div>
        <div className="rounded-[20px] border border-[#E0EBE0] dark:border-[#4CAF50]/15 bg-white dark:bg-[#0D1A0E] px-7 py-8">
          {children}
        </div>
      </div>
    </div>
  )
}

function LogoLeaf() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden>
      <path d="M20 4C14 4 9 9.5 9 16c0 4 1.5 7.5 4 10l7 10 7-10c2.5-2.5 4-6 4-10 0-6.5-5-12-11-12z" fill="#4CAF50" />
      <path d="M20 10 C20 10 15 14 15 18 C15 20.5 17.5 22 20 22 C20 22 20 16 20 10Z" className="fill-white dark:fill-[#0A120A]" opacity="0.8" />
      <path d="M20 10 C20 10 25 14 25 18 C25 20.5 22.5 22 20 22 C20 22 20 16 20 10Z" className="fill-white dark:fill-[#0A120A]" opacity="0.5" />
    </svg>
  )
}

/** Pole hesla s přepínačem „zobrazit“ — na telefonu se překlep v hesle jinak nepozná */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'kind'>>(function PasswordInput({ className, ...rest }, ref) {
  const [vidim, setVidim] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} {...rest} type={vidim ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`pr-20 ${className ?? ''}`} />
      <button
        type="button"
        onClick={() => setVidim(v => !v)}
        data-compact=""
        className="hit-area absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
        aria-label={vidim ? 'Skrýt heslo' : 'Zobrazit heslo'}
        aria-pressed={vidim}
      >
        {vidim ? 'Skrýt' : 'Zobrazit'}
      </button>
    </div>
  )
})

export function AuthAlert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'ok'; children: React.ReactNode }) {
  const cls = tone === 'error'
    ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
    : tone === 'ok'
      ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
      : 'bg-[#F4FAF4] border-[#C8E6C9] text-[#1A2E1B] dark:bg-[#4CAF50]/10 dark:border-[#4CAF50]/25 dark:text-[#C8E6C9]'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>
}
