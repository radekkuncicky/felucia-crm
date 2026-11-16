'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { techLabels, zamereniStavLabels, zamereniFotoTagLabels } from '@/lib/constants'
import { NavigateButton } from '@/components/NavigateButton'
import { Dialog } from '@/components/ui/Dialog'
import type { ZamereniPrehled as ZamereniItem } from '@/lib/zamereniPrehled'

type Foto = ZamereniItem['fotky'][number]

/**
 * Zaměření z appky Felucia Sales (jen čtení): odpovědi po sekcích + fotky.
 * Detail OP (záložka Zaměření) i zakázka (Podklady, s odkazem na OP).
 */
export default function ZamereniPrehled({ zamereni, opOdkaz, skrytPrazdne }: {
  zamereni: ZamereniItem[]
  /** odkaz zpět na OP (v zakázce) */
  opOdkaz?: { href: string; label: string }
  /** bez zaměření nic nevykreslit (v zakázce) */
  skrytPrazdne?: boolean
}) {
  const [aktivniId, setAktivniId] = useState(zamereni[0]?.id ?? null)
  const [lightbox, setLightbox] = useState<Foto | null>(null)

  if (zamereni.length === 0) {
    if (skrytPrazdne) return null
    return (
      <div className="bg-surface rounded-xl border border-line px-6 py-10 text-center">
        <p className="text-sm text-muted">
          Zatím žádné zaměření — vzniká v mobilní appce Felucia Sales na tomto případu.
        </p>
      </div>
    )
  }

  const aktivni = zamereni.find(z => z.id === aktivniId) ?? zamereni[0]
  const tagLabel = (t: string) => zamereniFotoTagLabels[t] ?? t

  return (
    <div className="space-y-4">
      {zamereni.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {zamereni.map(z => (
            <button
              key={z.id}
              type="button"
              data-compact
              onClick={() => setAktivniId(z.id)}
              aria-pressed={z.id === aktivni.id}
              className={cn(
                'hit-area flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                z.id === aktivni.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-muted border-line hover:border-primary-light',
              )}
            >
              {formatDate(z.datum)} · {techLabels[z.typ as keyof typeof techLabels] ?? z.typ}
            </button>
          ))}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-semibold text-fg">
              {opOdkaz ? 'Zaměření · ' : ''}{techLabels[aktivni.typ as keyof typeof techLabels] ?? aktivni.typ}
            </p>
            <p className="text-sm text-muted">
              {formatDate(aktivni.datum)}
              {aktivni.autor ? ` · ${aktivni.autor}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {aktivni.adresa && <NavigateButton adresa={aktivni.adresa} size="xs" />}
            <span
              className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                aktivni.stav === 'UZAVRENE'
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                  : 'bg-surface-2 text-muted',
              )}
            >
              {zamereniStavLabels[aktivni.stav] ?? aktivni.stav}
            </span>
            {opOdkaz && (
              <a href={opOdkaz.href} className="text-xs text-primary dark:text-primary-light hover:underline">{opOdkaz.label} →</a>
            )}
          </div>
        </div>
      </div>

      {aktivni.sekce.length === 0 ? (
        <p className="text-sm text-muted px-1">Zatím žádné vyplněné odpovědi.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aktivni.sekce.map(sekce => (
            <div key={sekce.nazev} className="bg-surface rounded-xl border border-line px-5 py-4">
              <p className="text-xs font-semibold text-muted uppercase mb-3">{sekce.nazev}</p>
              <dl className="space-y-2">
                {sekce.otazky.map(o => (
                  <div key={o.popisek} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="text-muted">{o.popisek}</dt>
                    <dd className="text-fg font-medium text-right whitespace-pre-line">{o.hodnota}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line px-5 py-4">
        <p className="text-xs font-semibold text-muted uppercase mb-3">
          Fotky ze zaměření ({aktivni.fotky.length})
        </p>
        {aktivni.fotky.length === 0 ? (
          <p className="text-sm text-muted">Žádné fotky.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {aktivni.fotky.map(f => (
              <button key={f.id} type="button" onClick={() => setLightbox(f)} className="text-left group">
                <div className="aspect-square rounded-lg overflow-hidden bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={tagLabel(f.tag)} loading="lazy" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                </div>
                <p className="text-xs text-muted mt-1 truncate">{tagLabel(f.tag)}{f.popis ? ` — ${f.popis}` : ''}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        title={lightbox ? `${tagLabel(lightbox.tag)}${lightbox.popis ? ` — ${lightbox.popis}` : ''}` : ''}
        size="2xl"
        sheet={false}
      >
        {lightbox && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={tagLabel(lightbox.tag)} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
          </div>
        )}
      </Dialog>
    </div>
  )
}
