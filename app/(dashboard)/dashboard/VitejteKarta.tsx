'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Uvítání pro nově pozvaného kolegu (ne admina — ten má průvodce nastavením
 * firmy): tři první kroky podle role. Zavření si pamatuje prohlížeč.
 */
export default function VitejteKarta({ userId, technik, obchod, appUrl }: { userId: string; technik: boolean; obchod: boolean; appUrl: string | null }) {
  const klic = `felucia-vitejte-${userId}`
  const [skryto, setSkryto] = useState(true)

  useEffect(() => {
    try { setSkryto(localStorage.getItem(klic) === '1') } catch { setSkryto(false) }
  }, [klic])

  if (skryto) return null

  function zavrit() {
    setSkryto(true)
    try { localStorage.setItem(klic, '1') } catch { /* bez úložiště jen pro tuto návštěvu */ }
  }

  const kroky: { text: React.ReactNode; href?: string }[] = technik
    ? [
        { text: <>Stáhněte si appku <strong>Felucia Tech</strong> a přihlaste se stejným e-mailem a heslem — v terénu pracujete v ní.</>, href: appUrl ?? undefined },
        { text: 'V Zakázkách uvidíte montáže a servisy, na které vás vedoucí naplánuje.', href: '/zakazky' },
        { text: 'Doplňte si v profilu telefon, ať se vám dá dovolat.', href: '/settings/profile' },
      ]
    : obchod
      ? [
          { text: 'Nahoře v „Co mám dělat“ najdete své úkoly a připomínky.' },
          { text: 'Nový obchodní případ založíte tlačítkem „Nový případ“ — klient se dohledá podle telefonu.', href: '/deals/new' },
          { text: 'Doplňte si v profilu telefon a fotku — objeví se v nabídkách klientům.', href: '/settings/profile' },
        ]
      : [
          { text: 'V Zakázkách najdete vše, co firma realizuje.', href: '/zakazky' },
          { text: 'Doplňte si v profilu telefon a fotku.', href: '/settings/profile' },
        ]

  return (
    <section className="rounded-xl border border-[#C8E6C9] dark:border-slate-700 bg-[#F4FAF4] dark:bg-slate-800 p-5" aria-labelledby="vitejte-nadpis">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="vitejte-nadpis" className="font-semibold text-gray-900 dark:text-white">Vítejte ve Felucii 👋</h2>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-0.5">Tři věci na začátek:</p>
        </div>
        <button type="button" onClick={zavrit} className="text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap">
          Rozumím, skrýt
        </button>
      </div>
      <ol className="mt-3 space-y-2">
        {kroky.map((k, i) => (
          <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-slate-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
            <span className="pt-0.5">
              {k.text}
              {k.href && (k.href.startsWith('http')
                ? <> <a href={k.href} className="font-medium text-primary hover:underline">Stáhnout →</a></>
                : <> <Link href={k.href} className="font-medium text-primary hover:underline">Otevřít →</Link></>)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
