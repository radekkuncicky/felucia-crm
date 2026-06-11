'use client'

interface AuditEntry {
  id: string
  typAkce: string
  typZaznamu: string
  zaznamNazev: string
  zmeny: Record<string, unknown>
  vytvoreno: string
  userJmeno: string | null
}

interface Props {
  zakazkaId: string
  aktivity: AuditEntry[]
}

function formatZmeny(zmeny: Record<string, unknown>): string {
  if (zmeny.stavPred && zmeny.stavPo) {
    return `Stav: ${zmeny.stavPred} → ${zmeny.stavPo}`
  }
  if (zmeny.stav) return `Stav: ${zmeny.stav}`
  if (zmeny.storno) return `Storno rezervace: ${zmeny.duvod ?? ''}`
  return JSON.stringify(zmeny)
}

function IconForType(typZaznamu: string) {
  switch (typZaznamu) {
    case 'Zakazka': return '📋'
    case 'ZakazkaPolozka': return '📦'
    default: return '📝'
  }
}

export default function AktivitaTab({ aktivity }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Aktivita ({aktivity.length})</h3>
      </div>

      {aktivity.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Žádná aktivita</div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {aktivity.map((a, i) => (
            <div key={a.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-sm flex-shrink-0">
                  {IconForType(a.typZaznamu)}
                </div>
                {i < aktivity.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-100 dark:bg-slate-700 mt-2" />
                )}
              </div>
              <div className="pb-4 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {a.typZaznamu}: <span className="text-gray-600 dark:text-slate-400">{a.zaznamNazev}</span>
                  </p>
                  <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                    {new Date(a.vytvoreno).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{formatZmeny(a.zmeny as Record<string, unknown>)}</p>
                {a.userJmeno && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">· {a.userJmeno}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
