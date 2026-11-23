'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { AuthShell, AuthAlert, PasswordInput } from '@/components/auth/AuthShell'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { PASSWORD_HINT, passwordError } from '@/lib/authInput'

interface TokenInfo {
  stav: 'ok' | 'neplatny' | 'pouzity' | 'vyprsel' | 'neaktivni'
  error?: string
  email?: string
  jmeno?: string
  orgNazev?: string
  prvniPrihlaseni?: boolean
  technik?: boolean
  appUrl?: string | null
}

function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const pozvankaParam = params.get('pozvanka') === '1'

  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hotovo, setHotovo] = useState<null | 'prihlasen' | 'prihlasit'>(null)

  // Odkaz ověřit hned — ne až po dvojím vyplnění hesla
  useEffect(() => {
    if (!token) { setInfo({ stav: 'neplatny', error: 'Odkaz je neplatný. Zkontrolujte, že jste ho zkopírovali celý.' }); return }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(setInfo)
      .catch(() => setInfo({ stav: 'ok' })) // bez sítě nechat formulář — chybu ukáže odeslání
  }, [token])

  const pozvanka = info?.prvniPrihlaseni ?? pozvankaParam

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const chyba = passwordError(newPassword)
    if (chyba) { setError(chyba); return }
    if (newPassword !== confirm) { setError('Hesla se neshodují.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.stav && data.stav !== 'ok') setInfo(i => ({ ...(i ?? {}), stav: data.stav, error: data.error }))
        else setError(data.error || 'Heslo se nepodařilo uložit.')
        return
      }
      // Rovnou přihlásit — uživatel heslo právě zadal
      const email: string | undefined = data.email ?? info?.email
      if (email) {
        const r = await signIn('credentials', { email, password: newPassword, redirect: false }).catch(() => null)
        if (r && !r.error) {
          if (info?.technik) { setHotovo('prihlasen'); return }
          window.location.href = '/dashboard'
          return
        }
      }
      setHotovo('prihlasit')
    } catch {
      setError('Nepodařilo se spojit se serverem. Zkontrolujte připojení k internetu.')
    } finally {
      setLoading(false)
    }
  }

  if (!info) {
    return <p className="py-6 text-center text-sm text-gray-500 dark:text-slate-400">Ověřuji odkaz…</p>
  }

  if (info.stav !== 'ok') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {info.stav === 'vyprsel' ? 'Odkaz vypršel' : info.stav === 'pouzity' ? 'Odkaz už byl použit' : 'Odkaz nefunguje'}
        </h2>
        <AuthAlert tone={info.stav === 'pouzity' ? 'info' : 'error'}>{info.error}</AuthAlert>
        <div className="flex flex-col gap-2 pt-1">
          {info.stav !== 'neaktivni' && (
            <Link href="/forgot-password" className="block w-full rounded-lg bg-primary py-2.5 text-center font-semibold text-white hover:bg-primary-hover">
              Poslat nový odkaz
            </Link>
          )}
          <Link href="/auth/signin" className="text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200">
            Přejít na přihlášení
          </Link>
        </div>
        {pozvanka && info.stav === 'vyprsel' && (
          <p className="text-xs text-gray-500 dark:text-slate-400">Šlo o pozvánku? Novou vám pošle správce firmy v Nastavení → Uživatelé.</p>
        )}
      </div>
    )
  }

  if (hotovo) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-semibold text-gray-900 dark:text-white">Heslo je nastavené</h2>
        {info.technik ? (
          <>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              V terénu pracujete v aplikaci <strong>Felucia Tech</strong>. Přihlaste se v ní e-mailem <strong>{info.email}</strong> a heslem, které jste právě zadali.
            </p>
            {info.appUrl ? (
              <a href={info.appUrl} className="block w-full rounded-lg bg-primary py-2.5 text-center font-semibold text-white hover:bg-primary-hover">
                Stáhnout Felucia Tech
              </a>
            ) : (
              <p className="text-xs text-gray-500 dark:text-slate-400">Aplikaci najdete v App Store / Google Play pod názvem „Felucia Tech“, případně vám odkaz pošle vedoucí.</p>
            )}
            <Link href={hotovo === 'prihlasen' ? '/dashboard' : '/auth/signin'} className="block text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200">
              Pokračovat na webu →
            </Link>
          </>
        ) : (
          <Link href={info.email ? `/auth/signin?email=${encodeURIComponent(info.email)}` : '/auth/signin'} className="block w-full rounded-lg bg-primary py-2.5 text-center font-semibold text-white hover:bg-primary-hover">
            Přihlásit se
          </Link>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {pozvanka ? (
        <div className="space-y-1">
          <h2 className="font-semibold text-gray-900 dark:text-white">Vítejte{info.jmeno ? `, ${info.jmeno}` : ''}!</h2>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            {info.orgNazev ? <>Firma <strong>{info.orgNazev}</strong> vás pozvala do Felucie. </> : null}
            Nastavte si heslo — pak vás rovnou přihlásíme.
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-slate-300">Zadejte nové heslo pro svůj účet.</p>
      )}
      {info.email && (
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-gray-700 dark:text-slate-300">
          Přihlašovací e-mail: <strong className="break-all">{info.email}</strong>
          {/* správce hesel uloží heslo k tomuto e-mailu */}
          <input type="email" name="username" autoComplete="username" value={info.email} readOnly hidden />
        </div>
      )}
      <Field label={pozvanka ? 'Heslo' : 'Nové heslo'} hint={PASSWORD_HINT} required>
        <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" autoFocus />
      </Field>
      <Field label="Heslo znovu" required error={confirm && newPassword && confirm.length >= newPassword.length && confirm !== newPassword ? 'Hesla se neshodují' : null}>
        <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
      </Field>
      {error && <AuthAlert>{error}</AuthAlert>}
      <Button type="submit" block loading={loading}>
        {loading ? 'Ukládám…' : pozvanka ? 'Nastavit heslo a pokračovat' : 'Uložit nové heslo'}
      </Button>
      <Link href="/auth/signin" className="block text-center text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200">
        Zpět na přihlášení
      </Link>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p className="py-6 text-center text-sm text-gray-500">Načítám…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
