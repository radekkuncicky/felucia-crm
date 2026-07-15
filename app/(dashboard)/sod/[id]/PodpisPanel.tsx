'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm'
import { formatDateTime, formatDate } from '@/lib/format'

export const STAV_LABELS: Record<string, string> = {
  NAVRH: 'Návrh',
  ODESLANO: 'Odesláno k podpisu',
  PODEPSANO: 'Podepsáno',
  EXPIROVANO: 'Expirováno',
  STORNO: 'Storno',
}

export const STAV_COLORS: Record<string, string> = {
  NAVRH: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  ODESLANO: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PODEPSANO: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  EXPIROVANO: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  STORNO: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300',
}

const UDALOST_LABELS: Record<string, string> = {
  VYTVORENO: 'Smlouva vytvořena',
  REVIZE: 'Nová verze smlouvy',
  ODESLANO: 'Odesláno klientovi k podpisu',
  PRIPOMINKA: 'Klientovi odeslána připomínka e-mailem',
  ZOBRAZENO: 'Klient zobrazil smlouvu',
  OTP_ODESLAN: 'Klientovi odeslán ověřovací SMS kód',
  OTP_OVERENO: 'Klient ověřil totožnost',
  OTP_CHYBA: 'Chybně zadaný ověřovací kód',
  PODEPSANO: 'Smlouva podepsána klientem',
  ZNEPLATNENO: 'Odkaz k podpisu zneplatněn',
  EXPIROVANO: 'Platnost odkazu vypršela',
  STORNO: 'Smlouva stornována',
}

interface Udalost {
  id: string
  typ: string
  vytvoreno: string
  meta: { email?: string; telefon?: string; jmeno?: string } | null
}

interface PodpisyPristup {
  allowed: boolean
  zdroj: 'PLAN' | 'MODUL' | null
  limit: number | null
  vyuzito: number
  muzeAktivovatModul: boolean
}

interface Props {
  sodId: string
  stav: string
  klientEmail: string | null
  klientTelefon: string | null
  podepsano: string | null
  podepsalJmeno: string | null
  relace: { email: string; telefon: string; expirace: string } | null
  udalosti: Udalost[]
  can: { pristup: PodpisyPristup; sms: boolean; email: boolean }
}

