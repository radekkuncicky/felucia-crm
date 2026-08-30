'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { IconImage, IconBox, IconDocument } from '@/components/ui/Icons'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  initialStep: number
  orgNazev: string
  orgIco: string
  orgDic: string
  orgSidlo: string
  userName: string
  userEmail: string
  userTelefon: string
  existingCategories: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7

const SUGGESTED_CATEGORIES = [
  'Tepelná čerpadla', 'Klimatizace', 'Rekuperace', 'Podlahové vytápění',
  'Vzduchotechnika', 'Ohřev TUV', 'Solární systémy', 'Elektroinstalace',
  'Fotovoltaika', 'Plynové kotle',
]

const PRESET_COLORS = ['#4CAF50', '#1565C0', '#E65100', '#6A1B9A', '#C62828', '#37474F']

// ── Helpers ───────────────────────────────────────────────────────────────────

function LogoLeaf({ dark = false }: { dark?: boolean }) {
  const bg = dark ? '#0A120A' : 'white'
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
      <path d="M20 4C14 4 9 9.5 9 16c0 4 1.5 7.5 4 10l7 10 7-10c2.5-2.5 4-6 4-10 0-6.5-5-12-11-12z" fill="#4CAF50"/>
      <path d="M20 10 C20 10 15 14 15 18 C15 20.5 17.5 22 20 22 C20 22 20 16 20 10Z" fill={bg} opacity="0.8"/>
      <path d="M20 10 C20 10 25 14 25 18 C25 20.5 22.5 22 20 22 C20 22 20 16 20 10Z" fill={bg} opacity="0.5"/>
    </svg>
  )
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

