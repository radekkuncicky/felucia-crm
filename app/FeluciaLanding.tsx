'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ─── SVG Components ──────────────────────────────────────────────────────────

function LogoLeaf({ dark = false }: { dark?: boolean }) {
  const bg = dark ? '#0A120A' : 'white'
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
      <path d="M20 4C14 4 9 9.5 9 16c0 4 1.5 7.5 4 10l7 10 7-10c2.5-2.5 4-6 4-10 0-6.5-5-12-11-12z" fill="#4CAF50"/>
      <path d="M20 10 C20 10 15 14 15 18 C15 20.5 17.5 22 20 22 C20 22 20 16 20 10Z" fill={bg} opacity="0.8"/>
      <path d="M20 10 C20 10 25 14 25 18 C25 20.5 22.5 22 20 22 C20 22 20 16 20 10Z" fill={bg} opacity="0.5"/>
      <line x1="20" y1="10" x2="20" y2="22" stroke={bg} strokeWidth="1" opacity="0.6"/>
    </svg>
  )
}

function TreeSvg({ color }: { color: string }) {
  return (
    <svg width="380" height="380" viewBox="0 0 420 420" fill="none">
      <path d="M210 420 C205 380 200 340 205 300 C208 270 215 250 210 220" stroke={color} strokeWidth="18" strokeLinecap="round" fill="none"/>
      <path d="M210 300 C190 280 160 260 130 240" stroke={color} strokeWidth="10" strokeLinecap="round" fill="none"/>
      <path d="M210 280 C230 255 260 235 290 215" stroke={color} strokeWidth="9" strokeLinecap="round" fill="none"/>
      <path d="M210 260 C195 235 180 210 165 185" stroke={color} strokeWidth="8" strokeLinecap="round" fill="none"/>
      <path d="M210 250 C225 220 245 200 270 178" stroke={color} strokeWidth="7" strokeLinecap="round" fill="none"/>
      <path d="M165 185 C145 170 120 155 100 140" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M270 178 C295 160 315 145 340 128" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M130 240 C105 228 80 218 55 205" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M290 215 C315 200 340 188 368 175" stroke={color} strokeWidth="6" strokeLinecap="round" fill="none"/>
      <ellipse cx="100" cy="135" rx="22" ry="32" transform="rotate(-30 100 135)" fill="#4CAF50"/>
      <ellipse cx="55" cy="200" rx="18" ry="28" transform="rotate(-20 55 200)" fill="#4CAF50"/>
      <ellipse cx="180" cy="108" rx="16" ry="26" transform="rotate(15 180 108)" fill="#81C784"/>
      <ellipse cx="340" cy="122" rx="20" ry="30" transform="rotate(25 340 122)" fill="#4CAF50"/>
      <ellipse cx="368" cy="170" rx="18" ry="26" transform="rotate(10 368 170)" fill="#81C784"/>
      <ellipse cx="260" cy="100" rx="16" ry="24" transform="rotate(-10 260 100)" fill="#4CAF50"/>
      <ellipse cx="130" cy="125" rx="12" ry="18" transform="rotate(20 130 125)" fill="#81C784"/>
      <path d="M210 420 C190 410 170 405 150 408" stroke="#A0845C" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M210 420 C230 410 250 405 270 408" stroke="#A0845C" strokeWidth="6" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function RaysSvg({ color }: { color: string }) {
  return (
    <svg width="280" height="180" viewBox="0 0 280 180" fill="none">
      <path d="M60 0 L45 180" stroke={color} strokeWidth="35" strokeLinecap="round"/>
      <path d="M120 0 L112 180" stroke={color} strokeWidth="22" strokeLinecap="round"/>
      <path d="M175 0 L172 180" stroke={color} strokeWidth="15" strokeLinecap="round"/>
      <path d="M220 0 L224 180" stroke={color} strokeWidth="10" strokeLinecap="round"/>
    </svg>
  )
}

function AuraSvg() {
  return (
    <svg width="260" height="260" viewBox="0 0 260 260" fill="none">
      <circle cx="130" cy="130" r="120" stroke="#4CAF50" strokeWidth="1"/>
      <circle cx="130" cy="130" r="90" stroke="#4CAF50" strokeWidth="0.5"/>
      <circle cx="130" cy="130" r="60" stroke="#81C784" strokeWidth="0.5"/>
    </svg>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({ isDark }: { isDark: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 10) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navBg = scrolled
    ? isDark ? 'rgba(10,18,10,0.95)' : 'rgba(249,251,249,0.95)'
    : 'transparent'
  const borderBottom = scrolled ? `1px solid ${isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9'}` : 'none'

  return (
    <nav ref={navRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: navBg, borderBottom, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoLeaf dark={isDark} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B', letterSpacing: '-0.02em' }}>
            felucia
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="hidden md:flex">
          {[['#funkce','Funkce'],['#ceny','Ceny'],['#faq','FAQ']].map(([href, label]) => (
            <a key={href} href={href} style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: isDark ? '#7AAD7A' : '#4A6B4A', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#4CAF50')}
              onMouseLeave={e => (e.currentTarget.style.color = isDark ? '#7AAD7A' : '#4A6B4A')}>
              {label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="hidden md:flex">
          <Link href="/auth/signin" style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, padding: '8px 16px', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(76,175,80,0.4)' : '#C8E6C9'}`, color: isDark ? '#7AAD7A' : '#4A6B4A', textDecoration: 'none' }}>
            Přihlásit se
          </Link>
          <a href="#beta" style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, padding: '8px 18px', borderRadius: 10, background: '#4CAF50', color: 'white', textDecoration: 'none' }}>
            Získat přístup
          </a>
        </div>

        {/* Hamburger */}
        <button className="md:hidden" onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#E8F5E9' : '#1A2E1B', padding: 6 }}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden" style={{ background: isDark ? '#0D1A0E' : '#F4FAF4', borderBottom: `1px solid ${isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9'}`, padding: '12px 24px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['#funkce','Funkce'],['#ceny','Ceny'],['#faq','FAQ']].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: isDark ? '#7AAD7A' : '#4A6B4A', textDecoration: 'none', padding: '4px 0' }}>
                {label}
              </a>
            ))}
            <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
              <Link href="/auth/signin" onClick={() => setMenuOpen(false)}
                style={{ flex: 1, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, padding: '10px 0', borderRadius: 10, border: '1px solid #4CAF50', color: '#4CAF50', textDecoration: 'none' }}>
                Přihlásit se
              </Link>
              <a href="#beta" onClick={() => setMenuOpen(false)}
                style={{ flex: 1, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, padding: '10px 0', borderRadius: 10, background: '#4CAF50', color: 'white', textDecoration: 'none' }}>
                Získat přístup
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ isDark }: { isDark: boolean }) {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', paddingTop: 128, paddingBottom: 96, background: isDark ? '#0D1A0E' : '#F4FAF4', borderBottom: `1px solid ${isDark ? 'rgba(76,175,80,0.12)' : '#C8E6C9'}` }}>
      {/* Rays */}
      <div style={{ position: 'absolute', top: 0, right: 60, pointerEvents: 'none', opacity: isDark ? 0.08 : 0.15 }}>
        <RaysSvg color={isDark ? '#81C784' : '#C8E6C9'} />
      </div>
      {/* Aura */}
      <div style={{ position: 'absolute', top: -80, right: 100, pointerEvents: 'none', opacity: 0.06 }}>
        <AuraSvg />
      </div>
      {/* Tree */}
      <div style={{ position: 'absolute', right: -20, bottom: 0, pointerEvents: 'none', opacity: isDark ? 0.10 : 0.07 }}>
        <TreeSvg color={isDark ? '#81C784' : '#2E7D32'} />
      </div>

      <div style={{ position: 'relative', maxWidth: 1152, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 999, background: isDark ? 'rgba(76,175,80,0.12)' : '#E8F5E9', border: `1px solid ${isDark ? 'rgba(76,175,80,0.35)' : '#A5D6A7'}`, color: '#4CAF50', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 6px #4CAF50' }}/>
            Spouštíme brzy · Přijímáme první testery
          </span>
        </div>

        {/* Heading */}
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 700, lineHeight: 1.15, color: isDark ? '#E8F5E9' : '#1A2E1B', maxWidth: 700, margin: '0 auto 24px', letterSpacing: '-0.02em' }}>
          CRM který roste{' '}
          <span style={{ color: '#4CAF50' }}>s vaším</span>{' '}
          <span style={{ color: isDark ? '#C8A97A' : '#A0845C' }}>byznysem.</span>
        </h1>

        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, color: isDark ? '#7AAD7A' : '#4A6B4A', maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Specializovaný CRM pro HVAC firmy — zakázky, nabídky, servis a AI asistentka Dáša na jednom místě. Hledáme první testery, kteří nám pomůžou produkt vyladit.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
          <a href="#beta" style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600, padding: '14px 28px', borderRadius: 12, background: '#4CAF50', color: 'white', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(76,175,80,0.4)' }}>
            Chci být tester →
          </a>
          <a href="#demo" style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 500, padding: '14px 28px', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#C8E6C9'}`, color: isDark ? '#7AAD7A' : '#4A6B4A', background: 'transparent', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Zájem o demo
          </a>
        </div>

        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: isDark ? '#4A6B4A' : '#6B8F6B', fontWeight: 500 }}>
          Prvních 50 testerů dostane Professional plán <span style={{ color: '#4CAF50', fontWeight: 600 }}>zdarma na celý rok</span>
        </p>
      </div>
    </section>
  )
}

