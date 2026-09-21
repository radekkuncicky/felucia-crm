'use client'

import { useState, useEffect } from 'react'
import { formatDate } from '@/lib/format'
import {
  KONTROLNI_KONTAKT_CIL, KONTROLNI_KONTAKT_DNI, zaPracovnichDni, toDateInputValue,
  kontrolniKontaktPopis, type KontrolniKontaktTyp,
} from '@/lib/kontrolniKontakt'

interface ShareState {
  url: string
  expiresAt: string
}

interface Props {
  quoteId: string
  quoteKod: string | null
  quoteNazev: string
  clientEmail: string | null
  /** OP, na které se po odeslání naplánuje kontrolní kontakt */
  dealId: string
  onClose: () => void
}

export default function ShareQuoteModal({ quoteId, quoteKod, quoteNazev, clientEmail, dealId, onClose }: Props) {
  const [share, setShare] = useState<ShareState | null>(null)
  // kontrolní kontakt: nabídne se po jakémkoli odeslání (e-mail, sdílení, kopie odkazu)
  const [odeslano, setOdeslano] = useState(false)
  const [fuTyp, setFuTyp] = useState<KontrolniKontaktTyp>('HOVOR')
  const [fuDatum, setFuDatum] = useState(() => toDateInputValue(zaPracovnichDni(KONTROLNI_KONTAKT_DNI)))
  const [fuStav, setFuStav] = useState<'nabidka' | 'ukladam' | 'hotovo' | 'preskoceno'>('nabidka')
  const [loadingShare, setLoadingShare] = useState(true)
  const [working, setWorking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  const [to, setTo] = useState(clientEmail ?? '')
  const [zprava, setZprava] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share)
    fetch(`/api/quotes/${quoteId}/share`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data?.shared) setShare({ url: data.url, expiresAt: data.expiresAt }) })
      .catch(() => {})
      .finally(() => setLoadingShare(false))
  }, [quoteId])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  async function createLink(): Promise<ShareState | null> {
    setWorking(true)
    setError('')
    try {
      const res = await fetch(`/api/quotes/${quoteId}/share`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Odkaz se nepodařilo vytvořit'); return null }
      const s = { url: data.url, expiresAt: data.expiresAt }
      setShare(s)
      return s
    } catch {
      setError('Odkaz se nepodařilo vytvořit')
      return null
    } finally {
      setWorking(false)
    }
  }

  async function revokeLink() {
    setWorking(true)
    setError('')
    try {
      const res = await fetch(`/api/quotes/${quoteId}/share`, { method: 'DELETE' })
      if (res.ok) setShare(null)
      else setError('Odkaz se nepodařilo zrušit')
    } catch {
      setError('Odkaz se nepodařilo zrušit')
    } finally {
      setWorking(false)
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setOdeslano(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard nedostupná */ }
  }

  async function nativeShare() {
    const s = share ?? (await createLink())
    if (!s) return
    try {
      await navigator.share({
        title: `Cenová nabídka${quoteKod ? ` ${quoteKod}` : ''}`,
        url: s.url,
      })
      setOdeslano(true)
    } catch { /* uživatel zrušil */ }
  }

  async function sendEmail() {
    setSending(true)
    setError('')
    setSentTo(null)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, zprava: zprava || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'E-mail se nepodařilo odeslat')
        return
      }
      setSentTo(data.to)
      setOdeslano(true)
      // e-mail vytváří veřejný odkaz automaticky — obnov stav sekce odkazu
      fetch(`/api/quotes/${quoteId}/share`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.shared) setShare({ url: d.url, expiresAt: d.expiresAt }) })
        .catch(() => {})
    } catch {
      setError('E-mail se nepodařilo odeslat')
    } finally {
      setSending(false)
    }
  }

  async function naplanovatKontrolu() {
    setFuStav('ukladam')
    try {
      const res = await fetch(`/api/deals/${dealId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typ: fuTyp,
          datum: fuDatum,
          cas: '09:00',
          popis: kontrolniKontaktPopis(quoteKod, fuTyp),
          cil: KONTROLNI_KONTAKT_CIL,
          reminderAt: new Date(`${fuDatum}T09:00:00`).toISOString(),
        }),
      })
      if (!res.ok) {
        setFuStav('nabidka')
        setError('Kontrolní kontakt se nepodařilo naplánovat')
        return
      }
      setFuStav('hotovo')
    } catch {
      setFuStav('nabidka')
      setError('Kontrolní kontakt se nepodařilo naplánovat')
    }
  }

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 md:p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-slate-700 flex items-start justify-between gap-3 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">Poslat klientovi</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {quoteKod ? `${quoteKod} · ` : ''}{quoteNazev}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-0.5 rounded mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Veřejný odkaz */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">Veřejný odkaz na PDF</p>

          {loadingShare ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : share ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <input readOnly value={share.url} className={`${inputCls} font-mono text-xs`} onFocus={e => e.target.select()} />
                <button
                  onClick={() => copyLink(share.url)}
                  className="flex-shrink-0 px-3 py-2.5 text-sm font-medium text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  {copied ? '✓' : 'Kopírovat'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-400 dark:text-slate-500">Platí do {formatDate(new Date(share.expiresAt))}</p>
                <button onClick={revokeLink} disabled={working} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
                  Zrušit odkaz
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={createLink}
              disabled={working}
              className="w-full px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
            >
              {working ? 'Vytvářím…' : 'Vytvořit veřejný odkaz'}
            </button>
          )}

          {canNativeShare && (
            <button
              onClick={nativeShare}
              disabled={working}
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Sdílet… (WhatsApp, SMS)
            </button>
          )}
        </div>

        {/* E-mail */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2">Odeslat e-mailem (PDF v příloze)</p>

          {sentTo ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
              ✓ Odesláno na <strong>{sentTo}</strong>
            </div>
          ) : (
            <>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="E-mail klienta"
                className={`${inputCls} mb-2`}
              />
              <textarea
                value={zprava}
                onChange={e => setZprava(e.target.value)}
                placeholder="Osobní zpráva (volitelné)…"
                rows={2}
                className={`${inputCls} resize-none mb-2`}
              />
              <button
                onClick={sendEmail}
                disabled={sending || !to.trim()}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Odesílám…</>
                ) : 'Odeslat nabídku'}
              </button>
            </>
          )}
        </div>

        {/* Kontrolní kontakt — dotaz s předvolbou po odeslání */}
        {odeslano && fuStav !== 'preskoceno' && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 bg-amber-50/60 dark:bg-amber-900/10">
            {fuStav === 'hotovo' ? (
              <p className="text-sm text-green-700 dark:text-green-400">
                ✓ Kontrolní {fuTyp === 'HOVOR' ? 'hovor' : 'e-mail'} naplánován na <strong>{formatDate(new Date(fuDatum))}</strong>
              </p>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">Kontrolní kontakt</p>
                <p className="text-sm text-gray-600 dark:text-slate-300 mb-3">Naplánovat, kdy se klientovi ozvete k nabídce?</p>
                <div className="flex gap-2 mb-3">
                  <select value={fuTyp} onChange={e => setFuTyp(e.target.value as KontrolniKontaktTyp)} className={`${inputCls} w-auto flex-shrink-0`}>
                    <option value="HOVOR">Hovor</option>
                    <option value="EMAIL">E-mail</option>
                  </select>
                  <input type="date" value={fuDatum} onChange={e => setFuDatum(e.target.value)} className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={naplanovatKontrolu}
                    disabled={fuStav === 'ukladam' || !fuDatum}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-40"
                  >
                    {fuStav === 'ukladam' ? 'Ukládám…' : 'Naplánovat'}
                  </button>
                  <button onClick={() => setFuStav('preskoceno')} className="px-4 py-2.5 text-sm text-gray-500 dark:text-slate-400 hover:underline">
                    Teď ne
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="px-5 pb-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <div className="h-2 md:h-0 pb-safe" />
      </div>
    </div>
  )
}
