'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard')
  }, [status, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Nesprávný email nebo heslo.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  if (status === 'loading') return null

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <div className="bg-[#FFC93C] rounded-xl p-3">
              <svg className="w-8 h-8 text-[#111111]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-[#111111] dark:text-white" style={{ fontFamily: 'var(--font-montserrat, sans-serif)' }}>
              FELUCIA CRM
            </span>
          </Link>
          <p className="mt-2 text-sm text-gray-500">Přihlaste se do systému</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:border-[#FFC93C] transition-colors"
                placeholder="vas@email.cz"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Heslo</label>
                <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  Zapomněli jste heslo?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:border-[#FFC93C] transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFC93C] hover:bg-[#ffb800] disabled:opacity-60 text-[#111111] font-bold py-3 px-4 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Přihlašování...' : 'Přihlásit se'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">← Zpět na hlavní stránku</Link>
        </p>
      </div>
    </div>
  )
}
