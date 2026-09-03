'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  PERMISSION_GROUPS, ROLE_PRESETS, ROLE_LABELS, ROLE_DESCRIPTIONS, isRoleName, diffFromPreset,
  type Permissions, type PermissionKey, type PermissionOverrides,
} from '@/lib/permissions'

interface Props {
  userJmeno: string
  role: string
  overrides: PermissionOverrides
  /** Plán dovoluje per-user přepisy (STANDARD+) */
  canCustomize: boolean
  saving: boolean
  onSave: (overrides: PermissionOverrides) => Promise<void>
  onClose: () => void
}

/**
 * Editor oprávnění jednoho uživatele: preset role + přepisy.
 * Ukládá jen rozdíly od presetu (diffFromPreset), takže změna role později
 * přenese jen to, co admin vědomě přepnul.
 */
export default function PermissionsPanel({ userJmeno, role, overrides: initOverrides, canCustomize, saving, onSave, onClose }: Props) {
  const roleName = isRoleName(role) ? role : 'TECHNIK'
  const preset = ROLE_PRESETS[roleName]
  const [values, setValues] = useState<Permissions>({ ...preset, ...initOverrides })

  const overrides = diffFromPreset(roleName, values)
  const changedCount = Object.keys(overrides).length

  function set(key: PermissionKey, v: boolean | string) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Oprávnění — {userJmeno}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Výchozí balíček role <strong>{ROLE_LABELS[roleName]}</strong>: {ROLE_DESCRIPTIONS[roleName]}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-lg leading-none">×</button>
      </div>

      {!canCustomize && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 text-sm px-3 py-2 rounded-lg flex items-center justify-between gap-3">
          <span>Úprava oprávnění nad rámec role je dostupná od plánu Standard. Níže vidíte, co role obsahuje.</span>
          <Link href="/settings/billing" className="font-semibold underline hover:no-underline shrink-0">Upgradovat →</Link>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {PERMISSION_GROUPS.map(group => (
          <div key={group.id} className="space-y-2">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">{group.label}</p>
            {group.items.map(item => {
              const current = values[item.key]
              const changed = current !== preset[item.key]
              return (
                <div key={item.key} className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 ${changed ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-slate-700/40'}`}>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      {item.label}
                      {changed && <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300">upraveno</span>}
                    </p>
                    {item.hint && <p className="text-xs text-gray-500 dark:text-slate-400">{item.hint}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {changed && canCustomize && (
                      <button
                        type="button"
                        onClick={() => set(item.key, preset[item.key])}
                        title="Vrátit na výchozí hodnotu role"
                        className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-slate-200"
                      >
                        ↺
                      </button>
                    )}
                    {item.options ? (
                      <select
                        value={String(current)}
                        disabled={!canCustomize}
                        onChange={e => set(item.key, e.target.value)}
                        className="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white disabled:opacity-60"
                      >
                        {item.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={current === true}
                        disabled={!canCustomize}
                        onClick={() => set(item.key, !current)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-60 ${current ? 'bg-primary' : 'bg-gray-200 dark:bg-slate-600'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${current ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {canCustomize && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onSave(overrides)}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
          >
            {saving ? 'Ukládám…' : 'Uložit oprávnění'}
          </button>
          <button
            onClick={() => setValues({ ...preset })}
            disabled={saving || changedCount === 0}
            className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 disabled:opacity-40"
          >
            Vrátit vše na výchozí role
          </button>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {changedCount === 0 ? 'Bez přepisů — platí výchozí balíček role.' : `${changedCount} přepis${changedCount === 1 ? '' : changedCount < 5 ? 'y' : 'ů'} nad rámec role.`}
          </span>
        </div>
      )}
    </div>
  )
}
