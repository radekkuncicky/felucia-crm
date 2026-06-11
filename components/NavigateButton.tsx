import { getMapsUrl } from '@/lib/maps'

interface Props {
  adresa: string
  label?: string
  size?: 'sm' | 'xs'
}

export function NavigateButton({ adresa, label, size = 'sm' }: Props) {
  if (!adresa) return null

  const padding = size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={getMapsUrl(adresa, false)}
        target="_blank"
        rel="noopener noreferrer"
        title="Otevřít v Google Maps"
        className={`inline-flex items-center gap-1 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white transition-colors ${padding}`}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {label ?? 'Navigovat'}
      </a>
      <a
        href={getMapsUrl(adresa, true)}
        target="_blank"
        rel="noopener noreferrer"
        title="Otevřít v Mapy.cz"
        className={`inline-flex items-center gap-1 rounded-lg font-medium border border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors ${padding}`}
      >
        Mapy.cz
      </a>
    </div>
  )
}
