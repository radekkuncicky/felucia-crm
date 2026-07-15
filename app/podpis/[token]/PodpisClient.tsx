'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SignatureCanvas } from '@/components/SignatureCanvas'

interface OrgInfo {
  nazev: string
  logo: string | null
  primaryColor: string
  kontaktJmeno: string | null
  kontaktTelefon: string | null
  kontaktEmail: string | null
}

interface Stav {
  faze: 'OVERENI' | 'SMLOUVA' | 'PODEPSANO' | 'NEPLATNY'
  org?: OrgInfo
  cislo?: string
  klientJmeno?: string
  maskTelefon?: string
  otpZamceno?: boolean
  contractHtml?: string
  podepsano?: string
  pdfDostupne?: boolean
}

const FALLBACK_COLOR = '#16a34a'

export default function PodpisClient({ token }: { token: string }) {
  const [stav, setStav] = useState<Stav | null>(null)
  const [nacitam, setNacitam] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/podpis/${token}`)
      const data = await res.json()
      setStav(data)
    } catch {
      setStav({ faze: 'NEPLATNY' })
    } finally {
      setNacitam(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  if (nacitam || !stav) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin mb-4" />
          Načítám smlouvu…
        </div>
      </Shell>
    )
  }

  const color = stav.org?.primaryColor || FALLBACK_COLOR

  return (
    <Shell org={stav.org}>
      {stav.faze === 'NEPLATNY' && <NeplatnyScreen org={stav.org} />}
      {stav.faze === 'PODEPSANO' && (
        <HotovoScreen color={color} cislo={stav.cislo} uzDrive pdfUrl={stav.pdfDostupne ? `/api/public/podpis/${token}/pdf` : undefined} />
      )}
      {stav.faze === 'OVERENI' && (
        <OvereniScreen token={token} stav={stav} color={color} onOvereno={load} />
      )}
      {stav.faze === 'SMLOUVA' && (
        <SmlouvaScreen token={token} stav={stav} color={color} onPodepsano={load} />
      )}
    </Shell>
  )
}

// ── Layout ───────────────────────────────────────────────────────────────────

function Shell({ org, children }: { org?: OrgInfo; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 flex flex-col">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center gap-3">
          {org?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt="" className="h-8 max-w-[130px] object-contain" />
          ) : null}
          <span className="font-semibold text-gray-900 dark:text-white text-[15px]">
            {org?.nazev ?? 'Podpis smlouvy'}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-slate-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Zabezpečený podpis
          </span>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 flex flex-col">{children}</main>
      <footer className="py-4 text-center text-[11px] text-gray-400 dark:text-slate-600">
        Elektronický podpis · Felucia
      </footer>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 w-full max-w-md mx-auto">
      {children}
    </div>
  )
}

// ── Neplatný odkaz ───────────────────────────────────────────────────────────

function NeplatnyScreen({ org }: { org?: OrgInfo }) {
  return (
    <div className="my-auto">
      <Card>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Odkaz už není platný</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            Platnost odkazu vypršela, nebo byl nahrazen novějším. Požádejte prosím o nové zaslání smlouvy.
          </p>
          {(org?.kontaktTelefon || org?.kontaktEmail) && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-3">
              {org.kontaktTelefon && <>Zavolejte: <a href={`tel:${org.kontaktTelefon}`} className="font-medium text-gray-800 dark:text-slate-200">{org.kontaktTelefon}</a></>}
              {org.kontaktTelefon && org.kontaktEmail && <br />}
              {org.kontaktEmail && <>Napište: <a href={`mailto:${org.kontaktEmail}`} className="font-medium text-gray-800 dark:text-slate-200">{org.kontaktEmail}</a></>}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

// ── Krok 1: Ověření SMS kódem ────────────────────────────────────────────────

function OvereniScreen({ token, stav, color, onOvereno }: {
  token: string; stav: Stav; color: string; onOvereno: () => void
}) {
  const [odeslano, setOdeslano] = useState(false)
  const [odesilam, setOdesilam] = useState(false)
  const [kod, setKod] = useState('')
  const [overuji, setOveruji] = useState(false)
  const [chyba, setChyba] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function poslatKod() {
    setOdesilam(true)
    setChyba(null)
    try {
      const res = await fetch(`/api/public/podpis/${token}/otp`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setChyba(data.error ?? 'Kód se nepodařilo odeslat'); return }
      setOdeslano(true)
      setCooldown(60)
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch {
      setChyba('Kód se nepodařilo odeslat, zkuste to znovu')
    } finally {
      setOdesilam(false)
    }
  }

  async function overit(hodnota: string) {
    if (!/^\d{6}$/.test(hodnota)) return
    setOveruji(true)
    setChyba(null)
    try {
      const res = await fetch(`/api/public/podpis/${token}/overit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kod: hodnota }),
      })
      const data = await res.json()
      if (!res.ok) { setChyba(data.error ?? 'Nesprávný kód'); setKod(''); return }
      onOvereno()
    } catch {
      setChyba('Ověření se nepodařilo, zkuste to znovu')
    } finally {
      setOveruji(false)
    }
  }

  return (
    <div className="my-auto">
      <Card>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${color}1a` }}>
            <svg className="w-6 h-6" style={{ color }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Smlouva č. {stav.cislo}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            pro <strong className="text-gray-700 dark:text-slate-300">{stav.klientJmeno}</strong>
          </p>
        </div>

        {!odeslano ? (
          <>
            <p className="text-sm text-gray-600 dark:text-slate-400 text-center leading-relaxed mb-5">
              Pro zobrazení smlouvy nejdřív ověříme, že jste to vy.
              Na číslo <strong className="text-gray-900 dark:text-white whitespace-nowrap">{stav.maskTelefon}</strong> vám
              pošleme šestimístný kód.
            </p>
            <button
              onClick={poslatKod}
              disabled={odesilam}
              className="w-full rounded-xl text-white font-semibold text-[15px] py-3.5 transition-opacity disabled:opacity-60"
              style={{ background: color }}
            >
              {odesilam ? 'Odesílám…' : 'Poslat ověřovací kód'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-slate-400 text-center leading-relaxed mb-4">
              Kód jsme poslali na <strong className="text-gray-900 dark:text-white whitespace-nowrap">{stav.maskTelefon}</strong>.
            </p>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={kod}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '')
                setKod(v)
                if (v.length === 6) overit(v)
              }}
              placeholder="······"
              className="w-full text-center text-3xl font-mono font-bold tracking-[0.5em] rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white py-3 focus:outline-none focus:border-current"
              style={{ caretColor: color }}
            />
            <button
              onClick={() => overit(kod)}
              disabled={overuji || kod.length !== 6}
              className="w-full rounded-xl text-white font-semibold text-[15px] py-3.5 mt-4 transition-opacity disabled:opacity-40"
              style={{ background: color }}
            >
              {overuji ? 'Ověřuji…' : 'Ověřit kód'}
            </button>
            <button
              onClick={poslatKod}
              disabled={cooldown > 0 || odesilam}
              className="w-full text-center text-sm text-gray-500 dark:text-slate-400 mt-3 disabled:opacity-50 hover:underline"
            >
              {cooldown > 0 ? `Poslat nový kód (${cooldown} s)` : 'Poslat nový kód'}
            </button>
          </>
        )}

        {chyba && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center mt-4 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {chyba}
          </p>
        )}
      </Card>
      <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-4 max-w-md mx-auto">
        Nesedí telefonní číslo? Kontaktujte odesílatele smlouvy — pošle vám nový odkaz.
      </p>
    </div>
  )
}

// ── Krok 2: Smlouva + podpis ─────────────────────────────────────────────────

function SmlouvaScreen({ token, stav, color, onPodepsano }: {
  token: string; stav: Stav; color: string; onPodepsano: () => void
}) {
  const [podpisOpen, setPodpisOpen] = useState(false)
  const [hotovo, setHotovo] = useState(false)

  if (hotovo) return <HotovoScreen color={color} cislo={stav.cislo} pdfUrl={`/api/public/podpis/${token}/pdf`} />

  return (
    <div className="flex flex-col flex-1 -mx-4 sm:mx-0">
      <div className="flex items-center gap-2 px-4 sm:px-0 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${color}1a`, color }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Totožnost ověřena
        </span>
        <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 ml-auto">Smlouva č. {stav.cislo}</span>
      </div>

      <div className="flex-1 bg-white sm:rounded-xl border-y sm:border border-gray-200 dark:border-slate-700 overflow-hidden min-h-[55vh]">
        <iframe
          srcDoc={stav.contractHtml}
          sandbox=""
          title={`Smlouva č. ${stav.cislo}`}
          className="w-full h-full min-h-[55vh] bg-white"
        />
      </div>

      {/* Sticky lišta s akcí */}
      <div className="sticky bottom-0 mt-3 px-4 sm:px-0 pb-4 pt-2 bg-gradient-to-t from-gray-100 dark:from-slate-900 via-gray-100/90 dark:via-slate-900/90 to-transparent">
        <button
          onClick={() => setPodpisOpen(true)}
          className="w-full rounded-xl text-white font-semibold text-base py-4 shadow-lg transition-transform active:scale-[0.99]"
          style={{ background: color }}
        >
          Přečetl(a) jsem a chci podepsat
        </button>
        {(stav.org?.kontaktTelefon || stav.org?.kontaktEmail) && (
          <p className="text-center text-xs text-gray-500 dark:text-slate-400 mt-2.5">
            Máte dotaz nebo výhradu?{' '}
            {stav.org.kontaktTelefon && (
              <a href={`tel:${stav.org.kontaktTelefon}`} className="font-semibold underline">
                {stav.org.kontaktJmeno ? `${stav.org.kontaktJmeno}: ` : ''}{stav.org.kontaktTelefon}
              </a>
            )}
            {stav.org.kontaktTelefon && stav.org.kontaktEmail && ' · '}
            {stav.org.kontaktEmail && <a href={`mailto:${stav.org.kontaktEmail}`} className="font-semibold underline">{stav.org.kontaktEmail}</a>}
          </p>
        )}
      </div>

      {podpisOpen && (
        <PodpisModal
          token={token}
          color={color}
          klientJmeno={stav.klientJmeno ?? ''}
          onClose={() => setPodpisOpen(false)}
          onSuccess={() => { setHotovo(true); onPodepsano() }}
        />
      )}
    </div>
  )
}

