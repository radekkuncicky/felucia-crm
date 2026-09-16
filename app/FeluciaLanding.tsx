'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { CONTACT, FAQS, OPERATOR, PLANS, WORKFLOW_HEADING, WORKFLOW_PEREX, WORKFLOW_PHASES, formatPrice, type PlanId } from '@/lib/landing'

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

const NAV_LINKS: [string, string][] = [['#jak-to-funguje', 'Jak to funguje'], ['#technici', 'Pro techniky'], ['#servis', 'Servis'], ['#ceny', 'Ceny'], ['#faq', 'FAQ']]

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
        <div style={{ alignItems: 'center', gap: 28 }} className="hidden md:flex">
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} href={href} style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, color: isDark ? '#7AAD7A' : '#4A6B4A', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#4CAF50')}
              onMouseLeave={e => (e.currentTarget.style.color = isDark ? '#7AAD7A' : '#4A6B4A')}>
              {label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div style={{ alignItems: 'center', gap: 10 }} className="hidden md:flex">
          <Link href="/auth/signin" style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, padding: '8px 16px', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(76,175,80,0.4)' : '#C8E6C9'}`, color: isDark ? '#7AAD7A' : '#4A6B4A', textDecoration: 'none' }}>
            Přihlásit se
          </Link>
          <a href="#ukazka" style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, padding: '8px 18px', borderRadius: 10, background: '#4CAF50', color: 'white', textDecoration: 'none' }}>
            Domluvit ukázku
          </a>
        </div>

        {/* Hamburger */}
        <button className="md:hidden" onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Zavřít menu' : 'Otevřít menu'} aria-expanded={menuOpen} aria-controls="mobile-menu"
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
        <div id="mobile-menu" className="md:hidden" style={{ background: isDark ? '#0D1A0E' : '#F4FAF4', borderBottom: `1px solid ${isDark ? 'rgba(76,175,80,0.2)' : '#C8E6C9'}`, padding: '12px 24px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {NAV_LINKS.map(([href, label]) => (
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
              <a href="#ukazka" onClick={() => setMenuOpen(false)}
                style={{ flex: 1, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, padding: '10px 0', borderRadius: 10, background: '#4CAF50', color: 'white', textDecoration: 'none' }}>
                Domluvit ukázku
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Snímky aplikace Felucia Tech ────────────────────────────────────────────
// Skutečné snímky z iOS aplikace nad ukázkovými daty (public/marketing/*.jpg).
// Pozor: /marketing/ musí zůstat ve výjimkách matcheru v middleware.ts,
// jinak se obrázky přesměrují na login.

function PhoneCarousel({ shots, width, isDark }: { shots: { src: string; alt: string; caption: string }[]; width: number; isDark: boolean }) {
  const [index, setIndex] = useState(0)
  const current = shots[index]
  const go = (i: number) => setIndex((i + shots.length) % shots.length)

  const arrowStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#C8E6C9'}`,
    background: isDark ? 'rgba(76,175,80,0.1)' : 'white',
    color: isDark ? '#81C784' : '#4A6B4A',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Snímky aplikace Felucia Tech"
      style={{ width: '100%', maxWidth: width + 96, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'center' }}>
        <button type="button" onClick={() => go(index - 1)} aria-label="Předchozí snímek" style={arrowStyle}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        <figure style={{ margin: 0, width: '100%', maxWidth: width }}>
          <div style={{
            borderRadius: 30,
            border: `2px solid ${isDark ? 'rgba(76,175,80,0.25)' : '#DCEBDC'}`,
            background: isDark ? '#0A120A' : 'white',
            padding: 8,
            boxShadow: isDark ? '0 22px 50px rgba(0,0,0,0.5)' : '0 18px 40px rgba(26,46,27,0.12)',
          }}>
            <img
              key={current.src}
              src={current.src}
              alt={current.alt}
              width={780}
              height={1689}
              loading="lazy"
              decoding="async"
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 23 }}
            />
          </div>
          <figcaption
            aria-live="polite"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.5, color: isDark ? '#A5C8A5' : '#4A6B4A', textAlign: 'center', marginTop: 16, minHeight: 40 }}
          >
            <span style={{ display: 'block', fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4CAF50', marginBottom: 4 }}>
              Krok {index + 1} z {shots.length}
            </span>
            {current.caption}
          </figcaption>
        </figure>

        <button type="button" onClick={() => go(index + 1)} aria-label="Další snímek" style={arrowStyle}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Puntíky */}
      <div style={{ display: 'flex', gap: 4, marginTop: 12, justifyContent: 'center' }}>
        {shots.map((shot, i) => (
          <button
            key={shot.src}
            type="button"
            onClick={() => go(i)}
            aria-label={`Snímek ${i + 1}: ${shot.caption}`}
            aria-current={i === index ? 'true' : undefined}
            // Tlačítko je dotyková plocha (na mobilu globální min 44 px), puntík je jen vnitřní span.
            style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span aria-hidden="true" style={{
              display: 'block',
              width: i === index ? 26 : 9,
              height: 9,
              borderRadius: 999,
              background: i === index ? '#4CAF50' : (isDark ? 'rgba(76,175,80,0.28)' : '#C8E6C9'),
              transition: 'width 0.25s, background 0.25s',
            }} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ isDark }: { isDark: boolean }) {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', paddingTop: 128, paddingBottom: 72, background: isDark ? '#0D1A0E' : '#F4FAF4', borderBottom: `1px solid ${isDark ? 'rgba(76,175,80,0.12)' : '#C8E6C9'}` }}>
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

      <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 999, background: isDark ? 'rgba(76,175,80,0.12)' : '#E8F5E9', border: `1px solid ${isDark ? 'rgba(76,175,80,0.35)' : '#A5D6A7'}`, color: '#4CAF50', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#4CAF50' }}/>
            Systém pro montážní a servisní firmy
          </span>
        </div>

        {/* Heading */}
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px, 4.6vw, 54px)', fontWeight: 700, lineHeight: 1.2, color: isDark ? '#E8F5E9' : '#1A2E1B', maxWidth: 760, margin: '0 auto 24px', letterSpacing: '-0.02em' }}>
          Od nabídky přes <span style={{ color: '#4CAF50' }}>montáž</span> až po pravidelný <span style={{ color: isDark ? '#C8A97A' : '#A0845C' }}>servis.</span>
        </h1>

        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, color: isDark ? '#7AAD7A' : '#4A6B4A', maxWidth: 600, margin: '0 auto 16px', lineHeight: 1.6 }}>
          Felucia propojí kancelář a techniky v jednom systému. Nabídky, podklady k montáži, skutečně použitý materiál i předávací protokoly najdete u konkrétní zakázky.
        </p>

        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontStyle: 'italic', color: isDark ? '#4A6B4A' : '#6B8F6B', maxWidth: 520, margin: '0 auto 36px' }}>
          Vyvinuto z každodenní praxe montáží a servisu.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <a href="#ukazka" style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600, padding: '14px 28px', borderRadius: 12, background: '#4CAF50', color: 'white', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(76,175,80,0.4)' }}>
            Domluvit 20minutovou ukázku →
          </a>
          <a href="#jak-to-funguje" style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 500, padding: '14px 28px', borderRadius: 12, border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#C8E6C9'}`, color: isDark ? '#7AAD7A' : '#4A6B4A', background: 'transparent', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Jak Felucia funguje
          </a>
        </div>
      </div>

      {/* Reálná obrazovka zakázky (ukázková data) - stejná zakázka, kterou níže sleduje celý příběh */}
      <figure style={{ position: 'relative', maxWidth: 1040, margin: '56px auto 0', padding: '0 24px' }}>
        <BrowserShot shot={HERO_SHOT} isDark={isDark} priority />
        <figcaption style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: isDark ? '#4A6B4A' : '#6B8F6B', textAlign: 'center', marginTop: 14 }}>
          {HERO_SHOT.caption}
        </figcaption>
      </figure>
    </section>
  )
}

