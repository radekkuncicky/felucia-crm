'use client'

import { useState, useEffect, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'

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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)
}

// ─── Step indicators ──────────────────────────────────────────────────────────
function Steps({ current, isDark }: { current: number; isDark: boolean }) {
  const steps = ['Firma', 'Účet', 'Shrnutí']
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
      {steps.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
              background: done ? '#4CAF50' : active ? (isDark ? '#1A2E1B' : '#1A2E1B') : (isDark ? 'rgba(76,175,80,0.1)' : '#E8F5E9'),
              color: done || active ? (done ? 'white' : '#E8F5E9') : (isDark ? '#4A6B4A' : '#6B8F6B'),
              border: active ? '1px solid #4CAF50' : 'none',
            }}>
              {done ? '✓' : idx}
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, display: 'none', ...(typeof window !== 'undefined' && window.innerWidth >= 640 ? { display: 'block' } : {}), color: active ? (isDark ? '#E8F5E9' : '#1A2E1B') : (isDark ? '#4A6B4A' : '#6B8F6B') }} className="hidden sm:block">
              {label}
            </span>
            {i < steps.length - 1 && (
              <div style={{ width: 32, height: 1, background: done ? '#4CAF50' : (isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9') }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function Field({ label, error, isDark, children }: { label: string; error?: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: isDark ? '#A5C8A5' : '#4A6B4A', marginBottom: 6 }}>{label}</label>
      {children}
      {error && <p style={{ marginTop: 4, fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#ef4444' }}>{error}</p>}
    </div>
  )
}

function getInputStyle(isDark: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9'}`,
    background: isDark ? 'rgba(76,175,80,0.04)' : '#F4FAF4',
    color: isDark ? '#E8F5E9' : '#1A2E1B',
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState('')

  // Step 1
  const [nazevFirmy, setNazevFirmy] = useState('')
  const [ico, setIco] = useState('')
  const [pocetTechniku, setPocetTechniku] = useState('')
  const [slug, setSlug] = useState('')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'forbidden'>('idle')

  // Step 2
  const [jmeno, setJmeno] = useState('')
  const [prijmeni, setPrijmeni] = useState('')
  const [email, setEmail] = useState('')
  const [heslo, setHeslo] = useState('')
  const [hesloConfirm, setHesloConfirm] = useState('')

  // Step 3
  const [tos, setTos] = useState(false)

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Slug generation + check ─────────────────────────────────────────────
  useEffect(() => {
    const generated = generateSlug(nazevFirmy)
    setSlug(generated)
  }, [nazevFirmy])

  const checkSlug = useCallback(async (s: string) => {
    if (!s) { setSlugStatus('idle'); return }
    setSlugStatus('checking')
    try {
      const res = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(s)}`)
      const data = await res.json()
      setSlugStatus(data.available ? 'ok' : 'taken')
    } catch {
      setSlugStatus('idle')
    }
  }, [])

  useEffect(() => {
    if (!slug) { setSlugStatus('idle'); return }
    const t = setTimeout(() => checkSlug(slug), 400)
    return () => clearTimeout(t)
  }, [slug, checkSlug])

  // ── Validation ──────────────────────────────────────────────────────────
  function validateStep1() {
    const e: Record<string, string> = {}
    if (!nazevFirmy.trim()) e.nazevFirmy = 'Název firmy je povinný.'
    if (!slug) e.slug = 'Nepodařilo se vygenerovat subdoénu.'
    if (slugStatus === 'taken') e.slug = 'Tato subdoména je již obsazena.'
    if (slugStatus === 'forbidden') e.slug = 'Tento název není povolen.'
    if (slugStatus === 'checking') e.slug = 'Počkejte na ověření dostupnosti.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e: Record<string, string> = {}
    if (!jmeno.trim()) e.jmeno = 'Jméno je povinné.'
    if (!prijmeni.trim()) e.prijmeni = 'Příjmení je povinné.'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Zadejte platný email.'
    if (heslo.length < 10) e.heslo = 'Heslo musí mít alespoň 10 znaků.'
    if (heslo !== hesloConfirm) e.hesloConfirm = 'Hesla se neshodují.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep3() {
    const e: Record<string, string> = {}
    if (!tos) e.tos = 'Musíte souhlasit s obchodními podmínkami.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  function nextStep() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep(s => s + 1)
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep3()) return

    setSubmitting(true)
    setGlobalError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazevFirmy, ico: ico || undefined, jmeno, prijmeni, email, heslo, slug }),
      })
      const data = await res.json()

      if (!res.ok) {
        setGlobalError(data.error || 'Registrace se nezdařila.')
        setSubmitting(false)
        return
      }

      // Auto-login
      const result = await signIn('credentials', { email, password: heslo, redirect: false })
      if (result?.error) {
        setGlobalError('Účet byl vytvořen, ale přihlášení selhalo. Zkuste se přihlásit ručně.')
        setSubmitting(false)
        return
      }

      // Redirect to onboarding wizard
      const target =
        process.env.NODE_ENV === 'development'
          ? `/onboarding`
          : `https://${data.slug}.${ROOT_DOMAIN}/onboarding`

      window.location.href = target
    } catch {
      setGlobalError('Nastala neočekávaná chyba. Zkuste to prosím znovu.')
      setSubmitting(false)
    }
  }

  const bg = isDark ? '#0A120A' : '#F4FAF4'
  const cardBg = isDark ? '#0D1A0E' : 'white'
  const border = isDark ? 'rgba(76,175,80,0.15)' : '#E0EBE0'
  const textMain = isDark ? '#E8F5E9' : '#1A2E1B'
  const textMuted = isDark ? '#6B8F6B' : '#4A6B4A'
  const inputStyle = getInputStyle(isDark)
  const btnPrimary: React.CSSProperties = { padding: '12px 0', borderRadius: 12, background: '#4CAF50', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', width: '100%', marginTop: 8 }
  const btnOutline: React.CSSProperties = { padding: '12px 0', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#C8E6C9'}`, color: isDark ? '#7AAD7A' : '#4A6B4A', background: 'none', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, cursor: 'pointer', flex: 1 }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <LogoLeaf dark={isDark} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: textMain, letterSpacing: '-0.02em' }}>
              felucia
            </span>
          </Link>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted, marginTop: 6 }}>14 dní zdarma, pak 49 Kč/měsíc</p>
        </div>

        <Steps current={step} isDark={isDark} />

        <div style={{ background: cardBg, borderRadius: 20, border: `0.5px solid ${border}`, padding: '32px 28px' }}>

          {/* ── KROK 1 — Firma ────────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: textMain, margin: '0 0 4px' }}>Vaše firma</h2>

              <Field label="Název firmy *" error={errors.nazevFirmy} isDark={isDark}>
                <input type="text" value={nazevFirmy} onChange={e => setNazevFirmy(e.target.value)} style={inputStyle} placeholder="ACME s.r.o." autoFocus />
              </Field>

              {slug && (
                <div style={{ borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'Inter, sans-serif', border: `1px solid ${slugStatus === 'ok' ? '#4CAF50' : slugStatus === 'taken' || slugStatus === 'forbidden' ? '#ef4444' : isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9'}`, background: slugStatus === 'ok' ? 'rgba(76,175,80,0.07)' : slugStatus === 'taken' ? 'rgba(239,68,68,0.07)' : inputStyle.background }}>
                  <span style={{ color: textMuted }}>Vaše adresa: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: textMain }}>{slug}.{ROOT_DOMAIN}</span>
                  {slugStatus === 'checking' && <span style={{ marginLeft: 8, fontSize: 12, color: textMuted }}>ověřuji…</span>}
                  {slugStatus === 'ok' && <span style={{ marginLeft: 8, fontSize: 12, color: '#4CAF50', fontWeight: 600 }}>✓ dostupné</span>}
                  {slugStatus === 'taken' && <span style={{ marginLeft: 8, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>✗ obsazeno</span>}
                </div>
              )}
              {errors.slug && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#ef4444', marginTop: -8 }}>{errors.slug}</p>}

              <Field label="IČO" isDark={isDark}>
                <input type="text" value={ico} onChange={e => setIco(e.target.value)} style={inputStyle} placeholder="12345678 (volitelné)" />
              </Field>

              <Field label="Počet techniků" isDark={isDark}>
                <select value={pocetTechniku} onChange={e => setPocetTechniku(e.target.value)} style={inputStyle}>
                  <option value="">Vyberte…</option>
                  <option value="1">1</option>
                  <option value="2-5">2–5</option>
                  <option value="6-10">6–10</option>
                  <option value="10+">10+</option>
                </select>
              </Field>

              <button type="button" onClick={nextStep} style={btnPrimary}>Pokračovat →</button>
            </div>
          )}

          {/* ── KROK 2 — Admin účet ───────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: textMain, margin: '0 0 4px' }}>Váš admin účet</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Jméno *" error={errors.jmeno} isDark={isDark}>
                  <input type="text" value={jmeno} onChange={e => setJmeno(e.target.value)} style={inputStyle} placeholder="Jan" autoFocus />
                </Field>
                <Field label="Příjmení *" error={errors.prijmeni} isDark={isDark}>
                  <input type="text" value={prijmeni} onChange={e => setPrijmeni(e.target.value)} style={inputStyle} placeholder="Novák" />
                </Field>
              </div>

              <Field label="Email *" error={errors.email} isDark={isDark}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="jan@firma.cz" />
              </Field>
              <Field label="Heslo * (min. 10 znaků)" error={errors.heslo} isDark={isDark}>
                <input type="password" value={heslo} onChange={e => setHeslo(e.target.value)} style={inputStyle} placeholder="••••••••" />
              </Field>
              <Field label="Potvrdit heslo *" error={errors.hesloConfirm} isDark={isDark}>
                <input type="password" value={hesloConfirm} onChange={e => setHesloConfirm(e.target.value)} style={inputStyle} placeholder="••••••••" />
              </Field>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setStep(1)} style={btnOutline}>← Zpět</button>
                <button type="button" onClick={nextStep} style={{ ...btnPrimary, flex: 1, marginTop: 0 }}>Pokračovat →</button>
              </div>
            </div>
          )}

          {/* ── KROK 3 — Shrnutí ──────────────────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: textMain, margin: '0 0 4px' }}>Shrnutí</h2>

              <div style={{ borderRadius: 12, padding: '16px', background: isDark ? 'rgba(76,175,80,0.05)' : '#F4FAF4', border: `1px solid ${isDark ? 'rgba(76,175,80,0.15)' : '#E0EBE0'}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[['Firma', nazevFirmy], ['Subdoména', `${slug}.${ROOT_DOMAIN}`], ['Admin email', email], ['Plán', 'STARTER — 49 Kč/měsíc']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted }}>{k}</span>
                    <span style={{ fontFamily: k === 'Subdoména' ? 'monospace' : 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: k === 'Plán' ? '#4CAF50' : textMain }}>{v}</span>
                  </div>
                ))}
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={tos} onChange={e => setTos(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, accentColor: '#4CAF50', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted, lineHeight: 1.5 }}>
                  Souhlasím s{' '}
                  <Link href="/terms" style={{ color: '#4CAF50', textDecoration: 'none' }}>obchodními podmínkami</Link>
                  {' '}a zpracováním osobních údajů. *
                </span>
              </label>
              {errors.tos && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#ef4444', marginTop: -8 }}>{errors.tos}</p>}

              {globalError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#ef4444' }}>
                  {globalError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(2)} disabled={submitting} style={{ ...btnOutline, opacity: submitting ? 0.5 : 1 }}>← Zpět</button>
                <button type="submit" disabled={submitting} style={{ ...btnPrimary, flex: 1, marginTop: 0, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? 'Vytvářím účet…' : 'Vyzkoušet 14 dní zdarma'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted }}>
          Již máte účet?{' '}
          <Link href="/auth/signin" style={{ color: '#4CAF50', fontWeight: 600, textDecoration: 'none' }}>
            Přihlaste se →
          </Link>
        </p>
      </div>
    </div>
  )
}
