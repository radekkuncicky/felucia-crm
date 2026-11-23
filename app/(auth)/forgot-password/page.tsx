'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthShell, AuthAlert } from '@/components/auth/AuthShell'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

function ForgotForm() {
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Odkaz se nepodařilo odeslat. Zkuste to prosím znovu.')
        return
      }
      setSent(true)
    } catch {
      setError('Nepodařilo se spojit se serverem. Zkontrolujte připojení k internetu.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-semibold text-gray-900 dark:text-white">Zkontrolujte e-mail</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Pokud k adrese <strong>{email.trim()}</strong> existuje účet, poslali jsme na ni odkaz pro nastavení nového hesla. Platí 1 hodinu.
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Nic nepřišlo do pár minut? Podívejte se do spamu, zkontrolujte adresu, nebo požádejte správce vaší firmy — v Nastavení → Uživatelé vám pošle odkaz sám.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/auth/signin" className="block w-full rounded-lg bg-primary py-2.5 text-center font-semibold text-white hover:bg-primary-hover">
            Zpět na přihlášení
          </Link>
          <button type="button" onClick={() => setSent(false)} className="text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200">
            Zadat jiný e-mail
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <p className="text-sm text-gray-600 dark:text-slate-300">Zadejte e-mail, kterým se přihlašujete. Pošleme vám odkaz pro nastavení nového hesla.</p>
      <Field label="E-mail" required>
        <Input kind="email" autoComplete="username" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} placeholder="vas@email.cz" autoFocus />
      </Field>
      {error && <AuthAlert>{error}</AuthAlert>}
      <Button type="submit" block loading={loading} disabled={!email.trim()}>
        {loading ? 'Odesílám…' : 'Poslat odkaz'}
      </Button>
      <Link href="/auth/signin" className="block text-center text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200">
        Zpět na přihlášení
      </Link>
    </form>
  )
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell podtitul="Obnova hesla">
      <Suspense fallback={null}>
        <ForgotForm />
      </Suspense>
    </AuthShell>
  )
}