export default function OnboardingWizard({
  initialStep,
  orgNazev,
  orgIco,
  orgDic,
  orgSidlo,
  userName,
  userEmail,
  userTelefon,
  existingCategories,
}: Props) {
  const [isDark, setIsDark] = useState(false)
  const [step, setStep] = useState(Math.max(1, Math.min(initialStep + 1, TOTAL_STEPS)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track completed steps for finish screen
  const [completed, setCompleted] = useState<Record<number, boolean>>({})

  // Step 1 — Company
  const [ico, setIco] = useState(orgIco)
  const [nazev, setNazev] = useState(orgNazev)
  const [dic, setDic] = useState(orgDic)
  const [sidlo, setSidlo] = useState(orgSidlo)
  const [mesto, setMesto] = useState('')
  const [psc, setPsc] = useState('')
  const [aresLoading, setAresLoading] = useState(false)

  // Step 2 — Profile
  const [jmeno, setJmeno] = useState(userName)
  const [telefon, setTelefon] = useState(userTelefon)

  // Step 3 — Categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>(existingCategories.filter(c => c !== 'Obecné'))
  const [customCategory, setCustomCategory] = useState('')

  // Step 4 — Branding
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#4CAF50')
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Step 5 — Template mode
  const [singleTemplate, setSingleTemplate] = useState(true)

  // Step 6 — Invites
  const [inviteEmails, setInviteEmails] = useState(['', ''])
  const [invitesSentCount, setInvitesSentCount] = useState(0)

  // Step 7 — Import
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{ count: number; categories: number; categoryNames: string[] } | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone] = useState(false)

  // Finish screen data
  const [finishData, setFinishData] = useState({ firmaNazev: orgNazev, userName, categoryCount: selectedCategories.length, logoLoaded: false, invitesSent: 0, productsImported: false })

  useEffect(() => {
    const check = () => setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    check()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', check)
    return () => mq.removeEventListener('change', check)
  }, [])

  // ── ARES lookup ──────────────────────────────────────────────────────────────
  async function loadFromAres() {
    if (ico.length !== 8) { setError('IČO musí mít 8 číslic'); return }
    setAresLoading(true)
    setError(null)
    try {
      const ctrl = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), 5000)
      const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, { signal: ctrl.signal })
      clearTimeout(timeout)
      if (!res.ok) { setError('IČO nenalezeno v ARES'); return }
      const data = await res.json()
      setNazev(data.obchodniJmeno ?? nazev)
      setDic(data.dic ?? '')
      const s = data.sidlo
      if (s) {
        const parts = [s.nazevUlice, s.cisloDomovni ? `${s.cisloDomovni}${s.cisloOrientacni ? '/' + s.cisloOrientacni : ''}` : ''].filter(Boolean)
        setSidlo(parts.join(' '))
        setMesto(s.nazevObce ?? '')
        setPsc(String(s.psc ?? ''))
      }
    } catch {
      setError('Nepodařilo se načíst data z ARES. Vyplňte prosím ručně.')
    } finally {
      setAresLoading(false)
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  function markCompleted(s: number) {
    setCompleted(prev => ({ ...prev, [s]: true }))
  }

  async function goNext(skipApi = false) {
    setError(null)
    if (!skipApi) {
      setSaving(true)
      try {
        await saveCurrentStep()
        markCompleted(step)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chyba při ukládání')
        setSaving(false)
        return
      } finally {
        setSaving(false)
      }
    } else {
      // Save step to DB even when skipping so wizard resumes at correct position
      const nextStep = step >= TOTAL_STEPS ? TOTAL_STEPS : step
      fetch('/api/onboarding/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextStep }),
      }).catch(() => {})
    }
    if (step >= TOTAL_STEPS) {
      await handleComplete()
    } else {
      setStep(s => s + 1)
    }
  }

  async function handleComplete() {
    setSaving(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' })
      setFinishData({
        firmaNazev: nazev || orgNazev,
        userName: jmeno || userName,
        categoryCount: selectedCategories.length,
        logoLoaded: !!logoPreview,
        invitesSent: invitesSentCount,
        productsImported: importDone,
      })
      setStep(8) // finish screen
    } finally {
      setSaving(false)
    }
  }

  async function saveCurrentStep() {
    switch (step) {
      case 1: {
        if (!nazev.trim()) throw new Error('Název firmy je povinný')
        const fullSidlo = [sidlo, mesto, psc].filter(Boolean).join(', ')
        const res = await fetch('/api/onboarding/company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nazev, ico, dic, sidlo: fullSidlo }),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
        break
      }
      case 2: {
        if (!jmeno.trim()) throw new Error('Jméno je povinné')
        if (!telefon.trim()) throw new Error('Telefon je povinný')
        const res = await fetch('/api/onboarding/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jmeno, telefon }),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
        break
      }
      case 3: {
        const res = await fetch('/api/onboarding/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: selectedCategories }),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
        break
      }
      case 4: {
        const fd = new FormData()
        fd.append('primaryColor', primaryColor)
        if (logoFile) fd.append('logo', logoFile)
        const res = await fetch('/api/onboarding/branding', { method: 'POST', body: fd })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
        break
      }
      case 5: {
        const res = await fetch('/api/onboarding/template-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ singleTemplate }),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
        break
      }
      case 6: {
        const emails = inviteEmails.filter(e => e.trim())
        if (emails.length > 0) {
          const res = await fetch('/api/onboarding/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails }),
          })
          const j = await res.json()
          if (!res.ok) throw new Error(j.error)

          const sent: string[] = j.sent ?? []
          const skipped: { email: string; reason: string }[] = j.skipped ?? []
          setInvitesSentCount(c => c + sent.length)

          if (skipped.length > 0) {
            // V polích nechat jen neúspěšné adresy, ať opakované „Odeslat" neposílá
            // znovu ty, které prošly. Vyhozená chyba drží wizard na tomto kroku,
            // aby hlášku nepřebil přechod na další krok — dál se dá jít tlačítkem
            // „Přeskočit".
            setInviteEmails(skipped.map(s => s.email))
            throw new Error(
              `Nepodařilo se pozvat: ${skipped.map(s => `${s.email} (${s.reason})`).join(', ')}`
              + (j.planLimitReached
                ? '. Pro více kolegů povyšte plán v Nastavení → Předplatné, nebo pokračujte a pozvěte je později.'
                : '')
            )
          }
        }
        break
      }
      case 7: break // handled separately
    }
  }

  // ── Logo upload ──────────────────────────────────────────────────────────────
  function handleLogoSelect(file: File) {
    if (file.size > 2 * 1024 * 1024) { setError('Logo je příliš velké (max 2MB)'); return }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = e => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Import ───────────────────────────────────────────────────────────────────
  async function handleImportPreview(file: File) {
    setImportFile(file)
    setImportLoading(true)
    setImportPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('action', 'preview')
      const res = await fetch('/api/onboarding/import', { method: 'POST', body: fd })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      const data = await res.json()
      setImportPreview(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při čtení souboru')
    } finally {
      setImportLoading(false)
    }
  }

  async function handleImportConfirm() {
    if (!importFile) return
    setImportLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('action', 'import')
      const res = await fetch('/api/onboarding/import', { method: 'POST', body: fd })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      setImportDone(true)
      markCompleted(7)
      await handleComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při importu')
    } finally {
      setImportLoading(false)
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const bg = isDark ? '#0A120A' : '#F4FAF4'
  const cardBg = isDark ? '#0D1A0E' : '#ffffff'
  const border = isDark ? 'rgba(76,175,80,0.18)' : '#C8E6C9'
  const textMain = isDark ? '#E8F5E9' : '#1A2E1B'
  const textMuted = isDark ? '#6B8F6B' : '#4A6B4A'
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: `1px solid ${border}`,
    background: isDark ? 'rgba(76,175,80,0.04)' : '#F4FAF4',
    color: textMain, fontFamily: 'Inter, sans-serif', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '14px 0', borderRadius: 12, background: '#4CAF50',
    color: 'white', fontFamily: 'Inter, sans-serif', fontSize: 15,
    fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
    width: '100%', opacity: saving ? 0.7 : 1, transition: 'opacity 0.2s',
  }
  const btnSkip: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: textMuted, fontFamily: 'Inter, sans-serif', fontSize: 13,
    padding: '8px 0', alignSelf: 'center',
  }

  // ── Finish screen ─────────────────────────────────────────────────────────────
  if (step === 8) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <div style={{ background: cardBg, borderRadius: 20, border: `1px solid ${border}`, padding: '40px 36px', textAlign: 'center' }}>
            {/* Animated checkmark */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="rgba(76,175,80,0.12)" stroke="#4CAF50" strokeWidth="3"/>
                <path d="M24 40 L35 51 L56 29" stroke="#4CAF50" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <animate attributeName="stroke-dasharray" from="0 60" to="60 0" dur="0.5s" fill="freeze"/>
                </path>
              </svg>
            </div>

            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: textMain, margin: '0 0 8px' }}>
              Vítejte ve Felucia CRM!
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: textMuted, marginBottom: 32 }}>
              Vše je připraveno. Pojďme na to.
            </p>

            {/* Checklist */}
            <div style={{ textAlign: 'left', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: `Firma: ${finishData.firmaNazev}`, done: true },
                { label: `Profil: ${finishData.userName}`, done: !!completed[2] },
                { label: `Kategorie: ${finishData.categoryCount} kategorií`, done: !!completed[3] },
                { label: 'Logo a barvy', done: finishData.logoLoaded || !!completed[4] },
                { label: 'Kolegové', done: finishData.invitesSent > 0 },
                { label: 'Produkty', done: finishData.productsImported },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, color: item.done ? '#4CAF50' : '#9E9E9E', flexShrink: 0 }}>
                    {item.done ? '✓' : '○'}
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: item.done ? textMain : textMuted }}>
                    {item.label}
                    {!item.done && item.label === 'Produkty' && (
                      <Link href="/settings/import-products" style={{ color: '#4CAF50', marginLeft: 8, fontSize: 13 }}>
                        Přidat produkty →
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <Link href="/dashboard">
              <button
                style={{ ...btnPrimary, fontSize: 16, padding: '16px 0' }}
                onClick={() => {}}
              >
                Jít na nástěnku →
              </button>
            </Link>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button
                onClick={() => setStep(1)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 0' }}
              >
                ← Upravit nastavení
              </button>
              <Link href="/settings" style={{ color: textMuted, fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 0', textDecoration: 'none' }}>
                Přejít do nastavení
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Progress bar & header ─────────────────────────────────────────────────────
  const progress = ((step - 1) / TOTAL_STEPS) * 100

  const STEP_LABELS = ['Firma', 'Profil', 'Kategorie', 'Logo & Barvy', 'Šablony', 'Tým', 'Import']

  return (
    <div style={{ minHeight: '100vh', background: bg }}>
      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 4, background: isDark ? 'rgba(76,175,80,0.15)' : '#C8E6C9' }}>
        <div style={{ height: '100%', background: '#4CAF50', width: `${progress}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px 48px', paddingTop: 52 }}>
        <div style={{ width: '100%', maxWidth: 560 }}>

          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogoLeaf dark={isDark} />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: textMain }}>felucia</span>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
            {STEP_LABELS.map((label, i) => {
              const idx = i + 1
              const done = idx < step
              const active = idx === step
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                    background: done ? '#4CAF50' : active ? 'rgba(76,175,80,0.15)' : 'transparent',
                    color: done ? 'white' : active ? '#4CAF50' : textMuted,
                    border: active ? '2px solid #4CAF50' : done ? 'none' : `1px solid ${border}`,
                    flexShrink: 0,
                  }}>
                    {done ? '✓' : idx}
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: active ? textMain : textMuted, display: 'none' }}
                    className="sm:block hidden">
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{ width: 20, height: 1, background: done ? '#4CAF50' : border, marginLeft: 2 }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Card */}
          <div style={{ background: cardBg, borderRadius: 20, border: `1px solid ${border}`, padding: '36px 32px', boxShadow: isDark ? 'none' : '0 2px 20px rgba(0,0,0,0.06)' }}>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#ef4444', marginBottom: 20 }}>
                {error}
              </div>
            )}

            {/* ── KROK 1 — Firma ─────────────────────────────────────────────── */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>Řekněte nám o vaší firmě</h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: textMuted, margin: 0 }}>Tyto údaje se zobrazí v cenových nabídkách</p>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>IČO *</label>
                    <input value={ico} onChange={e => setIco(e.target.value.replace(/\D/g, '').slice(0, 8))} style={inputStyle} placeholder="12345678" maxLength={8} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button" onClick={loadFromAres} disabled={aresLoading || ico.length !== 8}
                      style={{ padding: '11px 16px', borderRadius: 10, border: `1px solid ${border}`, background: 'none', color: '#4CAF50', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, cursor: ico.length !== 8 ? 'not-allowed' : 'pointer', opacity: ico.length !== 8 ? 0.5 : 1, whiteSpace: 'nowrap' }}
                    >
                      {aresLoading ? 'Načítám…' : 'Načíst z ARES'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>Název firmy *</label>
                  <input value={nazev} onChange={e => setNazev(e.target.value)} style={inputStyle} placeholder="ACME s.r.o." />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>DIČ</label>
                  <input value={dic} onChange={e => setDic(e.target.value)} style={inputStyle} placeholder="CZ12345678 (volitelné)" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>Adresa sídla *</label>
                  <input value={sidlo} onChange={e => setSidlo(e.target.value)} style={inputStyle} placeholder="Ulice 123" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>Město *</label>
                    <input value={mesto} onChange={e => setMesto(e.target.value)} style={inputStyle} placeholder="Praha" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>PSČ *</label>
                    <input value={psc} onChange={e => setPsc(e.target.value.replace(/\D/g, '').slice(0, 5))} style={{ ...inputStyle, width: 90 }} placeholder="11000" />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <button style={btnPrimary} onClick={() => goNext()} disabled={saving}>
                    {saving ? 'Ukládám…' : 'Pokračovat →'}
                  </button>
                  <button style={btnSkip} onClick={() => goNext(true)}>Přeskočit</button>
                </div>
              </div>
            )}

            {/* ── KROK 2 — Profil ────────────────────────────────────────────── */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>Jak vás budou klienti znát</h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: textMuted, margin: 0 }}>Tyto údaje se zobrazí v cenových nabídkách</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>Jméno a příjmení *</label>
                  <input value={jmeno} onChange={e => setJmeno(e.target.value)} style={inputStyle} placeholder="Jan Novák" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>Telefon *</label>
                  <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} style={inputStyle} placeholder="+420 601 234 567" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 5 }}>Email</label>
                  <input value={userEmail} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <button style={btnPrimary} onClick={() => goNext()} disabled={saving}>
                    {saving ? 'Ukládám…' : 'Pokračovat →'}
                  </button>
                  <button style={btnSkip} onClick={() => goNext(true)}>Přeskočit</button>
                </div>
              </div>
            )}

            {/* ── KROK 3 — Kategorie ─────────────────────────────────────────── */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>S čím pracujete?</h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: textMuted, margin: 0 }}>Vytvořte kategorie pro vaše zakázky a produkty</p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SUGGESTED_CATEGORIES.map(cat => {
                    const sel = selectedCategories.includes(cat)
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategories(prev => sel ? prev.filter(c => c !== cat) : [...prev, cat])}
                        style={{
                          padding: '7px 14px', borderRadius: 20, fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500,
                          background: sel ? '#4CAF50' : 'transparent',
                          color: sel ? 'white' : textMuted,
                          border: `1.5px solid ${sel ? '#4CAF50' : border}`,
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {sel ? '✓ ' : ''}{cat}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customCategory.trim()) { setSelectedCategories(prev => [...prev, customCategory.trim()]); setCustomCategory('') } }}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Přidat vlastní kategorii…"
                  />
                  <button
                    type="button"
                    onClick={() => { if (customCategory.trim()) { setSelectedCategories(prev => [...prev, customCategory.trim()]); setCustomCategory('') } }}
                    style={{ padding: '11px 16px', borderRadius: 10, border: 'none', background: '#4CAF50', color: 'white', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}
                  >+</button>
                </div>

                {selectedCategories.length > 0 && (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: textMuted }}>Vybrané: {selectedCategories.join(', ')}</p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <button style={btnPrimary} onClick={() => goNext()} disabled={saving}>
                    {saving ? 'Ukládám…' : `Pokračovat (${selectedCategories.length} kategorií) →`}
                  </button>
                  <button style={btnSkip} onClick={() => goNext(true)}>Přeskočit</button>
                </div>
              </div>
            )}

            {/* ── KROK 4 — Branding ──────────────────────────────────────────── */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>Jak bude vypadat vaše nabídka</h2>
                </div>

                {/* Logo */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 8 }}>Logo firmy</label>
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoSelect(f) }}
                    style={{
                      border: `2px dashed ${border}`, borderRadius: 12, padding: '24px 16px',
                      textAlign: 'center', cursor: 'pointer', background: isDark ? 'rgba(76,175,80,0.03)' : '#FAFEF9',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {logoPreview ? (
                      <div>
                        <img src={logoPreview} style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }} alt="logo preview" />
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4CAF50', marginTop: 8 }}>✓ Logo nahráno · klikněte pro změnu</p>
                      </div>
                    ) : (
                      <div>
                        <IconImage className="" style={{ width: 28, height: 28, margin: '0 auto 8px', color: '#4CAF50' }} />
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted, margin: 0 }}>
                          Přetáhněte logo sem nebo <span style={{ color: '#4CAF50', fontWeight: 600 }}>klikněte pro výběr</span>
                        </p>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: textMuted, margin: '4px 0 0' }}>PNG, JPG, SVG · max 2MB</p>
                      </div>
                    )}
                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoSelect(f) }} />
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'Inter, sans-serif', color: textMuted, marginBottom: 8 }}>Primární barva</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c} type="button" onClick={() => setPrimaryColor(c)}
                        style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: primaryColor === c ? '3px solid white' : 'none', outline: primaryColor === c ? `3px solid ${c}` : 'none', cursor: 'pointer', boxShadow: primaryColor === c ? '0 0 0 1px ' + c : 'none' }}
                      />
                    ))}
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${border}`, padding: 2, cursor: 'pointer', background: 'none' }} />
                  </div>

                  {/* Live preview */}
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}` }}>
                    <div style={{ background: primaryColor, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {logoPreview
                        ? <img src={logoPreview} style={{ height: 24, maxWidth: 80, objectFit: 'contain' }} alt="logo" />
                        : <span style={{ color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>{nazev || 'Vaše firma s.r.o.'}</span>
                      }
                      <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
                        <div style={{ fontWeight: 700 }}>NAB-26-0001</div>
                        <div>1. 1. 2026</div>
                      </div>
                    </div>
                    <div style={{ padding: '10px 14px', background: isDark ? '#111' : '#fff' }}>
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 3, marginBottom: 6, width: '75%' }} />
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 3, width: '55%' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <button style={btnPrimary} onClick={() => goNext()} disabled={saving}>
                    {saving ? 'Ukládám…' : 'Pokračovat →'}
                  </button>
                  <button style={btnSkip} onClick={() => goNext(true)}>Přeskočit</button>
                </div>
              </div>
            )}

            {/* ── KROK 5 — Šablony ───────────────────────────────────────────── */}
            {step === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>Jak chcete generovat nabídky?</h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: textMuted, margin: 0 }}>Můžete změnit kdykoliv v nastavení</p>
                </div>

                {[
                  { value: true, label: 'Jedna šablona pro vše', desc: 'Všechny zakázky používají stejný design nabídky' },
                  { value: false, label: 'Podle technologie', desc: 'Každá kategorie může mít vlastní šablonu nabídky' },
                ].map(opt => (
                  <div
                    key={String(opt.value)}
                    onClick={() => setSingleTemplate(opt.value)}
                    style={{
                      padding: '18px 20px', borderRadius: 14, border: `2px solid ${singleTemplate === opt.value ? '#4CAF50' : border}`,
                      background: singleTemplate === opt.value ? (isDark ? 'rgba(76,175,80,0.08)' : 'rgba(76,175,80,0.04)') : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', border: `2px solid ${singleTemplate === opt.value ? '#4CAF50' : textMuted}`,
                        background: singleTemplate === opt.value ? '#4CAF50' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {singleTemplate === opt.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, color: textMain }}>{opt.label}</div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted, marginTop: 2 }}>{opt.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <button style={btnPrimary} onClick={() => goNext()} disabled={saving}>
                    {saving ? 'Ukládám…' : 'Pokračovat →'}
                  </button>
                  <button style={{ ...btnSkip, fontSize: 14 }} onClick={() => goNext(true)}>Přeskočit nastavení šablon</button>
                </div>
              </div>
            )}

            {/* ── KROK 6 — Pozvánky ──────────────────────────────────────────── */}
            {step === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>Přidejte svůj tým</h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: textMuted, margin: 0 }}>Pošlete pozvánky kolegům (volitelné)</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {inviteEmails.map((email, i) => (
                    <input
                      key={i}
                      type="email"
                      value={email}
                      onChange={e => setInviteEmails(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                      style={inputStyle}
                      placeholder={`email@kolega${i + 1}.cz`}
                    />
                  ))}
                  {inviteEmails.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setInviteEmails(prev => [...prev, ''])}
                      style={{ ...btnSkip, padding: '4px 0', textAlign: 'left', fontSize: 13 }}
                    >
                      + Přidat dalšího
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <button style={btnPrimary} onClick={() => goNext()} disabled={saving}>
                    {saving ? 'Odesílám…' : inviteEmails.filter(e => e.trim()).length > 0 ? `Odeslat ${inviteEmails.filter(e => e.trim()).length} pozvánku/ek →` : 'Pokračovat →'}
                  </button>
                  <button style={{ ...btnSkip, fontSize: 14 }} onClick={() => goNext(true)}>Přeskočit — pozvu kolegy později</button>
                </div>
              </div>
            )}

            {/* ── KROK 7 — Import ────────────────────────────────────────────── */}
            {step === 7 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>Nahrajte katalog produktů</h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: textMuted, margin: 0 }}>Importujte z Excelu nebo přidejte produkty ručně</p>
                </div>

                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImportPreview(f) }}
                  onClick={() => document.getElementById('import-file-input')?.click()}
                  style={{
                    border: `2px dashed ${importFile ? '#4CAF50' : border}`, borderRadius: 14, padding: '32px 20px',
                    textAlign: 'center', cursor: 'pointer', background: isDark ? 'rgba(76,175,80,0.03)' : '#FAFEF9',
                  }}
                >
                  {importLoading ? (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: textMuted }}>Analyzuji soubor…</p>
                  ) : importPreview ? (
                    <div>
                      <IconBox className="" style={{ width: 32, height: 32, margin: '0 auto 8px', color: '#4CAF50' }} />
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600, color: textMain, margin: '0 0 4px' }}>
                        Nalezeno {importPreview.count} produktů v {importPreview.categories} kategoriích
                      </p>
                      {importPreview.categoryNames.length > 0 && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: textMuted }}>
                          {importPreview.categoryNames.join(', ')}{importPreview.categories > 5 ? '…' : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <IconDocument className="" style={{ width: 32, height: 32, margin: '0 auto 8px', color: '#4CAF50' }} />
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: textMuted, margin: 0 }}>
                        Přetáhněte Excel soubor sem nebo <span style={{ color: '#4CAF50', fontWeight: 600 }}>klikněte pro výběr</span>
                      </p>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: textMuted, marginTop: 6 }}>
                        Sloupce: Název, Kód, Kategorie, Jednotka, Cena, DPH
                      </p>
                    </div>
                  )}
                  <input id="import-file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImportPreview(f) }} />
                </div>

                <div style={{ background: isDark ? 'rgba(76,175,80,0.06)' : '#F0F8F0', borderRadius: 10, padding: '12px 16px' }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: textMuted, margin: 0 }}>
                    ℹ Bez produktů nemůžete sestavit cenovou nabídku. Produkty lze přidat i ručně nebo importovat kdykoliv později.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {importPreview && !importDone && (
                    <button
                      style={{ ...btnPrimary, background: '#4CAF50' }}
                      onClick={handleImportConfirm}
                      disabled={importLoading}
                    >
                      {importLoading ? 'Importuji…' : `Importovat ${importPreview.count} produktů →`}
                    </button>
                  )}
                  <button
                    style={{ ...btnSkip, fontSize: 14, padding: '10px 0', border: `1px solid ${border}`, borderRadius: 12, textAlign: 'center' }}
                    onClick={() => goNext(true)}
                  >
                    Přeskočit — přidám produkty ručně
                  </button>
                </div>
              </div>
            )}

          </div>

          <p style={{ textAlign: 'center', marginTop: 16, fontFamily: 'Inter, sans-serif', fontSize: 12, color: textMuted }}>
            Krok {step} z {TOTAL_STEPS} · Vše lze změnit v nastavení
          </p>
        </div>
      </div>
    </div>
  )
}
