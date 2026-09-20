'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { formatDate } from '@/lib/format'
import { ROLES, ROLE_LABELS as roleLabels, ROLE_DESCRIPTIONS, parseOverrides, type PermissionOverrides } from '@/lib/permissions'
import PermissionsPanel from './PermissionsPanel'

const roleBadge: Record<string, string> = {
  ADMIN: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  MANAZER: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  OBCHODNIK: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  HLAVNI_TECHNIK: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  TECHNIK: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300',
}

// Technici si heslo nastavují sami přes pozvánku do appky Felucia Tech
const isTechnikRole = (role: string) => role === 'TECHNIK' || role === 'HLAVNI_TECHNIK'

function RoleOptions() {
  return <>{ROLES.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}</>
}

interface UserRow {
  id: string
  jmeno: string
  email: string
  role: string
  aktivni: boolean
  vytvoreno: string
  podepisujeSmlouvy: boolean
  permissions: unknown
}

function UserAvatar({ jmeno, size = 8 }: { jmeno: string; size?: number }) {
  const initials = jmeno.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  )
}

export default function UsersManager({ users: initUsers, maxUsers, activeUserCount: initActiveCount, canCustomize, currentUserId }: { users: UserRow[]; maxUsers: number; activeUserCount: number; canCustomize: boolean; currentUserId: string }) {
  const [users, setUsers] = useState(initUsers)
  const [activeCount, setActiveCount] = useState(initActiveCount)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState({ jmeno: '', email: '', heslo: '', role: 'OBCHODNIK' })
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [resetLoading, setResetLoading] = useState<string | null>(null)
  const [permsUserId, setPermsUserId] = useState<string | null>(null)
  // Poslední vygenerovaný pozvánkový/reset odkaz — admin ho může zkopírovat a
  // poslat jiným kanálem, když e-mail nedorazí (chybí SMTP, spam/karanténa)
  const [linkInfo, setLinkInfo] = useState<{ title: string; url: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  function showToast(msg: string, type: 'ok' | 'err') {
    if (type === 'ok') toast.success(msg)
    else toast.error(msg)
  }

  const addIsTechnik = isTechnikRole(addForm.role)

  async function handleAdd() {
    if (!addForm.jmeno || !addForm.email || (!addIsTechnik && !addForm.heslo)) return
    setSaving(true)
    setAddError('')
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Chyba'); return }
      setUsers(prev => [...prev, { ...data, vytvoreno: data.vytvoreno ?? new Date().toISOString() }])
      setActiveCount(c => c + 1)
      setAdding(false)
      setAddForm({ jmeno: '', email: '', heslo: '', role: 'OBCHODNIK' })
      if (addIsTechnik) {
        if (data.inviteUrl) {
          setLinkInfo({ title: `Pozvánka pro ${data.email}`, url: data.inviteUrl })
          setLinkCopied(false)
        }
        if (data.inviteEmailSent) {
          showToast('Technik přidán, pozvánka odeslána e-mailem', 'ok')
        } else {
          showToast(`Technik přidán, ale pozvánku se nepodařilo odeslat: ${data.inviteEmailError ?? 'neznámá chyba'}`, 'err')
        }
      } else {
        showToast('Uživatel přidán', 'ok')
      }
    } finally { setSaving(false) }
  }

  async function handleEditRole(userId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/users/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: editRole }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: updated.role, permissions: updated.permissions } : u))
        setEditingId(null)
        showToast('Role aktualizována', 'ok')
      } else {
        const j = await res.json().catch(() => ({}))
        showToast(j.message ?? j.error ?? 'Roli se nepodařilo změnit', 'err')
      }
    } finally { setSaving(false) }
  }

  async function savePermissions(userId: string, overrides: PermissionOverrides) {
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/users/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: overrides }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: updated.permissions } : u))
        setPermsUserId(null)
        showToast('Oprávnění uložena — projeví se do minuty', 'ok')
      } else {
        const j = await res.json().catch(() => ({}))
        showToast(j.message ?? j.error ?? 'Oprávnění se nepodařilo uložit', 'err')
      }
    } finally { setSaving(false) }
  }

  async function toggleAktivni(user: UserRow) {
    const res = await fetch(`/api/settings/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktivni: !user.aktivni }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, aktivni: !u.aktivni } : u))
      setActiveCount(c => user.aktivni ? c - 1 : c + 1)
      showToast(user.aktivni ? 'Uživatel deaktivován' : 'Uživatel aktivován', 'ok')
    } else {
      const j = await res.json().catch(() => ({}))
      showToast(j.message ?? 'Změnu se nepodařilo uložit', 'err')
    }
  }

  async function togglePodepisujeSmlouvy(user: UserRow) {
    const res = await fetch(`/api/settings/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ podepisujeSmlouvy: !user.podepisujeSmlouvy }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, podepisujeSmlouvy: !u.podepisujeSmlouvy } : u))
      showToast(!user.podepisujeSmlouvy ? 'Uživatel nyní podepisuje smlouvy za firmu' : 'Oprávnění podepisovat smlouvy odebráno', 'ok')
    }
  }

  async function sendResetLink(user: UserRow) {
    setResetLoading(user.id)
    try {
      const res = await fetch('/api/settings/users/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Chyba odeslání', 'err'); return }
      if (data.resetUrl) {
        setLinkInfo({ title: `Reset hesla pro ${user.email}`, url: data.resetUrl })
        setLinkCopied(false)
      }
      if (data.emailSent) {
        showToast(`Reset odkaz odeslán na ${user.email}`, 'ok')
      } else {
        showToast('E-mail se nepodařilo odeslat — zkopírujte odkaz níže a pošlete ho jiným kanálem', 'err')
      }
    } finally { setResetLoading(null) }
  }

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

  const atUserLimit = maxUsers !== Infinity && activeCount >= maxUsers
  const permsUser = permsUserId ? users.find(u => u.id === permsUserId) ?? null : null
  const hasOverrides = (u: UserRow) => canCustomize && Object.keys(parseOverrides(u.permissions)).length > 0
  const showUserWarning = maxUsers !== Infinity && activeCount / maxUsers >= 0.75

  return (
    <div className="space-y-4">
      {linkInfo && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-900 dark:text-green-200">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{linkInfo.title}</p>
            <p className="truncate font-mono text-xs text-green-800/80 dark:text-green-300/80">{linkInfo.url}</p>
            <p className="mt-1 text-xs text-green-800/80 dark:text-green-300/80">Pokud e-mail nedorazí, pošlete odkaz jiným kanálem (SMS, WhatsApp…).</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(linkInfo.url); setLinkCopied(true) }}
              className="rounded-lg border border-green-400 dark:border-green-600 px-3 py-1.5 font-semibold hover:bg-green-100 dark:hover:bg-green-900/40"
            >
              {linkCopied ? '✓ Zkopírováno' : 'Zkopírovat odkaz'}
            </button>
            <button
              type="button"
              onClick={() => setLinkInfo(null)}
              aria-label="Zavřít"
              className="rounded-lg px-2 py-1.5 hover:bg-green-100 dark:hover:bg-green-900/40"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {showUserWarning && (
        <div className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${atUserLimit ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300'}`}>
          <span>
            {atUserLimit
              ? <>Dosáhli jste limitu <strong>{activeCount}/{maxUsers}</strong> aktivních uživatelů. Nelze přidávat další.</>
              : <>Využíváte <strong>{activeCount}/{maxUsers}</strong> aktivních uživatelů Free plánu.</>
            }
          </span>
          <Link href="/settings/billing" className={`ml-4 shrink-0 font-semibold underline hover:no-underline ${atUserLimit ? 'text-red-900 dark:text-red-200' : 'text-yellow-900 dark:text-yellow-200'}`}>
            Upgradovat →
          </Link>
        </div>
      )}

      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {users.map(user => (
          <div key={user.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <UserAvatar jmeno={user.jmeno} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-white truncate">{user.jmeno}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${user.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                {user.aktivni ? 'Aktivní' : 'Neaktivní'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {editingId === user.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <select value={editRole} onChange={e => setEditRole(e.target.value)} className="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white flex-1">
                    <RoleOptions />
                  </select>
                  <button onClick={() => handleEditRole(user.id)} disabled={saving} className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap">Uložit</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">×</button>
                </div>
              ) : (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge[user.role] ?? roleBadge.TECHNIK}`}>
                  {roleLabels[user.role as keyof typeof roleLabels] ?? user.role}{hasOverrides(user) ? ' *' : ''}
                </span>
              )}
              <div className="flex items-center gap-3 flex-shrink-0">
                {editingId !== user.id && (
                  <button onClick={() => { setEditingId(user.id); setEditRole(user.role) }} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                    Role
                  </button>
                )}
                <button onClick={() => setPermsUserId(user.id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                  Oprávnění
                </button>
                <button
                  onClick={() => sendResetLink(user)}
                  disabled={resetLoading === user.id || !user.aktivni}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40"
                >
                  {resetLoading === user.id ? 'Odesílám…' : 'Reset'}
                </button>
                {user.id !== currentUserId && (
                  <button onClick={() => toggleAktivni(user)} className={`text-xs ${user.aktivni ? 'text-red-400 hover:text-red-600' : 'text-green-600 hover:text-green-800'}`}>
                    {user.aktivni ? 'Deaktivovat' : 'Aktivovat'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3">Uživatel</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 w-36">Role</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 w-24">Stav</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 w-32" title="Zmocněnec k podpisu smluv o dílo za firmu">Podpis smluv</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 w-24">Přidán</th>
              <th className="px-4 py-3 w-64" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 max-w-0">
                  <div className="flex items-center gap-3">
                    <UserAvatar jmeno={user.jmeno} />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{user.jmeno}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingId === user.id ? (
                    <div className="flex items-center gap-2">
                      <select value={editRole} onChange={e => setEditRole(e.target.value)} className="border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white">
                        <RoleOptions />
                      </select>
                      <button onClick={() => handleEditRole(user.id)} disabled={saving} className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap">Uložit</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">×</button>
                    </div>
                  ) : (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge[user.role] ?? roleBadge.TECHNIK}`} title={hasOverrides(user) ? 'Oprávnění upravena nad rámec role' : undefined}>
                      {roleLabels[user.role as keyof typeof roleLabels] ?? user.role}{hasOverrides(user) ? ' *' : ''}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                    {user.aktivni ? 'Aktivní' : 'Neaktivní'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => togglePodepisujeSmlouvy(user)}
                    title={user.podepisujeSmlouvy ? 'Odebrat oprávnění podepisovat smlouvy za firmu' : 'Zmocnit k podpisu smluv za firmu'}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${user.podepisujeSmlouvy ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${user.podepisujeSmlouvy ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  {formatDate(user.vytvoreno)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-3">
                    {editingId !== user.id && (
                      <button onClick={() => { setEditingId(user.id); setEditRole(user.role) }} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                        Role
                      </button>
                    )}
                    <button onClick={() => setPermsUserId(user.id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 whitespace-nowrap">
                      Oprávnění
                    </button>
                    <button
                      onClick={() => sendResetLink(user)}
                      disabled={resetLoading === user.id || !user.aktivni}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40 whitespace-nowrap"
                      title="Odeslat reset odkaz na email"
                    >
                      {resetLoading === user.id ? 'Odesílám…' : 'Reset hesla'}
                    </button>
                    {user.id !== currentUserId && (
                      <button onClick={() => toggleAktivni(user)} className={`text-xs whitespace-nowrap ${user.aktivni ? 'text-red-400 hover:text-red-600' : 'text-green-600 hover:text-green-800'}`}>
                        {user.aktivni ? 'Deaktivovat' : 'Aktivovat'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Oprávnění uživatele */}
      {permsUser && (
        <PermissionsPanel
          key={permsUser.id}
          userJmeno={permsUser.jmeno}
          role={permsUser.role}
          overrides={parseOverrides(permsUser.permissions)}
          canCustomize={canCustomize}
          saving={saving}
          onSave={o => savePermissions(permsUser.id, o)}
          onClose={() => setPermsUserId(null)}
        />
      )}

      {/* Add user */}
      {adding ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Nový uživatel</h3>
          {addError && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{addError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Jméno *</label>
              <input value={addForm.jmeno} onChange={e => setAddForm(f => ({ ...f, jmeno: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email *</label>
              <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} className={inp} />
            </div>
            {addIsTechnik ? (
              <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm px-3 py-2 rounded-lg">
                Heslo se nezadává — technik dostane e-mailem odkaz, kterým si ho sám nastaví.
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Heslo *</label>
                <input type="password" value={addForm.heslo} onChange={e => setAddForm(f => ({ ...f, heslo: e.target.value }))} className={inp} placeholder="min. 10 znaků" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Role</label>
              <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} className={inp}>
                <RoleOptions />
              </select>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{ROLE_DESCRIPTIONS[addForm.role as keyof typeof ROLE_DESCRIPTIONS]}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving || !addForm.jmeno || !addForm.email || (!addIsTechnik && !addForm.heslo)} className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm">
              {saving ? 'Ukládám…' : 'Přidat uživatele'}
            </button>
            <button onClick={() => { setAdding(false); setAddError('') }} className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 px-4 py-2">Zrušit</button>
          </div>
        </div>
      ) : atUserLimit ? (
        <button
          disabled
          title="Dosáhli jste limitu uživatelů. Upgradujte plán."
          className="bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-slate-400 font-medium px-4 py-2 rounded-lg text-sm cursor-not-allowed"
        >
          + Přidat uživatele
        </button>
      ) : (
        <button onClick={() => setAdding(true)} className="bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm">
          + Přidat uživatele
        </button>
      )}
    </div>
  )
}
