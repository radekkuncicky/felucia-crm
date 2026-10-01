import Link from 'next/link'

/**
 * Jednotná hlavička stránky: zpětný odkaz nad nadpisem (na mobilu se neláme vedle),
 * nadpis, popis a akce vpravo (na mobilu pod nadpisem).
 */
export function PageHeader({ title, description, back, actions }: {
  title: React.ReactNode
  description?: React.ReactNode
  back?: { href: string; label: string }
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {back && (
          <Link href={back.href} className="inline-block text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">{title}</h1>
        {description && <div className="text-sm text-gray-500 dark:text-slate-400">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