// ─── Marquee ──────────────────────────────────────────────────────────────────

function Marquee({ isDark }: { isDark: boolean }) {
  const items = ['Tepelná čerpadla', 'Klimatizace', 'Rekuperace', 'Podlahové vytápění', 'Vzduchotechnika', 'Servisní kontrakty']
  const repeated = [...items, ...items]
  return (
    <div style={{ overflow: 'hidden', background: isDark ? 'rgba(76,175,80,0.05)' : 'rgba(76,175,80,0.04)', borderBottom: `1px solid ${isDark ? 'rgba(76,175,80,0.1)' : '#E8F5E9'}`, padding: '14px 0' }}>
      <div className="fl-marquee-track">
        {repeated.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0 20px', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: isDark ? '#4CAF50' : '#2E7D32', whiteSpace: 'nowrap' }}>
            {item}
            <span style={{ color: isDark ? 'rgba(76,175,80,0.5)' : '#A0845C' }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', title: 'Obchodní případy', desc: 'Kanban pipeline, stavy, hodnoty obchodu. Přehled všech zakázek od poptávky po realizaci.' },
  { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', title: 'Zakázky', desc: 'Přiřazení techniků, sledování postupu realizace, předávací protokoly a dokumentace.' },
  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Profesionální nabídky', desc: 'Generujte PDF nabídky ze šablon s cenami, DPH a firemním logem za sekundy.' },
  { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', title: 'Správa klientů', desc: 'Kartotéka klientů s historií, kontakty a napojením na zakázky a servis.' },
  { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Aktivity a úkoly', desc: 'Evidujte hovory, schůzky, emaily. Připomínky, deadliny a plánování pro celý tým.' },
  { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', title: 'Analytiky', desc: 'Přehledy výkonu, konverzní sazby, tržby podle technologie a obchodníka.' },
  { icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', title: 'Servisní modul', desc: 'Evidence zařízení, servisní kontrakty, plán návštěv a záruky. Pro rostoucí servisní firmy.' },
]

function Features({ isDark }: { isDark: boolean }) {
  return (
    <section id="funkce" style={{ padding: '96px 0', background: isDark ? '#0A120A' : '#F9FBF9' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#4CAF50', marginBottom: 12 }}>✦ Funkce</p>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B', letterSpacing: '-0.02em' }}>
            Vše co potřebujete. Nic navíc.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              borderRadius: 16,
              padding: '24px',
              background: isDark ? '#0D1A0E' : 'white',
              border: `0.5px solid ${isDark ? 'rgba(76,175,80,0.12)' : '#E0EBE0'}`,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, background: isDark ? 'rgba(76,175,80,0.12)' : '#E8F5E9' }}>
                <svg width="20" height="20" fill="none" stroke="#4CAF50" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={f.icon}/>
                </svg>
              </div>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: isDark ? '#E8F5E9' : '#1A2E1B', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.6, color: isDark ? '#6B8F6B' : '#4A6B4A' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Early Access ─────────────────────────────────────────────────────────────

function EarlyAccess({ isDark }: { isDark: boolean }) {
  const [form, setForm] = useState({ jmeno: '', email: '', firma: '', telefon: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const zprava = `ŽÁDOST O BETA PŘÍSTUP\n\nFirma: ${form.firma || 'neuvedena'}\nTelefon: ${form.telefon || 'neuvedeno'}\n\nChci být jedním z prvních testerů Felucia CRM a získat Professional plán zdarma na rok.`
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jmeno: form.jmeno, email: form.email, zprava }),
      })
      setStatus(res.ok ? 'ok' : 'err')
    } catch { setStatus('err') }
  }

  const bg = isDark ? '#0A120A' : '#F4FAF4'
  const cardBg = isDark ? '#0D1A0E' : 'white'
  const heading = isDark ? '#E8F5E9' : '#1A2E1B'
  const sub = isDark ? '#7AAD7A' : '#4A6B4A'
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: `1px solid ${isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9'}`,
    background: isDark ? 'rgba(76,175,80,0.04)' : '#F4FAF4',
    color: isDark ? '#E8F5E9' : '#1A2E1B',
    fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <section id="beta" style={{ padding: '96px 0', background: bg, borderTop: `1px solid ${isDark ? 'rgba(76,175,80,0.1)' : '#E8F5E9'}` }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, background: isDark ? 'rgba(76,175,80,0.12)' : '#E8F5E9', border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#A5D6A7'}`, color: '#4CAF50', display: 'inline-block', marginBottom: 20 }}>
            ✦ Uzavřená beta · Limitovaná místa
          </span>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: heading, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 16 }}>
            Staňte se prvním testerem.<br/>
            <span style={{ color: '#4CAF50' }}>Celý rok Professional zdarma.</span>
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: sub, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Hledáme HVAC firmy, které chtějí pomoci vyladit Felucii do finální podoby. Výměnou za zpětnou vazbu dostanete plný přístup ke všemu — včetně servisního modulu a AI Dáši — na 12 měsíců zdarma.
          </p>
        </div>

        {/* Perks */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 48 }}>
          {[
            { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Professional plán', desc: '12 měsíců zdarma — servis, AI Dáša, white-label, vše.' },
            { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', title: 'Přímý kontakt', desc: 'Váš feedback jde přímo k nám. Tvoříme produkt spolu.' },
            { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Jen 50 míst', desc: 'Uzavřená skupina — žádné čekání, prioritní onboarding.' },
          ].map((p, i) => (
            <div key={i} style={{ borderRadius: 16, padding: '20px 22px', background: cardBg, border: `1px solid ${isDark ? 'rgba(76,175,80,0.12)' : '#E0EBE0'}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(76,175,80,0.12)' : '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" stroke="#4CAF50" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={p.icon}/>
                </svg>
              </div>
              <div>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: heading, marginBottom: 4 }}>{p.title}</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: sub, lineHeight: 1.5 }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ borderRadius: 20, padding: '36px', background: cardBg, border: `1.5px solid ${isDark ? 'rgba(76,175,80,0.25)' : '#A5D6A7'}`, boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 8px 40px rgba(76,175,80,0.1)' }}>
          {status === 'ok' ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: isDark ? 'rgba(76,175,80,0.15)' : '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="28" height="28" fill="none" stroke="#4CAF50" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: '#4CAF50', marginBottom: 8 }}>Žádost přijata!</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: sub, lineHeight: 1.6 }}>
                Ozveme se vám do 24 hodin s přihlašovacími údaji a průvodcem onboardingem.<br/>Jsme moc rádi, že s námi jdete od začátku.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: heading, marginBottom: 24 }}>Požádat o beta přístup</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, marginBottom: 6 }}>Jméno a příjmení *</label>
                  <input required type="text" placeholder="Jan Novák" value={form.jmeno}
                    onChange={e => setForm(f => ({ ...f, jmeno: e.target.value }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, marginBottom: 6 }}>Email *</label>
                  <input required type="email" placeholder="jan@vasefirma.cz" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, marginBottom: 6 }}>Název firmy</label>
                  <input type="text" placeholder="HVAC s.r.o." value={form.firma}
                    onChange={e => setForm(f => ({ ...f, firma: e.target.value }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, marginBottom: 6 }}>Telefon</label>
                  <input type="tel" placeholder="+420 777 000 000" value={form.telefon}
                    onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} style={inputStyle}/>
                </div>
              </div>
              {status === 'err' && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#ef4444', marginBottom: 12 }}>Chyba při odesílání. Zkuste to prosím znovu.</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button type="submit" disabled={status === 'sending'}
                  style={{ padding: '13px 32px', borderRadius: 12, background: '#4CAF50', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: status === 'sending' ? 0.7 : 1, boxShadow: '0 4px 16px rgba(76,175,80,0.35)' }}>
                  {status === 'sending' ? 'Odesílám…' : 'Chci být tester →'}
                </button>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: isDark ? '#4A6B4A' : '#6B8F6B' }}>
                  Žádná platební karta · Ozveme se do 24 hodin
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Dáša Section ─────────────────────────────────────────────────────────────

type ChatMsg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'dasa'; text: string; opButtons?: OpButton[] }
  | { id: number; role: 'typing' }

interface OpButton {
  id: string
  label: string
}

const OP_BUTTONS: OpButton[] = [
  { id: 'OP-26-118', label: 'OP-26-118 · Martin Dvořák · Klimatizace · 98\u00a0400\u00a0Kč' },
  { id: 'OP-26-115', label: 'OP-26-115 · Jana Horáková · Klimatizace · 134\u00a0200\u00a0Kč' },
  { id: 'OP-26-112', label: 'OP-26-112 · Tomáš Beneš · Klimatizace · 87\u00a0600\u00a0Kč' },
]

function renderDasaText(text: string) {
  // Split on **bold** and ~~strike~~ markers
  const parts = text.split(/(\*\*[^*]+\*\*|~~[^~]+~~)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#E8F5E9', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <s key={i} style={{ color: '#6B8C6B' }}>{part.slice(2, -2)}</s>
    }
    return <span key={i}>{part}</span>
  })
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px' }}>
      <style>{`
        @keyframes dasaTyping {
          0%,60%,100% { opacity:0.2; transform:translateY(0); }
          30% { opacity:1; transform:translateY(-4px); }
        }
        .dasa-dot { width:6px; height:6px; border-radius:50%; background:#4CAF50; animation:dasaTyping 1.2s infinite; display:inline-block; }
        .dasa-dot:nth-child(2){animation-delay:0.2s;}
        .dasa-dot:nth-child(3){animation-delay:0.4s;}
        .dasa-chat::-webkit-scrollbar{width:4px;}
        .dasa-chat::-webkit-scrollbar-track{background:transparent;}
        .dasa-chat::-webkit-scrollbar-thumb{background:rgba(76,175,80,0.3);border-radius:4px;}
        .dasa-op-btn{background:rgba(76,175,80,0.1);border:1px solid rgba(76,175,80,0.3);color:#81C784;border-radius:8px;padding:8px 12px;font-size:12px;text-align:left;width:100%;cursor:pointer;font-family:Inter,sans-serif;transition:background 0.15s,border-color 0.15s;}
        .dasa-op-btn:hover{background:rgba(76,175,80,0.2);border-color:#4CAF50;}
        .dasa-op-btn.selected{background:rgba(76,175,80,0.25);border-color:#4CAF50;}
      `}</style>
      <span className="dasa-dot"/>
      <span className="dasa-dot"/>
      <span className="dasa-dot"/>
    </div>
  )
}

function DasaChat({ chatBg }: { chatBg: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [selectedOp, setSelectedOp] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const startedRef = useRef(false) // ref so IntersectionObserver callback doesn't capture stale state

  const addMsg = (msg: ChatMsg) => setMessages(prev => [...prev.filter(m => m.role !== 'typing'), msg])
  const addTyping = () => setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'typing' }])

  const startConversation = () => {
    timersRef.current.forEach(t => clearTimeout(t))
    timersRef.current = []
    setMessages([])
    setSelectedOp(null)
    startedRef.current = true
    setPhase(1)

    const t = (delay: number, fn: () => void) => {
      const id = setTimeout(fn, delay)
      timersRef.current.push(id)
    }

    // user msg
    t(600,  () => addMsg({ id: 1, role: 'user', text: 'Ahoj Dášo, udělej mi nabídku pro klienta. Teď od něj odjíždím. Jan Novák. Klimatizace. Zkopíruj ji od klienta kde jsem byl na schůzce minulý týden.' }))
    // Dáša typing
    t(1800, () => addTyping())
    // Dáša reply 1
    t(3200, () => addMsg({ id: 2, role: 'dasa', text: 'Jasně! Hledám schůzky z minulého týdne s klimatizací...' }))
    // Dáša typing 2
    t(4600, () => addTyping())
    // Dáša reply 2 + buttons
    t(6400, () => {
      addMsg({ id: 3, role: 'dasa', text: 'Našla jsem tyto OP kde jsi byl minulý týden:', opButtons: OP_BUTTONS })
      setPhase(2)
    })
  }

  // Phase 3: triggered when user clicks an OP button
  const handleOpSelect = (op: OpButton) => {
    if (selectedOp) return
    setSelectedOp(op.id)
    setPhase(3)

    const t = (delay: number, fn: () => void) => {
      const id = setTimeout(fn, delay)
      timersRef.current.push(id)
    }

    t(400,  () => addMsg({ id: 4, role: 'user', text: `${op.id} · ${op.label.split(' · ')[1]}` }))
    t(1200, () => addTyping())
    t(3000, () => addMsg({
      id: 5,
      role: 'dasa',
      text: 'Díky za upřesnění! 🌿\n\nVytvořila jsem klienta: **Jan Novák** s kategorií Klimatizace\nVložila nabídku zkopírovanou z OP-26-115 od Jany Horákové\n\nNabídka obsahuje:\n- Mitsubishi MSZ-AP35VG × 2 ks — 69\u00a0400\u00a0Kč\n- Montážní práce — 18\u00a0000\u00a0Kč\n- Spojovací materiál a potrubí 40m — 12\u00a0800\u00a0Kč\n- Uvedení do provozu — 4\u00a0000\u00a0Kč\n\nCelkem bez DPH: **104\u00a0200\u00a0Kč**\n\nMáš ji připravenou k revizi. Dej mi vědět jestli mám něco změnit.',
    }))
    t(4200, () => setPhase(4))
    t(5200, () => addMsg({ id: 6, role: 'user', text: 'Ano, bude tam méně potrubí. Dej tam jen 25 metrů.' }))
    t(6200, () => addTyping())
    t(8000, () => {
      addMsg({
        id: 7,
        role: 'dasa',
        text: 'Upravila jsem položku:\nSpojovací materiál a potrubí ~~40m~~ → **25m** — 8\u00a0000\u00a0Kč (-4\u00a0800\u00a0Kč)\n\nCelkem bez DPH: **99\u00a0400\u00a0Kč** ✓\n\nNabídka je připravená k náhledu. Mám ji rovnou odeslat klientovi?',
      })
      setPhase(5)
    })
  }

  // Auto-scroll chat container (not the page) on new messages
  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // IntersectionObserver — run once on mount, use ref to avoid stale closure
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !startedRef.current) startConversation() },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup timers on unmount only
  useEffect(() => {
    return () => { timersRef.current.forEach(t => clearTimeout(t)) }
  }, [])

  return (
    <div ref={sectionRef} style={{ borderRadius: 20, overflow: 'hidden', background: chatBg, border: '1px solid rgba(76,175,80,0.15)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(76,175,80,0.1)', flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4CAF50' }}/>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#81C784' }}>Dáša · AI asistentka</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'Inter, sans-serif', fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(76,175,80,0.15)', color: '#4CAF50' }}>online</span>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="dasa-chat" style={{ padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto', scrollBehavior: 'smooth' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#3A5C3A', fontFamily: 'Inter, sans-serif', fontSize: 12, padding: '40px 0' }}>
            Ukázka se spustí automaticky...
          </div>
        )}
        {messages.map(msg => {
          if (msg.role === 'typing') {
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px 16px 16px 4px' }}>
                  <TypingDots />
                </div>
              </div>
            )
          }
          if (msg.role === 'user') {
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ maxWidth: '85%', padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.5, background: 'rgba(76,175,80,0.2)', color: '#C8E6C9', borderRadius: '16px 16px 4px 16px', whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </div>
              </div>
            )
          }
          // dasa message
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', gap: 6, maxWidth: '92%' }}>
              <div style={{ padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6, background: 'rgba(255,255,255,0.05)', color: '#A5C8A5', borderRadius: '16px 16px 16px 4px', whiteSpace: 'pre-wrap' }}>
                {renderDasaText(msg.text)}
              </div>
              {msg.opButtons && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', paddingLeft: 2 }}>
                  {msg.opButtons.map(op => (
                    <button
                      key={op.id}
                      className={`dasa-op-btn${selectedOp === op.id ? ' selected' : ''}`}
                      onClick={() => handleOpSelect(op)}
                      disabled={!!selectedOp}
                    >
                      {selectedOp === op.id && <span style={{ marginRight: 6, color: '#4CAF50' }}>✓</span>}
                      {op.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Phase indicator */}
      {phase > 0 && phase < 5 && (
        <div style={{ padding: '6px 16px 10px', display: 'flex', gap: 4, justifyContent: 'center', flexShrink: 0 }}>
          {[1,2,3,4,5].map(p => (
            <div key={p} style={{ width: p <= phase ? 16 : 6, height: 4, borderRadius: 2, background: p <= phase ? '#4CAF50' : 'rgba(76,175,80,0.2)', transition: 'all 0.3s' }}/>
          ))}
        </div>
      )}
    </div>
  )
}

function DasaSection({ isDark }: { isDark: boolean }) {
  const bg = isDark ? '#0D1A0E' : '#1A2E1B'
  const chatBg = isDark ? '#0A120A' : '#111E12'
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '96px 0', background: bg }}>
      <div style={{ position: 'absolute', right: -20, bottom: 0, pointerEvents: 'none', opacity: isDark ? 0.08 : 0.06 }}>
        <TreeSvg color="#81C784" />
      </div>
      <div style={{ position: 'relative', maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 56, alignItems: 'center' }}>
          {/* Left */}
          <div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999, background: 'rgba(76,175,80,0.15)', color: '#81C784', display: 'inline-block', marginBottom: 20 }}>
              ✦ Umělá inteligence
            </span>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, color: '#E8F5E9', lineHeight: 1.2, marginBottom: 28, letterSpacing: '-0.02em' }}>
              Dáša — AI asistentka{' '}
              <span style={{ color: '#4CAF50' }}>která zná</span>{' '}
              váš obor
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['Navrhuje text nabídek z technické specifikace', 'Automaticky shrne stav zakázky a doporučí kroky', 'Odpoví na HVAC otázky s kontextem vašich dat', 'Připraví zprávu pro klienta jedním klikem'].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(76,175,80,0.2)', border: '1px solid rgba(76,175,80,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <svg width="14" height="14" fill="none" stroke="#4CAF50" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.5, color: '#A5C8A5' }}>{item}</p>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4A6B4A', marginTop: 20 }}>Dostupná v plánech Standard a Professional · 500 dotazů/měsíc (Standard) nebo neomezeně (Professional)</p>
          </div>

          {/* Animated chat */}
          <DasaChat chatBg={chatBg} />
        </div>
      </div>
    </section>
  )
}

// ─── Demo Section ─────────────────────────────────────────────────────────────

function DemoSection({ isDark }: { isDark: boolean }) {
  const bg      = isDark ? '#0A120A' : '#F0F7F0'
  const border  = isDark ? 'rgba(76,175,80,0.15)' : '#D0E8D0'
  const heading = isDark ? '#E8F5E9' : '#1A2E1B'
  const sub     = isDark ? '#6B8F6B' : '#4A6B4A'
  const cardBg  = isDark ? '#0D1A0E' : '#FFFFFF'

  return (
    <section id="demo" style={{ padding: '80px 0', background: bg, borderBottom: `1px solid ${border}` }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>

        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#4CAF50', marginBottom: 12 }}>✦ Demo prostředí</p>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(26px,4vw,38px)', fontWeight: 700, color: heading, letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.2 }}>
          Chcete vidět Felucii v akci?
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: sub, maxWidth: 500, margin: '0 auto 36px', lineHeight: 1.7 }}>
          Připravíme vám přihlašovací údaje do demo prostředí s reálnými vzorovými daty — stačí nám napsat.
        </p>

        <div style={{ borderRadius: 20, padding: '32px 36px', background: cardBg, border: `1px solid ${isDark ? 'rgba(76,175,80,0.15)' : '#D8EDD8'}`, boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', label: 'Plná aplikace', desc: 'Všechny moduly bez omezení' },
              { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Vzorová data', desc: 'Zakázky, klienti, analytiky' },
              { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Do 24 hodin', desc: 'Přihlašovací údaje obratem' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: 140 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: isDark ? 'rgba(76,175,80,0.1)' : '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" fill="none" stroke="#4CAF50" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={f.icon} />
                  </svg>
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: heading }}>{f.label}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: sub, textAlign: 'center', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <a
              href="mailto:info@felucia.io?subject=Zájem%20o%20demo%20Felucia%20CRM&body=Dobrý%20den%2C%0A%0Arád%20bych%20viděl%20demo%20prostředí%20Felucia%20CRM.%0A%0AJméno%3A%20%0ASpolečnost%3A%20%0ATelefon%3A%20"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, padding: '14px 32px', borderRadius: 12, background: '#4CAF50', color: 'white', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(76,175,80,0.35)' }}
            >
              <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              info@felucia.io
            </a>
            <a
              href="tel:+420724347986"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, padding: '14px 32px', borderRadius: 12, border: `1.5px solid ${isDark ? 'rgba(76,175,80,0.4)' : '#A8D5A8'}`, color: isDark ? '#7AAD7A' : '#2E6B2E', background: 'transparent', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              724 347 986
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'STARTER', price: '490',
    badge: { label: 'STARTER', color: '#A0845C', bg: 'rgba(160,132,92,0.12)' },
    features: ['1 uživatel', '20 obchodních případů', '100 produktů', '1 šablona nabídky', 'Subdoména firma.felucia.io', 'Email podpora 48 h'],
    cta: 'Vyzkoušet Starter', ctaStyle: 'outline', featured: false,
  },
  {
    name: 'STANDARD', price: '1 490',
    badge: { label: 'STANDARD', color: '#4CAF50', bg: 'rgba(76,175,80,0.12)' },
    features: ['2–5 uživatelů', 'Neomezené zakázky', 'Všechny šablony + editace', 'AI Dáša (500/měsíc)', 'Ceníky a analytiky'],
    cta: 'Vyzkoušet Standard', ctaStyle: 'filled', featured: true, pop: 'NEJOBLÍBENĚJŠÍ',
  },
  {
    name: 'PROFESSIONAL', price: '2 490',
    badge: { label: 'PROFESSIONAL', color: '#1565C0', bg: 'rgba(21,101,192,0.12)' },
    features: ['5–20 uživatelů', 'Vše ze Standard', 'Servisní modul', 'AI Dáša neomezená', 'White-label + API'],
    cta: 'Vyzkoušet Professional', ctaStyle: 'dark', featured: false,
  },
  {
    name: 'ENTERPRISE', price: null,
    badge: { label: 'ENTERPRISE', color: '#6A1B9A', bg: 'rgba(106,27,154,0.12)' },
    features: ['20+ uživatelů', 'Vše z Professional', 'Dedikovaný onboarding', 'SLA garance', 'Vlastní integrace + školení'],
    cta: 'Kontaktujte nás', ctaHref: 'mailto:info@felucia.io', ctaStyle: 'contact', featured: false,
  },
]

type PlanItem = typeof PLANS[number]

function Pricing({ isDark }: { isDark: boolean }) {
  return (
    <section id="ceny" style={{ padding: '96px 0', background: isDark ? '#0A120A' : '#F9FBF9' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#4CAF50', marginBottom: 12 }}>✦ Ceník</p>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B', letterSpacing: '-0.02em' }}>
            Jednoduché ceny, bez překvapení
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {PLANS.map((plan: PlanItem) => (
            <div key={plan.name} style={{
              position: 'relative',
              borderRadius: 20,
              padding: '28px 22px',
              display: 'flex',
              flexDirection: 'column',
              background: plan.featured ? (isDark ? 'rgba(76,175,80,0.07)' : '#E8F5E9') : (isDark ? '#0D1A0E' : 'white'),
              border: `${plan.featured ? 2 : 1}px solid ${plan.featured ? '#4CAF50' : (isDark ? 'rgba(76,175,80,0.15)' : '#E0EBE0')}`,
            }}>
              {(plan as { pop?: string }).pop && (
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: '#4CAF50', color: 'white', whiteSpace: 'nowrap' }}>
                    {(plan as { pop?: string }).pop}
                  </span>
                </div>
              )}
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: plan.badge.bg, color: plan.badge.color, alignSelf: 'flex-start', marginBottom: 20 }}>
                {plan.badge.label}
              </span>
              <div style={{ marginBottom: 24 }}>
                {plan.price !== null ? (
                  <>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B' }}>{plan.price} Kč</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: isDark ? '#4A6B4A' : '#6B8F6B', marginLeft: 4 }}>/měsíc</span>
                  </>
                ) : (
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B' }}>Individuální nabídka</span>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter, sans-serif', fontSize: 13, color: isDark ? '#A5C8A5' : '#4A6B4A' }}>
                    <svg width="15" height="15" fill="none" stroke="#4CAF50" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.ctaStyle === 'contact' ? (
                <a href={(plan as { ctaHref?: string }).ctaHref ?? 'mailto:info@felucia.io'} style={{
                  display: 'block', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, padding: '12px 0', borderRadius: 12, textDecoration: 'none',
                  background: isDark ? 'rgba(106,27,154,0.15)' : 'rgba(106,27,154,0.08)', color: '#AB47BC', border: '1px solid rgba(106,27,154,0.3)',
                }}>
                  {plan.cta}
                </a>
              ) : (
                <a href="#beta" style={{
                  display: 'block', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, padding: '12px 0', borderRadius: 12, textDecoration: 'none',
                  ...(plan.ctaStyle === 'filled'
                    ? { background: '#4CAF50', color: 'white' }
                    : plan.ctaStyle === 'dark'
                    ? { background: isDark ? '#1A2E1B' : '#1565C0', color: 'white' }
                    : { border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#C8E6C9'}`, color: isDark ? '#7AAD7A' : '#4A6B4A' }),
                }}>
                  Získat beta přístup
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: 'Kolik stojí Felucia CRM?', a: 'Plán Starter stojí 490 Kč/měsíc a zahrnuje 1 uživatele, 20 obchodních případů a 100 produktů. Standard (1 490 Kč/měs) přidává AI asistentku Dášu a neomezené OP. Professional (2 490 Kč/měs) odemyká servisní modul a white-label. Enterprise je na individuální nabídku.' },
  { q: 'Pro jaké firmy je Felucia určena?', a: 'Felucia je navržena specificky pro HVAC profesionály — instalatéry tepelných čerpadel, klimatizací, rekuperací a vzduchotechniky. Funguje stejně dobře pro živnostníky i větší týmy.' },
  { q: 'Jak funguje AI asistentka Dáša?', a: 'Dáša je jazykový model napojený na vaše firemní data. Zná vaše zakázky, produkty a klienty — a pomáhá s psaním nabídek, shrnutím zakázek a odpovídáním na HVAC otázky.' },
  { q: 'Mohu importovat data z předchozího systému?', a: 'Ano, podporujeme import produktů z Excel exportu ve formátu XLSX. Import probíhá průvodcem v nastavení — celý proces trvá méně než 5 minut.' },
  { q: 'Jak funguje subdoména?', a: 'Každá firma dostane vlastní adresu, například vasefirma.felucia.io. Přístup je možný z počítače i mobilu — Felucia je plně responzivní a funguje jako PWA aplikace.' },
  { q: 'Co je plán Professional?', a: 'Professional (2 490 Kč/měs) odemyká servisní modul — evidenci nainstalovaných zařízení, záruky, servisní kontrakty a plánování návštěv. Součástí je také white-label, API přístup a neomezená AI Dáša. Ideální pro firmy poskytující záruční i pozáruční servis.' },
]

function FAQ({ isDark }: { isDark: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section id="faq" style={{ padding: '96px 0', background: isDark ? '#0D1A0E' : '#F4FAF4', borderTop: `1px solid ${isDark ? 'rgba(76,175,80,0.1)' : '#E8F5E9'}` }}>
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#4CAF50', marginBottom: 12 }}>✦ FAQ</p>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B', letterSpacing: '-0.02em' }}>
            Časté otázky
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: isDark ? '#0A120A' : 'white', border: `0.5px solid ${isDark ? 'rgba(76,175,80,0.15)' : '#E0EBE0'}` }}>
              <button onClick={() => setOpen(open === i ? null : i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: isDark ? '#C8E6C9' : '#1A2E1B', flex: 1 }}>
                  {faq.q}
                </span>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(76,175,80,0.1)', color: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 300, flexShrink: 0, transition: 'transform 0.2s', transform: open === i ? 'rotate(45deg)' : 'none', lineHeight: 1 }}>
                  +
                </span>
              </button>
              {open === i && (
                <div style={{ padding: '0 20px 16px' }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.7, color: isDark ? '#6B8F6B' : '#4A6B4A' }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ isDark }: { isDark: boolean }) {
  const bg = isDark ? '#060E06' : '#1A2E1B'
  return (
    <footer style={{ background: bg, borderTop: '1px solid rgba(76,175,80,0.15)' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '56px 24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 40, marginBottom: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <LogoLeaf dark />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: '#E8F5E9' }}>felucia</span>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6, color: '#4A6B4A' }}>
              Built for the field.<br/>Made to grow.
            </p>
          </div>
          {[
            { title: 'Produkt', links: [['#funkce','Funkce'],['#ceny','Ceny'],['#faq','FAQ']] },
            { title: 'Účet', links: [['#beta','Beta přístup'],['/auth/signin','Přihlásit se']] },
            { title: 'Společnost', links: [['/terms','Podmínky'],['/privacy','Soukromí']] },
          ].map(col => (
            <div key={col.title}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4A6B4A', marginBottom: 16 }}>{col.title}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(([href, label]) => (
                  <a key={href} href={href} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B8F6B', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#81C784')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#6B8F6B')}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 24, borderTop: '1px solid rgba(76,175,80,0.1)' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4A6B4A' }}>© 2026 Felucia · NANTO s.r.o.</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4A6B4A' }}>Vše roste. ✦</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FeluciaLanding() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div style={{ background: isDark ? '#0A120A' : '#F9FBF9', minHeight: '100vh', overflowX: 'hidden' }}>
      <Navbar isDark={isDark} />
      <Hero isDark={isDark} />
      <Marquee isDark={isDark} />
      <EarlyAccess isDark={isDark} />
      <DemoSection isDark={isDark} />
      <Features isDark={isDark} />
      <DasaSection isDark={isDark} />
      <Pricing isDark={isDark} />
      <FAQ isDark={isDark} />
      <Footer isDark={isDark} />
    </div>
  )
}
