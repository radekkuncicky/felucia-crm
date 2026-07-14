'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm'
import { formatDate } from '@/lib/format'

interface Saved {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  fromName: string | null
  fromEmail: string
  overeno: string | null
}

interface Props {
  initial: Saved | null
  globalFallback: boolean
  userEmail: string
}

const PRESETS = [
  {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    napoveda: (
      <>
        Použijte <strong>heslo pro aplikace</strong>, ne běžné heslo k účtu. Vytvoříte ho na{' '}
        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary dark:text-primary-light underline">
          myaccount.google.com/apppasswords
        </a>{' '}
        (vyžaduje zapnuté dvoufázové ověření).
      </>
    ),
  },
  {
    id: 'seznam',
    label: 'Seznam.cz',
    host: 'smtp.seznam.cz',
    port: 465,
    secure: true,
    napoveda: <>Přihlaste se e-mailem a heslem k účtu Seznam. SMTP musí být povoleno v nastavení schránky.</>,
  },
  {
    id: 'm365',
    label: 'Microsoft 365 / Outlook',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    napoveda: <>Účet musí mít povolené „Authenticated SMTP&ldquo; (správce najde v Microsoft 365 admin centru u uživatele → Pošta).</>,
  },
  {
    id: 'custom',
    label: 'Vlastní SMTP server',
    host: '',
    port: 587,
    secure: false,
    napoveda: <>Údaje najdete u svého poskytovatele e-mailu nebo hostingu.</>,
  },
] as const

type PresetId = (typeof PRESETS)[number]['id']

function detectPreset(s: Saved | null): PresetId {
  if (!s) return 'gmail'
  const p = PRESETS.find(p => p.id !== 'custom' && p.host === s.smtpHost)
  return p?.id ?? 'custom'
}