export default function PodpisPanel(props: Props) {
  const { sodId, stav, podepsano, podepsalJmeno, relace, udalosti, can } = props
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [ruse, setRuse] = useState(false)
  const [stornuji, setStornuji] = useState(false)

  const { pristup } = can
  const ready = pristup.allowed && can.sms && can.email
  const podepsana = stav === 'PODEPSANO'

  async function zneplatnit() {
    if (!(await confirmDialog('Zneplatnit odeslaný odkaz? Klient přes něj smlouvu neotevře ani nepodepíše.', { confirmLabel: 'Zneplatnit' }))) return
    setRuse(true)
    try {
      const res = await fetch(`/api/sod/${sodId}/zneplatnit`, { method: 'POST' })
      if (res.ok) {
        toast.success('Odkaz zneplatněn')
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Zneplatnění se nepodařilo')
      }
    } finally {
      setRuse(false)
    }
  }

  async function stornovat() {
    if (!(await confirmDialog('Stornovat smlouvu? Aktivní odkaz k podpisu přestane platit. Opětovné odeslání smlouvu zase oživí.', { confirmLabel: 'Stornovat' }))) return
    setStornuji(true)
    try {
      const res = await fetch(`/api/sod/${sodId}/storno`, { method: 'POST' })
      if (res.ok) {
        toast.success('Smlouva stornována')
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Storno se nepodařilo')
      }
    } finally {
      setStornuji(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Online podpis</h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STAV_COLORS[stav] ?? STAV_COLORS.NAVRH}`}>
          {STAV_LABELS[stav] ?? stav}
        </span>
      </div>

      {podepsana ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-4 py-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-800 dark:text-green-300">
            Podepsal(a) <strong>{podepsalJmeno}</strong>{podepsano && <> · {formatDateTime(podepsano)}</>}.
            Podpis je součástí PDF.
          </p>
        </div>
      ) : (
        <>
          {stav === 'ODESLANO' && relace && (
            <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
              Odkaz odeslán na <strong className="text-gray-900 dark:text-white">{relace.email}</strong>,
              ověřovací kód půjde na <strong className="text-gray-900 dark:text-white">+{relace.telefon}</strong>.
              Platí do {formatDate(relace.expirace)}.
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setModalOpen(true)}
              disabled={!ready}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {stav === 'ODESLANO' ? 'Odeslat znovu' : 'Odeslat k podpisu'}
            </button>
            {stav === 'ODESLANO' && (
              <button
                onClick={zneplatnit}
                disabled={ruse}
                className="text-sm font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-3.5 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                {ruse ? 'Ruším…' : 'Zneplatnit odkaz'}
              </button>
            )}
            {stav !== 'STORNO' && (
              <button
                onClick={stornovat}
                disabled={stornuji}
                className="ml-auto text-xs font-medium text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:underline disabled:opacity-50"
              >
                {stornuji ? 'Stornuji…' : 'Stornovat smlouvu'}
              </button>
            )}
          </div>

          {pristup.muzeAktivovatModul && (
            <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
              Aktivujte si modul Online podpis za 99 Kč/licence/měsíc (100 smluv měsíčně) ve{' '}
              <Link href="/settings/billing" className="underline">Fakturaci</Link>, nebo přejděte na PROFESSIONAL.
            </p>
          )}
          {!pristup.allowed && !pristup.muzeAktivovatModul && pristup.zdroj === null && (
            <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
              Online podpis je dostupný v plánu PROFESSIONAL — <Link href="/settings/billing" className="underline">upgradovat</Link>
            </p>
          )}
          {pristup.zdroj === 'MODUL' && pristup.limit != null && (
            <p className={`mt-2 text-xs ${pristup.allowed ? 'text-gray-400 dark:text-slate-500' : 'text-amber-600 dark:text-amber-400'}`}>
              {pristup.allowed
                ? `Modul Online podpis: využito ${pristup.vyuzito} ze ${pristup.limit} smluv tento měsíc`
                : `Měsíční limit ${pristup.limit} smluv je vyčerpán — obnoví se 1. den dalšího měsíce`}
            </p>
          )}
          {pristup.allowed && !can.email && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Nejprve nastavte odesílání e-mailů v <Link href="/settings/email" className="underline">Nastavení → Odesílání e-mailů</Link>
            </p>
          )}
          {pristup.allowed && can.email && !can.sms && (
            <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
              SMS brána pro ověřovací kódy zatím není aktivní — online podpis bude dostupný po jejím zapojení.
            </p>
          )}
        </>
      )}

      {/* Časová osa */}
      {udalosti.length > 0 && (
        <div className="mt-4 border-t border-gray-100 dark:border-slate-700 pt-3">
          <ol className="space-y-2">
            {udalosti.map(u => (
              <li key={u.id} className="flex items-baseline gap-3 text-[13px]">
                <span className="text-gray-400 dark:text-slate-500 font-mono text-xs whitespace-nowrap">{formatDateTime(u.vytvoreno)}</span>
                <span className={u.typ === 'PODEPSANO' ? 'font-semibold text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-slate-400'}>
                  {UDALOST_LABELS[u.typ] ?? u.typ}
                  {u.typ === 'ODESLANO' && u.meta?.email && (
                    <span className="text-gray-400 dark:text-slate-500"> — {u.meta.email}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {modalOpen && (
        <OdeslatModal
          sodId={sodId}
          email={relace?.email ?? props.klientEmail ?? ''}
          telefon={relace?.telefon ?? props.klientTelefon ?? ''}
          znovu={stav === 'ODESLANO'}
          onClose={() => setModalOpen(false)}
          onSent={() => { setModalOpen(false); router.refresh() }}
        />
      )}
    </div>
  )
}

// Kontrolní obrazovka před odesláním — poslední obrana proti překlepu
// v kontaktu (odkaz jde e-mailem, ověřovací kód SMS na telefon).
function OdeslatModal({ sodId, email: initEmail, telefon: initTelefon, znovu, onClose, onSent }: {
  sodId: string; email: string; telefon: string; znovu: boolean
  onClose: () => void; onSent: () => void
}) {
  const [email, setEmail] = useState(initEmail)
  const [telefon, setTelefon] = useState(initTelefon)
  const [odesilam, setOdesilam] = useState(false)
  const [chyba, setChyba] = useState<string | null>(null)

  async function odeslat() {
    setOdesilam(true)
    setChyba(null)
    try {
      const res = await fetch(`/api/sod/${sodId}/odeslat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), telefon: telefon.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setChyba(data.error ?? 'Odeslání se nepodařilo'); return }
      toast.success(`Smlouva odeslána na ${data.email}`)
      onSent()
    } catch {
      setChyba('Odeslání se nepodařilo, zkuste to znovu')
    } finally {
      setOdesilam(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          {znovu ? 'Odeslat smlouvu znovu' : 'Odeslat smlouvu k podpisu'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
          Zkontrolujte oba údaje — na e-mail jde odkaz, na telefon ověřovací kód.
          {znovu && ' Předchozí odkaz přestane platit.'}
        </p>

        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">E-mail klienta (odkaz na smlouvu)</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`${inputCls} mb-4`} placeholder="jan@novak.cz" />

        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Mobil klienta (ověřovací SMS kód)</label>
        <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} className={inputCls} placeholder="777 123 456" />

        {chyba && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-4 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{chyba}</p>
        )}

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={odeslat}
            disabled={odesilam || !email.trim() || !telefon.trim()}
            className="flex-1 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-50"
          >
            {odesilam ? 'Odesílám…' : 'Zkontrolováno, odeslat'}
          </button>
          <button onClick={onClose} className="text-sm font-medium text-gray-500 dark:text-slate-400 px-3 py-2.5 hover:underline">
            Zrušit
          </button>
        </div>
      </div>
    </div>
  )
}
