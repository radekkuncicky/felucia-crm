'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary text-white rounded-xl p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">FELUCIA CRM</h1>
          <p className="mt-2 text-sm text-gray-600">Obnova hesla</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Email odeslán</h3>
              <p className="text-sm text-gray-600">
                Pokud zadaný email existuje v systému, obdržíte odkaz pro obnovu hesla. Odkaz je platný 1 hodinu.
              </p>
              <Link href="/login" className="block w-full text-center bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 px-4 rounded-lg transition-colors mt-4">
                Zpět na přihlášení
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-gray-600">Zadejte svůj email a my vám pošleme odkaz pro obnovu hesla.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="vas@email.cz"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Odesílám...' : 'Odeslat odkaz'}
              </button>
              <Link href="/login" className="block text-center text-sm text-gray-500 hover:text-gray-700">
                Zpět na přihlášení
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