export default function EmailSettingsForm({ initial, globalFallback, userEmail }: Props) {
  const [saved, setSaved] = useState<Saved | null>(initial)
  const [preset, setPreset] = useState<PresetId>(detectPreset(initial))
  const [host, setHost] = useState(initial?.smtpHost ?? PRESETS[0].host)
  const [port, setPort] = useState(String(initial?.smtpPort ?? PRESETS[0].port))
  const [secure, setSecure] = useState(initial?.smtpSecure ?? PRESETS[0].secure)
  const [user, setUser] = useState(initial?.smtpUser ?? '')
  const [pass, setPass] = useState('')
  const [fromName, setFromName] = useState(initial?.fromName ?? '')
  const [fromEmail, setFromEmail] = useState(initial?.fromEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [removing, setRemoving] = useState(false)

  const presetDef = PRESETS.find(p => p.id === preset)!
  const isCustom = preset === 'custom'

  function pickPreset(id: PresetId) {
    setPreset(id)
    const p = PRESETS.find(p => p.id === id)!
    if (id !== 'custom') {
      setHost(p.host)
      setPort(String(p.port))
      setSecure(p.secure)
    }
  }

  function syncUserWithEmail(email: string) {
    // u běžných providerů je SMTP login shodný s adresou — předvyplníme
    setFromEmail(email)
    if (!user || user === fromEmail) setUser(email)
  }

  async function save(): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: host.trim(),
          smtpPort: Number(port),
          smtpSecure: secure,
          smtpUser: user.trim(),
          smtpPass: pass,
          fromName: fromName.trim(),
          fromEmail: fromEmail.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Uložení se nepodařilo')
        return false
      }
      setSaved(data.settings)
      setPass('')
      toast.success('Nastavení uloženo')
      return true
    } catch {
      toast.error('Uložení se nepodařilo')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveAndTest() {
    if (!(await save())) return
    setTesting(true)
    try {
      const res = await fetch('/api/settings/email/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Testovací e-mail se nepodařilo odeslat')
        return
      }
      setSaved(prev => (prev ? { ...prev, overeno: data.overeno } : prev))
      toast.success(`Testovací e-mail odeslán na ${data.to}`)
    } catch {
      toast.error('Testovací e-mail se nepodařilo odeslat')
    } finally {
      setTesting(false)
    }
  }

  async function remove() {
    if (!(await confirmDialog('Odebrat firemní SMTP? E-maily se přestanou odesílat vaší adresou.', { confirmLabel: 'Odebrat' }))) return
    setRemoving(true)
    try {
      const res = await fetch('/api/settings/email', { method: 'DELETE' })
      if (res.ok) {
        setSaved(null)
        setPass('')
        toast.success('Firemní SMTP odebráno')
      } else {
        toast.error('Odebrání se nepodařilo')
      }
    } finally {
      setRemoving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">← Nastavení</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Odesílání e-mailů</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Připojte firemní e-mailový účet — upozornění, pozvánky a dokumenty pak klientům
          odejdou z vaší adresy, ne ze systémové.
        </p>
      </div>

      {/* Stav */}
      <div className="mb-6">
        {saved?.overeno ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              <strong>Aktivní a ověřeno</strong> — {saved.fromEmail} · test proběhl {formatDate(saved.overeno)}
            </p>
          </div>
        ) : saved ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Uloženo, zatím neověřeno</strong> — odešlete testovací e-mail pro kontrolu nastavení.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {globalFallback
                ? 'Firemní účet není nastaven — e-maily zatím odcházejí ze systémové adresy Felucia.'
                : 'Firemní účet není nastaven — odesílání e-mailů je vypnuté, dokud ho nenastavíte.'}
            </p>
          </div>
        )}
      </div>

      {/* Poskytovatel */}
      <div className="mb-6">
        <p className={labelCls}>Poskytovatel e-mailu</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickPreset(p.id)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                preset === p.id
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 text-gray-900 dark:text-white'
                  : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">{presetDef.napoveda}</p>
      </div>

      {/* Formulář */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-4 mb-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Odesílací e-mail</label>
            <input
              type="email"
              value={fromEmail}
              onChange={e => syncUserWithEmail(e.target.value)}
              placeholder="info@vasefirma.cz"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Jméno odesílatele</label>
            <input
              type="text"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              placeholder="Vaše firma s.r.o."
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Přihlašovací jméno (SMTP)</label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="obvykle stejné jako e-mail"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Heslo</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder={saved ? '••••••••  (prázdné = beze změny)' : preset === 'gmail' ? 'heslo pro aplikace' : 'heslo k účtu'}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
        </div>

        {isCustom && (
          <div className="grid sm:grid-cols-3 gap-4 pt-1">
            <div className="sm:col-span-2">
              <label className={labelCls}>SMTP server</label>
              <input
                type="text"
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="smtp.vasefirma.cz"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Port</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={port}
                  onChange={e => {
                    setPort(e.target.value)
                    setSecure(e.target.value === '465')
                  }}
                  className={inputCls}
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  <input type="checkbox" checked={secure} onChange={e => setSecure(e.target.checked)} className="accent-primary" />
                  SSL
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Akce */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={saveAndTest}
          disabled={saving || testing}
          className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-50"
        >
          {testing ? 'Odesílám test…' : saving ? 'Ukládám…' : 'Uložit a odeslat testovací e-mail'}
        </button>
        <button
          onClick={save}
          disabled={saving || testing}
          className="rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          Jen uložit
        </button>
        {saved && (
          <button
            onClick={remove}
            disabled={removing}
            className="ml-auto text-sm font-medium text-red-500 dark:text-red-400 hover:underline disabled:opacity-50"
          >
            {removing ? 'Odebírám…' : 'Odebrat firemní SMTP'}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">
        Testovací e-mail se odešle na vaši adresu {userEmail || 'účtu'}. Heslo ukládáme šifrovaně
        a nikdy ho nezobrazujeme.
      </p>
    </div>
  )
}
