'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { AuthShell, AuthAlert } from '@/components/auth/AuthShell'

function MagicLinkVerify() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('Přihlašuji vás…')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Odkaz je neplatný. Zkontrolujte, že jste ho zkopírovali celý.'); return }

    signIn('credentials', { magicToken: token, redirect: false })
      .then(result => {
        if (result?.error) {
          setStatus('error')
          setMessage('Odkaz je neplatný, už byl použit, nebo vypršel (platí 15 minut).')
        } else {
          window.location.href = '/dashboard'
        }
      })
      .catch(() => { setStatus('error'); setMessage('Nepodařilo se spojit se serverem. Zkontrolujte připojení k internetu.') })
  }, [token])

  return status === 'loading' ? (
    <div className="space-y-4 py-4 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-gray-600 dark:text-slate-300">{message}</p>
    </div>
  ) : (
    <div className="space-y-4 text-center">
      <AuthAlert>{message}</AuthAlert>
      <Link href="/auth/signin" className="block w-full rounded-lg bg-primary py-2.5 text-center font-semibold text-white hover:bg-primary-hover">
        Přihlásit se heslem
      </Link>
      <Link href="/forgot-password" className="block text-sm text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200">
        Nevím heslo — poslat odkaz na nové
      </Link>
    </div>
  )
}

export default function MagicLinkPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <MagicLinkVerify />
      </Suspense>
    </AuthShell>
  )
}