// ─── Marquee ──────────────────────────────────────────────────────────────────

function Marquee({ isDark }: { isDark: boolean }) {
  const items = ['Tepelná čerpadla', 'Klimatizace', 'Rekuperace', 'Podlahové vytápění', 'Vzduchotechnika', 'Servisní kontrakty']
  const repeated = [...items, ...items]
  return (
    <div aria-hidden="true" style={{ overflow: 'hidden', background: isDark ? 'rgba(76,175,80,0.05)' : 'rgba(76,175,80,0.04)', borderBottom: `1px solid ${isDark ? 'rgba(76,175,80,0.1)' : '#E8F5E9'}`, padding: '14px 0' }}>
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

// ─── Workflow steps (jedna zakázka od začátku do konce) ────────────────────────

// Ikony kroků procesu. Texty kroků žijí v lib/landing.ts (WORKFLOW_PHASES),
// aby se viditelný obsah, llms.txt a strukturovaná data nerozešly.
const STEP_ICONS: Record<number, string> = {
  1: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  2: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  3: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  4: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  5: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  6: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  7: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  8: 'M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
}

// Snímky obrazovek Felucia Tech (iOS, ukázková data) - soubory v public/marketing/.
// Pořadí = průchod zakázkou, používá je carousel u kroku 6.
const TECH_SHOTS = [
  {
    src: '/marketing/tech-muj-den.jpg',
    alt: 'Felucia Tech - obrazovka Můj den s další zastávkou, navigací a dnešními zakázkami',
    caption: 'Můj den - další zastávka, navigace a dnešní zakázky',
  },
  {
    src: '/marketing/tech-zakazka-detail.jpg',
    alt: 'Felucia Tech - detail zakázky s adresou montáže, navigací, kontaktem na klienta a týmem',
    caption: 'Detail zakázky - adresa montáže, klient i tým na jeden dotyk',
  },
  {
    src: '/marketing/tech-zakazka-kontakty.jpg',
    alt: 'Felucia Tech - kontakty na stavbě a odškrtávání položek zakázky',
    caption: 'Kontakty na stavbě a odškrtávání položek',
  },
  {
    src: '/marketing/tech-zakazka-komentare.jpg',
    alt: 'Felucia Tech - pokyny od manažera, fotodokumentace a komentáře u zakázky',
    caption: 'Pokyny z kanceláře, fotodokumentace a komentáře',
  },
  {
    src: '/marketing/tech-predavak-polozky.jpg',
    alt: 'Felucia Tech - předávací protokol se skutečně použitým množstvím materiálu',
    caption: 'Předávací protokol se skutečně použitým množstvím',
  },
  {
    src: '/marketing/tech-predavak-podpis.jpg',
    alt: 'Felucia Tech - podpis klienta na předávacím protokolu a odeslání do kanceláře',
    caption: 'Podpis klienta na místě a odeslání do kanceláře',
  },
]

// Desktopové snímky CRM (ukázková organizace, jeden klient - Petr Horák - od
// poptávky po servis). Generuje `./scripts/marketing-shots.sh` do
// public/marketing/crm-*.jpg; po změně UI stačí pustit znovu.
// Klíč = číslo kroku z WORKFLOW_PHASES; krok 6 má místo snímku mobilní carousel.
const CRM_SHOT_W = 2160
const CRM_SHOT_H = 1350
const HERO_SHOT = { src: '/marketing/crm-zakazka.jpg', alt: 'Felucia - detail zakázky 26-901: termín montáže, místo instalace s navigací, kontakt na klienta, etapy a finanční přehled', caption: 'Zakázka v kanceláři: termín, místo montáže, kontakt, etapy a finance na jedné obrazovce' }
const STEP_SHOTS: Record<number, { src: string; alt: string; caption: string }> = {
  1: { src: '/marketing/crm-op.jpg', alt: 'Felucia - detail obchodního případu OP-26-101 s klientem, adresou díla, stavem a přehledem nabídek', caption: 'Obchodní případ OP-26-101 - klient, adresa díla, stav a kdo na něm pracuje' },
  2: { src: '/marketing/crm-nabidka.jpg', alt: 'Felucia - nabídka NAB-26-0101 s položkami materiálu a práce, cenami a součtem', caption: 'Nabídka NAB-26-0101 - položky materiálu a práce s cenami' },
  3: { src: '/marketing/crm-smlouva.jpg', alt: 'Felucia - smlouva o dílo podepsaná zhotovitelem i klientem online, s historií podpisu', caption: 'Smlouva o dílo podepsaná online oběma stranami' },
  4: { src: '/marketing/crm-zakazka.jpg', alt: 'Felucia - detail zakázky 26-901 s termínem, místem montáže, technikem a položkami převzatými z nabídky', caption: 'Zakázka 26-901 - termín, místo montáže, technik a položky z nabídky' },
  5: { src: '/marketing/crm-material.jpg', alt: 'Felucia - položky zakázky 26-901 se stavem materiálu (vydáno), množstvím a cenami', caption: 'Položky zakázky - u každé je vidět stav materiálu: objednáno, naskladněno, vydáno' },
  7: { src: '/marketing/crm-predavak.jpg', alt: 'Felucia - předávací protokol PP-26-032 s plánovaným a skutečně použitým množstvím a podpisem klienta', caption: 'Předávací protokol PP-26-032 - v nabídce 10 m potrubí, použito 12 m, podpis klienta' },
  8: { src: '/marketing/crm-vyuctovani.jpg', alt: 'Felucia - vyúčtování VYU-26-032 ke schválení, sestavené z předávacího protokolu', caption: 'Vyúčtování VYU-26-032 ke schválení - vzniklo z protokolu, kancelář jen kontroluje' },
  9: { src: '/marketing/crm-servis.jpg', alt: 'Felucia - servisní nástěnka se zařízeními v záruce, kontrakty a plánovanými návštěvami', caption: 'Servis - zařízení v záruce, kontrakty a plánované návštěvy' },
}

/** Snímek obrazovky v rámečku prohlížeče. */
function BrowserShot({ shot, isDark, priority = false }: { shot: { src: string; alt: string }; isDark: boolean; priority?: boolean }) {
  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${isDark ? 'rgba(76,175,80,0.25)' : '#DCEBDC'}`,
      background: isDark ? '#0A120A' : 'white',
      boxShadow: isDark ? '0 22px 50px rgba(0,0,0,0.5)' : '0 18px 40px rgba(26,46,27,0.12)',
      overflow: 'hidden',
    }}>
      <div aria-hidden="true" style={{ display: 'flex', gap: 6, padding: '9px 12px', borderBottom: `1px solid ${isDark ? 'rgba(76,175,80,0.15)' : '#EAF2EA'}`, background: isDark ? '#0D1A0E' : '#F4FAF4' }}>
        {['#E57373', '#FFD54F', '#81C784'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.85 }} />)}
      </div>
      <img
        src={shot.src}
        alt={shot.alt}
        width={CRM_SHOT_W}
        height={CRM_SHOT_H}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />
    </div>
  )
}

function StepBullets({ bullets, isDark }: { bullets: string[]; isDark: boolean }) {
  const sub = isDark ? '#6B8F6B' : '#4A6B4A'
  // Body jsou schované za nativním <details> (ovladatelné klávesnicí) - na
  // stránce zůstává jen titulek a jedna věta, detail si rozbalí, kdo chce.
  // Obsah je v HTML i sbalený, takže ho vidí vyhledávače i LLM.
  return (
    <details style={{ marginTop: 14 }}>
      <summary style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, fontWeight: 600, color: '#4CAF50', cursor: 'pointer', listStyle: 'revert' }}>
        Podrobněji
      </summary>
      <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bullets.map(b => (
          <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <svg width="14" height="14" fill="none" stroke="#4CAF50" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7"/>
            </svg>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, lineHeight: 1.55, color: sub }}>{b}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

// Kotvy pro Navbar a staré odkazy (#technici, #servis bývaly samostatné sekce).
const STEP_ANCHORS: Record<number, string> = { 6: 'technici' }
const PHASE_ANCHORS: Record<string, string> = { servis: 'servis' }

function WorkflowSteps({ isDark }: { isDark: boolean }) {
  const heading = isDark ? '#E8F5E9' : '#1A2E1B'
  const sub = isDark ? '#6B8F6B' : '#4A6B4A'
  const rail = isDark ? 'rgba(76,175,80,0.22)' : '#C8E6C9'

  return (
    <section id="jak-to-funguje" aria-labelledby="jak-heading" style={{ padding: '96px 0 72px', background: isDark ? '#0A120A' : '#F9FBF9' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#4CAF50', marginBottom: 12 }}>✦ Jak to funguje</p>
          <h2 id="jak-heading" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: heading, letterSpacing: '-0.02em', marginBottom: 16 }}>
            {WORKFLOW_HEADING}
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, lineHeight: 1.7, color: sub }}>
            {WORKFLOW_PEREX}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, lineHeight: 1.6, color: isDark ? '#4A6B4A' : '#6B8F6B', marginTop: 14 }}>
            Všechny snímky jsou ze skutečné aplikace nad ukázkovými daty - jeden zákazník od poptávky po servis.
          </p>
        </div>

        {WORKFLOW_PHASES.map((phase, phaseIndex) => (
          <div key={phase.id} id={PHASE_ANCHORS[phase.id]} style={{ marginBottom: phaseIndex === WORKFLOW_PHASES.length - 1 ? 0 : 40, scrollMarginTop: 90 }}>
            {/* Štítek fáze */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4CAF50', padding: '6px 12px', borderRadius: 999, background: 'rgba(76,175,80,0.12)', flexShrink: 0 }}>
                Fáze {phaseIndex + 1}
              </span>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: heading, letterSpacing: '-0.01em', margin: 0, flexShrink: 0 }}>
                {phase.name}
              </h3>
              <span aria-hidden="true" style={{ flex: 1, height: 1, background: rail, minWidth: 16 }} />
            </div>

            {/* Kroky: text + snímek, strany se střídají; na mobilu pod sebou */}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 48 }}>
              {phase.steps.map(step => {
                const shot = STEP_SHOTS[step.n]
                const flip = step.n % 2 === 0
                return (
                  <li key={step.n} id={STEP_ANCHORS[step.n]} className={`fl-step${flip ? ' fl-step-flip' : ''}`} style={{ scrollMarginTop: 90 }}>
                    <div className="fl-step-text">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(76,175,80,0.12)', color: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                          {step.n}
                        </span>
                        <svg width="18" height="18" fill="none" stroke="#4CAF50" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={STEP_ICONS[step.n]}/>
                        </svg>
                        {step.badge && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'Inter, sans-serif', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4CAF50', background: 'rgba(76,175,80,0.15)', padding: '4px 9px', borderRadius: 999 }}>
                            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                            </svg>
                            {step.badge}
                          </span>
                        )}
                      </div>

                      <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(18px,2vw,22px)', fontWeight: 600, color: heading, marginBottom: 10, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{`Krok ${step.n}: `}</span>
                        {step.title}
                      </h4>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14.5, lineHeight: 1.65, color: sub, margin: 0 }}>{step.desc}</p>

                      <StepBullets bullets={step.bullets} isDark={isDark} />
                    </div>

                    <div className="fl-step-shot">
                      {shot ? (
                        <figure style={{ margin: 0 }}>
                          <BrowserShot shot={shot} isDark={isDark} />
                          <figcaption style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, lineHeight: 1.5, color: isDark ? '#7AAD7A' : '#4A6B4A', marginTop: 12 }}>
                            {shot.caption}
                          </figcaption>
                        </figure>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <PhoneCarousel isDark={isDark} shots={TECH_SHOTS} width={260} />
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: isDark ? '#4A6B4A' : '#6B8F6B', marginTop: 14, lineHeight: 1.6, textAlign: 'center', maxWidth: 360 }}>
                            Aplikace Felucia Tech pro iOS a Android. Ostrý provoz s technikem v terénu doplňujeme postupně s prvními firmami.
                          </p>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
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
  { id: 'OP-26-118', label: 'OP-26-118 · Martin Dvořák · Klimatizace · 98 400 Kč' },
  { id: 'OP-26-115', label: 'OP-26-115 · Jana Horáková · Klimatizace · 134 200 Kč' },
  { id: 'OP-26-112', label: 'OP-26-112 · Tomáš Beneš · Klimatizace · 87 600 Kč' },
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

// Styly chatu Dáši. POZOR: musí být v komponentě, která je v DOM po celou dobu
// ukázky. Dřív seděly uvnitř TypingDots - jakmile Dáša dopsala, TypingDots se
// odmountoval, styly zmizely a tlačítka OP zůstala nenastylovaná (černý text
// na tmavém pozadí = neviditelná).
function DasaChatStyles() {
  return (
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
      .dasa-op-btn:disabled{cursor:default;opacity:0.85;}
    `}</style>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px' }}>
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
      text: 'Díky za upřesnění! 🌿\n\nVytvořila jsem klienta: **Jan Novák** s kategorií Klimatizace\nVložila nabídku zkopírovanou z OP-26-115 od Jany Horákové\n\nNabídka obsahuje:\n- Mitsubishi MSZ-AP35VG × 2 ks — 69 400 Kč\n- Montážní práce — 18 000 Kč\n- Spojovací materiál a potrubí 40m — 12 800 Kč\n- Uvedení do provozu — 4 000 Kč\n\nCelkem bez DPH: **104 200 Kč**\n\nMáš ji připravenou k revizi. Dej mi vědět jestli mám něco změnit.',
    }))
    t(4200, () => setPhase(4))
    t(5200, () => addMsg({ id: 6, role: 'user', text: 'Ano, bude tam méně potrubí. Dej tam jen 25 metrů.' }))
    t(6200, () => addTyping())
    t(8000, () => {
      addMsg({
        id: 7,
        role: 'dasa',
        text: 'Upravila jsem položku:\nSpojovací materiál a potrubí ~~40m~~ → **25m** — 8 000 Kč (-4 800 Kč)\n\nCelkem bez DPH: **99 400 Kč** ✓\n\nNabídka je připravená k náhledu. Mám ji rovnou odeslat klientovi?',
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

      <DasaChatStyles />

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
    <section id="dasa" aria-labelledby="dasa-heading" style={{ position: 'relative', overflow: 'hidden', padding: '96px 0', background: bg }}>
      <div style={{ position: 'absolute', right: -20, bottom: 0, pointerEvents: 'none', opacity: isDark ? 0.08 : 0.06 }}>
        <TreeSvg color="#81C784" />
      </div>
      <div style={{ position: 'relative', maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 56, alignItems: 'center' }}>
          {/* Left */}
          <div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999, background: 'rgba(76,175,80,0.15)', color: '#81C784', display: 'inline-block', marginBottom: 20 }}>
              ✦ Doplňková pomoc
            </span>
            <h2 id="dasa-heading" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, color: '#E8F5E9', lineHeight: 1.2, marginBottom: 20, letterSpacing: '-0.02em' }}>
              Dáša — AI asistentka{' '}
              <span style={{ color: '#4CAF50' }}>u konkrétní práce</span>
            </h2>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.7, color: '#A5C8A5', marginBottom: 24 }}>
              Pracovní postup zakázky a mobilní aplikace pro techniky zůstávají jádrem Felucie. Dáša je pomocník navíc — pomáhá s konkrétní prací u zakázky.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['Navrhuje text nabídek z technické specifikace', 'Automaticky shrne stav zakázky a doporučí kroky', 'Odpoví na dotazy s kontextem vašich dat', 'Připraví zprávu pro klienta jedním klikem'].map((item, i) => (
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

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLAN_STYLE: Record<PlanId, { color: string; bg: string; cta: 'outline' | 'filled' | 'dark' | 'contact' }> = {
  STARTER:      { color: '#A0845C', bg: 'rgba(160,132,92,0.12)', cta: 'outline' },
  STANDARD:     { color: '#4CAF50', bg: 'rgba(76,175,80,0.12)',  cta: 'filled' },
  PROFESSIONAL: { color: '#1565C0', bg: 'rgba(21,101,192,0.12)', cta: 'dark' },
  ENTERPRISE:   { color: '#6A1B9A', bg: 'rgba(106,27,154,0.12)', cta: 'contact' },
}

function Pricing({ isDark }: { isDark: boolean }) {
  return (
    <section id="ceny" aria-labelledby="ceny-heading" style={{ padding: '96px 0', background: isDark ? '#0A120A' : '#F9FBF9' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#4CAF50', marginBottom: 12 }}>✦ Ceník</p>
          <h2 id="ceny-heading" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B', letterSpacing: '-0.02em' }}>
            Jednoduché ceny, bez překvapení
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: isDark ? '#6B8F6B' : '#4A6B4A', marginTop: 12 }}>
            Na ukázce probereme, který plán sedí vašemu počtu lidí a provozu.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {PLANS.map(plan => {
            const st = PLAN_STYLE[plan.id]
            return (
            <div key={plan.id} style={{
              position: 'relative',
              borderRadius: 20,
              padding: '28px 22px',
              display: 'flex',
              flexDirection: 'column',
              background: isDark ? '#0D1A0E' : 'white',
              border: `1px solid ${isDark ? 'rgba(76,175,80,0.15)' : '#E0EBE0'}`,
            }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: st.bg, color: st.color, alignSelf: 'flex-start', marginBottom: 20 }}>
                {plan.id}
              </span>
              <div style={{ marginBottom: 24 }}>
                {plan.price !== null ? (
                  <>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B' }}>{formatPrice(plan.price)} Kč</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: isDark ? '#4A6B4A' : '#6B8F6B', marginLeft: 4 }}>/měsíc</span>
                  </>
                ) : (
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B' }}>Individuální nabídka</span>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter, sans-serif', fontSize: 13, color: isDark ? '#A5C8A5' : '#4A6B4A' }}>
                    <svg width="15" height="15" fill="none" stroke="#4CAF50" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {st.cta === 'contact' ? (
                <a href={`mailto:${CONTACT.email}`} style={{
                  display: 'block', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, padding: '12px 0', borderRadius: 12, textDecoration: 'none',
                  background: isDark ? 'rgba(106,27,154,0.15)' : 'rgba(106,27,154,0.08)', color: '#AB47BC', border: '1px solid rgba(106,27,154,0.3)',
                }}>
                  Kontaktujte nás
                </a>
              ) : (
                <a href="#ukazka" style={{
                  display: 'block', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, padding: '12px 0', borderRadius: 12, textDecoration: 'none',
                  ...(st.cta === 'filled'
                    ? { background: '#4CAF50', color: 'white' }
                    : st.cta === 'dark'
                    ? { background: isDark ? '#1A2E1B' : '#1565C0', color: 'white' }
                    : { border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#C8E6C9'}`, color: isDark ? '#7AAD7A' : '#4A6B4A' }),
                }}>
                  Domluvit ukázku
                </a>
              )}
            </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ({ isDark }: { isDark: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section id="faq" aria-labelledby="faq-heading" style={{ padding: '96px 0', background: isDark ? '#0D1A0E' : '#F4FAF4', borderTop: `1px solid ${isDark ? 'rgba(76,175,80,0.1)' : '#E8F5E9'}` }}>
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#4CAF50', marginBottom: 12 }}>✦ FAQ</p>
          <h2 id="faq-heading" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: isDark ? '#E8F5E9' : '#1A2E1B', letterSpacing: '-0.02em' }}>
            Časté otázky
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: isDark ? '#0A120A' : 'white', border: `0.5px solid ${isDark ? 'rgba(76,175,80,0.15)' : '#E0EBE0'}` }}>
              <button onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i} aria-controls={`faq-a-${i}`}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: isDark ? '#C8E6C9' : '#1A2E1B', flex: 1 }}>
                  {faq.q}
                </span>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(76,175,80,0.1)', color: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 300, flexShrink: 0, transition: 'transform 0.2s', transform: open === i ? 'rotate(45deg)' : 'none', lineHeight: 1 }}>
                  +
                </span>
              </button>
              {open === i && (
                <div id={`faq-a-${i}`} style={{ padding: '0 20px 16px' }}>
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

// ─── CTA / Osobní ukázka ────────────────────────────────────────────────────

const NEXT_STEPS = [
  { n: '1', text: 'Krátká ukázka a rozhovor o vašem provozu.' },
  { n: '2', text: 'Dohoda na rozsahu a podmínkách zavedení.' },
  { n: '3', text: 'Začátek na konkrétní zakázce s vaším týmem.' },
]

function CtaSection({ isDark }: { isDark: boolean }) {
  const [form, setForm] = useState({ jmeno: '', email: '', firma: '', telefon: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const zprava = `ŽÁDOST O UKÁZKU FELUCIA\n\nFirma: ${form.firma}\nTelefon: ${form.telefon || 'neuvedeno'}\n\nMá zájem o 20minutovou ukázku Felucia a probrat zavedení pro svou firmu.`
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
    <section id="ukazka" aria-labelledby="ukazka-heading" style={{ padding: '96px 0', background: bg, borderTop: `1px solid ${isDark ? 'rgba(76,175,80,0.1)' : '#E8F5E9'}` }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, background: isDark ? 'rgba(76,175,80,0.12)' : '#E8F5E9', border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#A5D6A7'}`, color: '#4CAF50', display: 'inline-block', marginBottom: 20 }}>
            ✦ První firmy zavádíme osobně a postupně
          </span>
          <h2 id="ukazka-heading" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: heading, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 16 }}>
            Podívejte se, jak by Felucia<br/>
            <span style={{ color: '#4CAF50' }}>fungovala ve vaší firmě.</span>
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: sub, maxWidth: 540, margin: '0 auto', lineHeight: 1.7 }}>
            Ukážeme vám průchod od nabídky přes práci technika po servis a probereme, jestli Felucia sedí vašemu provozu.
          </p>
        </div>

        {/* Next steps */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 48 }}>
          {NEXT_STEPS.map(s => (
            <div key={s.n} style={{ borderRadius: 16, padding: '20px 22px', background: cardBg, border: `1px solid ${isDark ? 'rgba(76,175,80,0.12)' : '#E0EBE0'}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: isDark ? 'rgba(76,175,80,0.15)' : '#E8F5E9', color: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {s.n}
              </span>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: heading, lineHeight: 1.5, paddingTop: 4 }}>{s.text}</p>
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
                Díky. Ozveme se vám a domluvíme si termín 20minutové ukázky.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: heading, marginBottom: 24 }}>Domluvit 20minutovou ukázku</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, marginBottom: 6 }}>Jméno a příjmení *</label>
                  <input required type="text" placeholder="Jan Novák" value={form.jmeno}
                    onChange={e => setForm(f => ({ ...f, jmeno: e.target.value }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, marginBottom: 6 }}>Název firmy *</label>
                  <input required type="text" placeholder="Vaše s.r.o." value={form.firma}
                    onChange={e => setForm(f => ({ ...f, firma: e.target.value }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, marginBottom: 6 }}>Email *</label>
                  <input required type="email" placeholder="jan@vasefirma.cz" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, marginBottom: 6 }}>Telefon (nepovinně)</label>
                  <input type="tel" placeholder="+420 777 000 000" value={form.telefon}
                    onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} style={inputStyle}/>
                </div>
              </div>
              {status === 'err' && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#ef4444', marginBottom: 12 }}>Chyba při odesílání. Zkuste to prosím znovu, nebo nám napište na info@felucia.io.</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button type="submit" disabled={status === 'sending'}
                  style={{ padding: '13px 32px', borderRadius: 12, background: '#4CAF50', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: status === 'sending' ? 0.7 : 1, boxShadow: '0 4px 16px rgba(76,175,80,0.35)' }}>
                  {status === 'sending' ? 'Odesílám…' : 'Domluvit 20minutovou ukázku →'}
                </button>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: isDark ? '#4A6B4A' : '#6B8F6B' }}>
                  Bez závazků · Osobní rozhovor o vašem provozu
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Direct contact fallback */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', marginTop: 28 }}>
          <a href={`mailto:${CONTACT.email}`} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            {CONTACT.email}
          </a>
          <a href={`tel:${CONTACT.phone}`} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: sub, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            {CONTACT.phoneDisplay}
          </a>
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
              Felucia je software pro řízení montážních a servisních firem — klimatizace, tepelná čerpadla, rekuperace. Od nabídky přes práci technika po servis.
            </p>
          </div>
          {[
            { title: 'Produkt', links: [['#jak-to-funguje','Jak to funguje'],['#funkce','Funkce'],['#ceny','Ceny'],['#faq','FAQ']] },
            { title: 'Účet', links: [['#ukazka','Domluvit ukázku'],['/auth/signin','Přihlásit se']] },
            { title: 'Společnost', links: [['/terms','Podmínky'],['/privacy','Soukromí'],['/support','Podpora']] },
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
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4A6B4A' }}>© 2026 Felucia · Provozuje {OPERATOR.name}, IČO {OPERATOR.ico}, {OPERATOR.city}</p>
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
      <main>
      <Hero isDark={isDark} />
      <Marquee isDark={isDark} />
      <WorkflowSteps isDark={isDark} />
      <DasaSection isDark={isDark} />
      <Pricing isDark={isDark} />
      <FAQ isDark={isDark} />
      <CtaSection isDark={isDark} />
      </main>
      <Footer isDark={isDark} />
    </div>
  )
}
