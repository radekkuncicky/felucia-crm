'use client'

export interface SodPrilohy {
  prilohaNabidka: boolean
  prilohaVop: boolean
  prilohaVzsp: boolean
  prilohaCenik: boolean
}

export interface SodPrilohyDostupne {
  hasVop: boolean
  hasVzsp: boolean
  hasCenik: boolean
}

/** Výchozí zaškrtnutí: nabídka vždy, VOP a VZSP pokud má org nahrané soubory, ceník ne. */
export function defaultSodPrilohy(dostupne: SodPrilohyDostupne): SodPrilohy {
  return {
    prilohaNabidka: true,
    prilohaVop: dostupne.hasVop,
    prilohaVzsp: dostupne.hasVzsp,
    prilohaCenik: false,
  }
}

interface Props {
  value: SodPrilohy
  dostupne: SodPrilohyDostupne
  onChange: (v: SodPrilohy) => void
  disabled?: boolean
}

export default function SodPrilohyPicker({ value, dostupne, onChange, disabled }: Props) {
  const items: { key: keyof SodPrilohy; label: string; available: boolean; hint?: string }[] = [
    { key: 'prilohaNabidka', label: 'Cenová nabídka', available: true },
    { key: 'prilohaVop', label: 'VOP — Všeobecné obchodní podmínky', available: dostupne.hasVop, hint: 'není nahráno v Nastavení → Dokumenty' },
    { key: 'prilohaVzsp', label: 'VZSP — Všeobecné záruční a servisní podmínky', available: dostupne.hasVzsp, hint: 'není nahráno v Nastavení → Dokumenty' },
    { key: 'prilohaCenik', label: 'Ceník', available: dostupne.hasCenik, hint: 'není nahráno v Nastavení → Dokumenty' },
  ]
  return (
    <div className="space-y-2">
      {items.map(({ key, label, available, hint }) => (
        <label
          key={key}
          className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 border transition-colors ${
            available && !disabled
              ? 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer'
              : 'border-gray-100 dark:border-slate-700 opacity-50 cursor-not-allowed'
          }`}
        >
          <input
            type="checkbox"
            checked={value[key] && available}
            disabled={!available || disabled}
            onChange={e => onChange({ ...value, [key]: e.target.checked })}
            className="w-4 h-4 rounded text-primary"
          />
          <span className={`flex-1 ${value[key] && available ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-slate-400'}`}>
            {label}
          </span>
          {!available && hint && <span className="text-xs text-gray-400 dark:text-slate-500">{hint}</span>}
        </label>
      ))}
    </div>
  )
}
