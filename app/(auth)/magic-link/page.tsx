'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

function MagicLinkVerify() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('Přihlašuji vás…')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Neplatný odkaz.'); return }

    signIn('credentials', { magicToken: token, redirect: false }).then(result => {
      if (result?.error) {
        setStatus('error')
        setMessage('Odkaz je neplatný nebo vypršel. Požádejte o nový.')
      } else {
        router.push('/dashboard')
      }
    })
  }, [token, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-primary text-white rounded-xl p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">FELUCIA CRM</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
          {status === 'loading' ? (
            <>
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-600">{message}</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">{message}</p>
              <a href="/login" className="inline-block bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 px-6 rounded-lg transition-colors">
                Zpět na přihlášení
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={null}>
      <MagicLinkVerify />
    </Suspense>
  )
}
