'use client'

// Formulář "Domluvit ukázku". Logika odeslání je 1:1 převzatá ze staré homepage
// (app/FeluciaLanding.tsx, CtaSection) - stejný endpoint /api/contact, pole,
// validace (required, type=email), texty stavů. Mění se jen vzhled.

import { useState } from 'react'
import { CONTACT } from '@/lib/landing'
import { IconCheck } from '../icons'

const inputCls =
  'block w-full rounded-lg border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] px-3.5 py-2.5 text-[16px] text-[var(--mk-ink)] placeholder:text-[var(--mk-faint)] focus:border-[var(--mk-green-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--mk-green-line)]'
const labelCls = 'mb-1.5 block text-[14px] font-medium text-[var(--mk-ink)]'

export function DemoForm() {
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

  if (status === 'ok') {
    return (
      <div className="py-8 text-center" role="status">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--mk-green-tint)] text-[var(--mk-green-ink)]">
          <IconCheck className="h-6 w-6" />
        </span>
        <p className="mk-display text-[22px] font-semibold text-[var(--mk-green-ink)]">Žádost přijata!</p>
        <p className="mt-2 text-[15px] text-[var(--mk-muted)]">Díky. Ozveme se vám a domluvíme si termín 20minutové ukázky.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="mk-display mb-5 text-[19px] font-semibold">Domluvit 20minutovou ukázku</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mk-jmeno" className={labelCls}>Jméno a příjmení *</label>
          <input id="mk-jmeno" required type="text" autoComplete="name" placeholder="Jan Novák" value={form.jmeno}
            onChange={e => setForm(f => ({ ...f, jmeno: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label htmlFor="mk-firma" className={labelCls}>Název firmy *</label>
          <input id="mk-firma" required type="text" autoComplete="organization" placeholder="Vaše s.r.o." value={form.firma}
            onChange={e => setForm(f => ({ ...f, firma: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label htmlFor="mk-email" className={labelCls}>Email *</label>
          <input id="mk-email" required type="email" autoComplete="email" placeholder="jan@vasefirma.cz" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label htmlFor="mk-telefon" className={labelCls}>Telefon (nepovinně)</label>
          <input id="mk-telefon" type="tel" autoComplete="tel" placeholder="+420 777 000 000" value={form.telefon}
            onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} className={inputCls} />
        </div>
      </div>
      {status === 'err' && (
        <p role="alert" className="mt-4 text-[14px] font-medium text-[var(--mk-danger)]">
          Chyba při odesílání. Zkuste to prosím znovu, nebo nám napište na {CONTACT.email}.
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--mk-green-ink)] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[var(--mk-ink)] disabled:opacity-70"
        >
          {status === 'sending' ? 'Odesílám…' : 'Domluvit 20minutovou ukázku'}
        </button>
        <p className="text-[13px] text-[var(--mk-muted)]">Bez závazků. Osobní rozhovor o vašem provozu.</p>
      </div>
    </form>
  )
}