function PodpisModal({ token, color, klientJmeno, onClose, onSuccess }: {
  token: string; color: string; klientJmeno: string; onClose: () => void; onSuccess: () => void
}) {
  const [jmeno, setJmeno] = useState(klientJmeno)
  const [podpis, setPodpis] = useState<string | null>(null)
  const [souhlas, setSouhlas] = useState(false)
  const [odesilam, setOdesilam] = useState(false)
  const [chyba, setChyba] = useState<string | null>(null)

  async function podepsat() {
    setOdesilam(true)
    setChyba(null)
    try {
      const res = await fetch(`/api/public/podpis/${token}/podepsat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podpisSvg: podpis, jmeno: jmeno.trim(), souhlas }),
      })
      const data = await res.json()
      if (!res.ok) { setChyba(data.error ?? 'Podpis se nepodařilo odeslat'); return }
      onSuccess()
    } catch {
      setChyba('Podpis se nepodařilo odeslat, zkuste to znovu')
    } finally {
      setOdesilam(false)
    }
  }

  const canSubmit = !!podpis && souhlas && jmeno.trim().length > 1 && !odesilam

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Podpis smlouvy</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1" aria-label="Zavřít">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Jméno a příjmení</label>
        <input
          type="text"
          value={jmeno}
          onChange={e => setJmeno(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-current"
        />

        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Podpis prstem nebo myší</p>
        <SignatureCanvas onChange={setPodpis} />

        <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={souhlas}
            onChange={e => setSouhlas(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-current"
            style={{ accentColor: color }}
          />
          <span className="text-[13px] text-gray-600 dark:text-slate-400 leading-relaxed">
            Prohlašuji, že jsem si smlouvu přečetl(a), jejímu obsahu rozumím a souhlasím s ním.
            Tento elektronický podpis považuji za závazný.
          </span>
        </label>

        {chyba && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-3 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{chyba}</p>
        )}

        <button
          onClick={podepsat}
          disabled={!canSubmit}
          className="w-full rounded-xl text-white font-semibold text-[15px] py-3.5 mt-5 transition-opacity disabled:opacity-40"
          style={{ background: color }}
        >
          {odesilam ? 'Podepisuji…' : 'Závazně podepsat smlouvu'}
        </button>
      </div>
    </div>
  )
}

// ── Hotovo ───────────────────────────────────────────────────────────────────

function HotovoScreen({ color, cislo, uzDrive, pdfUrl }: {
  color: string; cislo?: string; uzDrive?: boolean; pdfUrl?: string
}) {
  return (
    <div className="my-auto">
      <Card>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${color}1a` }}>
            <svg className="w-7 h-7" style={{ color }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {uzDrive ? 'Smlouva už je podepsaná' : 'Hotovo — smlouva podepsána'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            {cislo && <>Smlouva <strong className="text-gray-700 dark:text-slate-300">č. {cislo}</strong>{' '}</>}
            byla úspěšně elektronicky podepsána.
            {!uzDrive && <> Podepsané vyhotovení vám během chvíle přijde i e-mailem.</>}
          </p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              className="inline-flex items-center gap-2 rounded-xl text-white font-semibold text-sm px-5 py-3 mt-5 transition-opacity hover:opacity-90"
              style={{ background: color }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Stáhnout podepsané PDF
            </a>
          )}
        </div>
      </Card>
    </div>
  )
}
