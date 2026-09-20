'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { signOut } from 'next-auth/react'
import AvatarCropModal from '@/components/AvatarCropModal'

import { ROLE_LABELS } from '@/lib/permissions'
const roleLabels: Record<string, string> = ROLE_LABELS

interface UserData {
  id: string
  jmeno: string
  email: string
  telefon: string | null
  role: string
  avatar: string | null
  vytvoreno: string
  organization: { nazev: string }
}

export default function ProfileClient({ user: init }: { user: UserData }) {
  const [user, setUser] = useState(init)

  // Profile form
  const [jmeno, setJmeno] = useState(init.jmeno)
  const [email, setEmail] = useState(init.email)
  const [telefon, setTelefon] = useState(init.telefon ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  // Změna přihlašovacího e-mailu vyžaduje aktuální heslo (API ho ověří)
  const [emailPassword, setEmailPassword] = useState('')
  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase()

  // Password form
  const [current, setCurrent] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  // Avatar
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(Date.now())

  function showToast(msg: string, type: 'ok' | 'err') {
    if (type === 'ok') toast.success(msg)
    else toast.error(msg)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      if (emailChanged && !emailPassword) { showToast('Pro změnu e-mailu zadejte aktuální heslo', 'err'); return }
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jmeno, email, telefon: telefon || null, currentPassword: emailChanged ? emailPassword : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Chyba', 'err'); return }
      setEmailPassword('')
      setUser(u => ({ ...u, ...data }))
      showToast('Profil uložen', 'ok')
    } finally { setSavingProfile(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPwd.length < 10) { showToast('Heslo musí mít alespoň 10 znaků', 'err'); return }
    if (newPwd !== confirmPwd) { showToast('Hesla se neshodují', 'err'); return }
    setSavingPwd(true)
    try {
      const res = await fetch('/api/settings/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, newPassword: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Chyba', 'err'); return }
      showToast('Heslo změněno – budete odhlášeni', 'ok')
      setCurrent(''); setNewPwd(''); setConfirmPwd('')
      setTimeout(() => signOut({ callbackUrl: '/login' }), 2000)
    } finally { setSavingPwd(false) }
  }

  async function uploadAvatar(blob: Blob) {
    setUploadingAvatar(true)
    setCropFile(null)
    // Reset file input so the same file can be re-selected
    if (fileRef.current) fileRef.current.value = ''
    try {
      const fd = new FormData()
      fd.append('avatar', blob, 'avatar.jpg')
      const res = await fetch('/api/settings/profile/avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Chyba nahrávání', 'err'); return }
      setUser(u => ({ ...u, avatar: data.avatar }))
      setAvatarVersion(Date.now())
      showToast('Avatar aktualizován', 'ok')
    } finally { setUploadingAvatar(false) }
  }

  const initials = user.jmeno.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <>
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onClose={() => { setCropFile(null); if (fileRef.current) fileRef.current.value = '' }}
          onSave={uploadAvatar}
        />
      )}

      {/* Avatar + info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-primary flex items-center justify-center text-white text-2xl font-bold">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${user.avatar}?v=${avatarVersion}`} alt="Avatar" className="object-cover w-full h-full" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shadow-md disabled:opacity-50"
              title="Nahrát avatar"
            >
              {uploadingAvatar ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) setCropFile(e.target.files[0]) }}
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.jmeno}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                user.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                user.role === 'OBCHODNIK' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
              }`}>{roleLabels[user.role]}</span>
              <span className="text-xs text-gray-400 dark:text-slate-500">· {user.organization.nazev}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Osobní údaje</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Celé jméno</label>
              <input value={jmeno} onChange={e => setJmeno(e.target.value)} required className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inp} />
              {emailChanged && (
                <input
                  type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)}
                  className={`${inp} mt-2`} placeholder="Aktuální heslo (nutné pro změnu e-mailu)" autoComplete="current-password"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Telefon</label>
              <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} className={inp} placeholder="+420 …" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Role</label>
              <input value={roleLabels[user.role]} readOnly className={`${inp} bg-gray-50 dark:bg-slate-600 cursor-not-allowed`} />
            </div>
          </div>
          <button type="submit" disabled={savingProfile} className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm">
            {savingProfile ? 'Ukládám…' : 'Uložit profil'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Změna hesla</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Po změně hesla budete automaticky odhlášeni.</p>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Aktuální heslo</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required className={inp} placeholder="••••••••" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nové heslo</label>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={8} className={inp} placeholder="min. 8 znaků" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Potvrdit heslo</label>
              <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required className={inp} placeholder="••••••••" />
            </div>
          </div>
          <button type="submit" disabled={savingPwd} className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm">
            {savingPwd ? 'Ukládám…' : 'Změnit heslo'}
          </button>
        </form>
      </div>
    </>
  )
}
