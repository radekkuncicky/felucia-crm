'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  org: { id: string; nazev: string; logo: string | null; slug: string } | null
}

function LogoLeaf({ dark = false }: { dark?: boolean }) {
  const bg = dark ? '#0A120A' : 'white'
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
      <path d="M20 4C14 4 9 9.5 9 16c0 4 1.5 7.5 4 10l7 10 7-10c2.5-2.5 4-6 4-10 0-6.5-5-12-11-12z" fill="#4CAF50"/>
      <path d="M20 10 C20 10 15 14 15 18 C15 20.5 17.5 22 20 22 C20 22 20 16 20 10Z" fill={bg} opacity="0.8"/>
      <path d="M20 10 C20 10 25 14 25 18 C25 20.5 22.5 22 20 22 C20 22 20 16 20 10Z" fill={bg} opacity="0.5"/>
      <line x1="20" y1="10" x2="20" y2="22" stroke={bg} strokeWidth="1" opacity="0.6"/>
    </svg>
  )
}

export default function SigninForm({ org }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

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

  const bg = isDark ? '#0A120A' : '#F4FAF4'
  const cardBg = isDark ? '#0D1A0E' : 'white'
  const border = isDark ? 'rgba(76,175,80,0.15)' : '#E0EBE0'
  const inputBg = isDark ? 'rgba(76,175,80,0.04)' : '#F4FAF4'
  const inputBorder = isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9'
  const textMain = isDark ? '#E8F5E9' : '#1A2E1B'
  const textMuted = isDark ? '#6B8F6B' : '#4A6B4A'

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: textMain,
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo / Org header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {org ? (
            <>
              {org.logo ? (
                <img src={org.logo} alt={org.nazev} style={{ height: 48, margin: '0 auto 12px', objectFit: 'contain', display: 'block' }} />
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 14, background: isDark ? 'rgba(76,175,80,0.12)' : '#E8F5E9', border: `1px solid ${isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9'}`, marginBottom: 12 }}>
                  <LogoLeaf dark={isDark} />
                </div>
              )}
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: textMain, margin: '0 0 4px' }}>
                {org.nazev}
              </h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted, margin: 0 }}>Přihlaste se do firemního CRM</p>
            </>
          ) : (
            <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <LogoLeaf dark={isDark} />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: textMain, letterSpacing: '-0.02em' }}>
                felucia
              </span>
            </Link>
          )}
          {!org && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted, marginTop: 6 }}>Přihlaste se do CRM</p>}
        </div>

        {/* Card */}
        <div style={{ background: cardBg, borderRadius: 20, border: `0.5px solid ${border}`, padding: '32px 28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: isDark ? '#A5C8A5' : '#4A6B4A', marginBottom: 6 }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                placeholder="vas@email.cz" style={inputStyle} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: isDark ? '#A5C8A5' : '#4A6B4A' }}>
                  Heslo
                </label>
                <Link href="/forgot-password" style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: textMuted, textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#4CAF50')}
                  onMouseLeave={e => (e.currentTarget.style.color = textMuted)}>
                  Zapomněli jste heslo?
                </Link>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                placeholder="••••••••" style={inputStyle} />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#ef4444' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ padding: '12px 0', borderRadius: 12, background: '#4CAF50', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Přihlašování…' : 'Přihlásit se'}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted }}>
          Nemáte účet?{' '}
          <Link href="/auth/register" style={{ color: '#4CAF50', fontWeight: 600, textDecoration: 'none' }}>
            Zaregistrujte se →
          </Link>
        </p>
        {!org && (
          <p style={{ textAlign: 'center', marginTop: 8, fontFamily: 'Inter, sans-serif', fontSize: 12, color: isDark ? '#4A6B4A' : '#6B8F6B' }}>
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#4CAF50')}
              onMouseLeave={e => (e.currentTarget.style.color = isDark ? '#4A6B4A' : '#6B8F6B')}>
              ← Zpět na hlavní stránku
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
