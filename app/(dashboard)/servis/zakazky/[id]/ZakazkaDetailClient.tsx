'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavigateButton } from '@/components/NavigateButton'
import { SignatureCanvas } from '@/components/SignatureCanvas'
import VyuctovaniSekce from '@/components/servis/VyuctovaniSekce'
import ConfirmModal from '@/components/ConfirmModal'
import { apiFetch, api } from '@/lib/api'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm'
import {
  type NavstevaTyp,
  type ServisniZakazkaStav,
  SERVIS_STAV_LABELS,
  TYP_LABELS,
  stavLabel,
  stavColor,
  typLabel,
} from '@/lib/servisStav'

interface ZakazkaRef {
  id: string
  cislo: string | null
  stav: string
}

interface Zakazka {
  id: string
  cislo: string | null
  typ: string
  stav: string
  planovanyTermin: string | null
  skutecnyTermin: string | null
  trvaniMinut: number | null
  technikId: string | null
  technik: { id: string; jmeno: string } | null
  cekaDuvod: string | null
  poznamka: string | null
  zprava: string | null
  nalezeneZavady: string | null
  doporuceni: string | null
  nakladyCas: string | null
  nakladyMaterial: string | null
  fotky: string[]
  podpisKlienta: string | null
  protokolDokoncen: string | null
  vyfakturovano: boolean
  zaplaceno: boolean
  klient: { id: string; jmeno: string; adresa: string; telefon: string | null } | null
  kontrakt: { id: string; nazev: string; cisloKontraktu: string | null } | null
  zarizeni: { id: string; nazev: string; typ: string; vyrobniCislo: string | null } | null
  puvodniZakazka: ZakazkaRef | null
  reklamace: ZakazkaRef[]
}

interface OrgUser {
  id: string
  jmeno: string
}

interface Props {
  zakazka: Zakazka
  orgUsers: OrgUser[]
  canEdit: boolean
  isAdmin: boolean
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

// Hlavní cesta životního cyklu pro stepper. CEKA se zobrazuje jako pauza na
// pozici Probíhá, ZRUSENA/REKLAMACE jako badge místo stepperu.
const CYKLUS: ServisniZakazkaStav[] = ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'DOKONCENA', 'VYUCTOVANA', 'UZAVRENA']

function cyklusIndex(stav: string): number {
  if (stav === 'CEKA') return CYKLUS.indexOf('PROBIHA')
  return CYKLUS.indexOf(stav as ServisniZakazkaStav)
}

export default function ZakazkaDetailClient({ zakazka, orgUsers, canEdit, isAdmin }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [fotky, setFotky] = useState<string[]>(zakazka.fotky)
  const [uploading, setUploading] = useState(false)
  const [podpis, setPodpis] = useState<string | null>(zakazka.podpisKlienta)
  const [confirmAction, setConfirmAction] = useState<'zrusit' | 'uzavrit' | null>(null)
  const [reklamaceOpen, setReklamaceOpen] = useState(false)
  const [cekaOpen, setCekaOpen] = useState(false)
  const [cekaDuvodDraft, setCekaDuvodDraft] = useState('')
  const [reklamacePoznamka, setReklamacePoznamka] = useState('')
  const [manualStavOpen, setManualStavOpen] = useState(false)
  const [manualStav, setManualStav] = useState(zakazka.stav)

  const [form, setForm] = useState({
    typ: zakazka.typ,
    technikId: zakazka.technikId ?? '',
    planovanyTermin: toLocalInput(zakazka.planovanyTermin),
    skutecnyTermin: toLocalInput(zakazka.skutecnyTermin),
    cekaDuvod: zakazka.cekaDuvod ?? '',
    poznamka: zakazka.poznamka ?? '',
    zprava: zakazka.zprava ?? '',
    nalezeneZavady: zakazka.nalezeneZavady ?? '',
    doporuceni: zakazka.doporuceni ?? '',
    nakladyCas: zakazka.nakladyCas ?? '',
    nakladyMaterial: zakazka.nakladyMaterial ?? '',
  })

  const stav = zakazka.stav

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // Uloží formulář; stav se NEposílá — mění se výhradně akcemi (override).
  async function patch(override: Record<string, unknown> = {}) {
    return apiFetch(`/api/servis/zakazky/${zakazka.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        typ: form.typ,
        technikId: form.technikId || null,
        planovanyTermin: form.planovanyTermin ? new Date(form.planovanyTermin).toISOString() : null,
        skutecnyTermin: form.skutecnyTermin ? new Date(form.skutecnyTermin).toISOString() : null,
        cekaDuvod: form.cekaDuvod || null,
        poznamka: form.poznamka || null,
        zprava: form.zprava || null,
        nalezeneZavady: form.nalezeneZavady || null,
        doporuceni: form.doporuceni || null,
        nakladyCas: form.nakladyCas ? Number(form.nakladyCas) : null,
        nakladyMaterial: form.nakladyMaterial ? Number(form.nakladyMaterial) : null,
        podpisKlienta: podpis,
        ...override,
      }),
    })
  }

  async function save() {
    setSaving(true)
    try {
      const res = await patch()
      if (res.ok) router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // Změna stavu akcí — uloží i rozpracovaný formulář, chybu přechodu ukáže.
  async function changeStav(novy: string, extra: Record<string, unknown> = {}) {
    setActing(true)
    try {
      const res = await patch({ stav: novy, ...extra })
      if (res.ok) {
        router.refresh()
        return true
      }
      return false
    } finally {
      setActing(false)
    }
  }

  function pozastavit() {
    setCekaDuvodDraft(form.cekaDuvod)
    setCekaOpen(true)
  }

  async function pozastavitPotvrdit() {
    set('cekaDuvod', cekaDuvodDraft)
    const ok = await changeStav('CEKA', { cekaDuvod: cekaDuvodDraft || 'Bez udání důvodu' })
    if (ok) setCekaOpen(false)
  }

  // Handoff: dokončení protokolu = přechod do DOKONCENA, což nastaví
  // protokolDokoncen (brána do vyúčtování). Vyžaduje podpis klienta.
  async function dokoncitProtokol() {
    if (!podpis) {
      toast.warning('Pro dokončení protokolu je potřeba podpis klienta (sekce Předání zakázky).')
      document.getElementById('predani-sekce')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const ok = await confirmDialog('Dokončit protokol a předat zakázku? Po dokončení ji bude možné vyúčtovat.', {
      title: 'Předání zakázky',
      confirmLabel: 'Dokončit a předat',
      danger: false,
    })
    if (!ok) return
    await changeStav('DOKONCENA')
  }

  async function vytvoritReklamaci() {
    setActing(true)
    try {
      const res = await api.post<{ id: string }>(`/api/servis/zakazky/${zakazka.id}/reklamace`,
        { poznamka: reklamacePoznamka || null },
      )
      if (!res.ok || !res.data) return
      setReklamaceOpen(false)
      router.push(`/servis/zakazky/${res.data.id}`)
    } finally {
      setActing(false)
    }
  }

  async function nastavStavRucne() {
    if (manualStav === stav) {
      setManualStavOpen(false)
      return
    }
    const ok = await changeStav(manualStav, { forceStav: true })
    if (ok) setManualStavOpen(false)
  }

  async function uploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiFetch<{ fotky: string[] }>(`/api/servis/zakazky/${zakazka.id}/fotky`,
        { method: 'POST', body: fd },
        { errorMessage: 'Fotku se nepodařilo nahrát.' })
      if (res.ok && res.data) setFotky(res.data.fotky)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function deleteFoto(index: number) {
    const res = await apiFetch<{ fotky: string[] }>(`/api/servis/zakazky/${zakazka.id}/fotky`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    }, { errorMessage: 'Fotku se nepodařilo smazat.' })
    if (res.ok && res.data) setFotky(res.data.fotky)
  }

  const inputClass = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500'
  const labelClass = 'block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1'
  const cardClass = 'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5'
  const primaryBtn = 'inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors'
  const ghostBtn = 'px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors'

  const jeMimoCyklus = stav === 'ZRUSENA' || stav === 'REKLAMACE'
  const aktualniIndex = cyklusIndex(stav)

  // Kontextové akce podle stavu — jedno primární tlačítko „co teď".
  function renderAkce() {
    if (!canEdit) return null
    switch (stav) {
      case 'NOVA':
      case 'NAPLANOVANA':
      case 'REKLAMACE':
        return (
          <button onClick={() => changeStav('PROBIHA')} disabled={acting} className={primaryBtn}>
            {acting ? 'Ukládám…' : '▶ Zahájit práci'}
          </button>
        )
      case 'PROBIHA':
        return (
          <>
            <button onClick={dokoncitProtokol} disabled={acting} className={primaryBtn}>
              {acting ? 'Ukládám…' : 'Dokončit protokol a předat'}
            </button>
            <button onClick={pozastavit} disabled={acting} className={ghostBtn}>
              Pozastavit
            </button>
          </>
        )
      case 'CEKA':
        return (
          <button onClick={() => changeStav('PROBIHA')} disabled={acting} className={primaryBtn}>
            {acting ? 'Ukládám…' : '▶ Pokračovat v práci'}
          </button>
        )
      case 'DOKONCENA':
        return (
          <button
            onClick={() => document.getElementById('vyuctovani-sekce')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={primaryBtn}
          >
            Pokračovat vyúčtováním ↓
          </button>
        )
      case 'VYUCTOVANA':
        return (
          <button onClick={() => setConfirmAction('uzavrit')} disabled={acting} className={primaryBtn}>
            Uzavřít zakázku
          </button>
        )
      case 'ZRUSENA':
        return (
          <button onClick={() => changeStav('NOVA')} disabled={acting} className={ghostBtn}>
            Obnovit zakázku
          </button>
        )
      default:
        return null
    }
  }

  const jdeZrusit = ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'CEKA', 'REKLAMACE'].includes(stav)
  const jdeReklamovat = ['DOKONCENA', 'VYUCTOVANA', 'UZAVRENA'].includes(stav)

  return (
    <div className="space-y-4">
      <ConfirmModal
        isOpen={confirmAction === 'zrusit'}
        title="Zrušit zakázku"
        message="Zakázka se označí jako zrušená. Kdyby to bylo omylem, jde ji později obnovit."
        confirmLabel="Zrušit zakázku"
        danger
        loading={acting}
        onConfirm={async () => { const ok = await changeStav('ZRUSENA'); if (ok) setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmModal
        isOpen={confirmAction === 'uzavrit'}
        title="Uzavřít zakázku"
        message={zakazka.zaplaceno
          ? 'Zakázka je zaplacená. Uzavřením se ukončí její životní cyklus.'
          : 'Pozor: zakázka zatím není označená jako zaplacená. Uzavřít ji můžeš i tak, ale obvykle se uzavírá až po zaplacení.'}
        confirmLabel="Uzavřít"
        loading={acting}
        onConfirm={async () => { const ok = await changeStav('UZAVRENA'); if (ok) setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Pozastavení — důvod čekání */}
      {cekaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pozastavit zakázku</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Zakázka přejde do stavu Čeká. Důvod uvidí dispečink i technik.
              </p>
            </div>
            <div className="px-6 py-4">
              <label className={labelClass}>Důvod čekání</label>
              <input
                type="text"
                value={cekaDuvodDraft}
                onChange={e => setCekaDuvodDraft(e.target.value)}
                placeholder="Např. čeká na díly"
                autoFocus
                className={inputClass}
                onKeyDown={e => { if (e.key === 'Enter') pozastavitPotvrdit() }}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setCekaOpen(false)} className={ghostBtn}>Zpět</button>
              <button onClick={pozastavitPotvrdit} disabled={acting} className={primaryBtn}>
                {acting ? 'Ukládám…' : 'Pozastavit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reklamace modal */}
      {reklamaceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Vytvořit reklamaci</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Založí se nová servisní zakázka navázaná na {zakazka.cislo ?? 'tuto zakázku'}.
                Objeví se v dispečinku mezi nezaplánovanými; tato zakázka zůstane beze změny.
              </p>
            </div>
            <div className="px-6 py-4">
              <label className={labelClass}>Co klient reklamuje</label>
              <textarea
                rows={3}
                value={reklamacePoznamka}
                onChange={e => setReklamacePoznamka(e.target.value)}
                placeholder="Popis reklamované závady…"
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setReklamaceOpen(false)} className={ghostBtn}>Zpět</button>
              <button onClick={vytvoritReklamaci} disabled={acting} className={primaryBtn}>
                {acting ? 'Zakládám…' : 'Vytvořit reklamaci'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hlavička: identita, stepper, akce */}
      <div className={`${cardClass} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/servis/zakazky" className="text-sm text-gray-500 dark:text-slate-400 hover:underline">← Zpět na seznam</Link>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {zakazka.cislo ?? 'Servisní zakázka'}
              </h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stavColor(stav)}`}>{stavLabel(stav)}</span>
              {stav === 'CEKA' && zakazka.cekaDuvod && (
                <span className="text-xs text-orange-600 dark:text-orange-400">({zakazka.cekaDuvod})</span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{typLabel(zakazka.typ)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {renderAkce()}
            <a
              href={`/api/servis/zakazky/${zakazka.id}/protokol`}
              target="_blank"
              rel="noopener noreferrer"
              className={ghostBtn}
            >
              Protokol PDF
            </a>
          </div>
        </div>

        {/* Vazby reklamací */}
        {zakazka.puvodniZakazka && (
          <div className="text-sm bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/40 rounded-lg px-3 py-2 text-purple-800 dark:text-purple-300">
            Reklamace k zakázce{' '}
            <Link href={`/servis/zakazky/${zakazka.puvodniZakazka.id}`} className="font-semibold hover:underline">
              {zakazka.puvodniZakazka.cislo ?? 'původní zakázce'}
            </Link>
          </div>
        )}
        {zakazka.reklamace.length > 0 && (
          <div className="text-sm bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/40 rounded-lg px-3 py-2 text-purple-800 dark:text-purple-300">
            K zakázce {zakazka.reklamace.length === 1 ? 'existuje reklamace' : 'existují reklamace'}:{' '}
            {zakazka.reklamace.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ', '}
                <Link href={`/servis/zakazky/${r.id}`} className="font-semibold hover:underline">
                  {r.cislo ?? r.id.slice(-6)}
                </Link>{' '}
                <span className="text-xs">({stavLabel(r.stav)})</span>
              </span>
            ))}
          </div>
        )}

        {/* Stepper životního cyklu */}
        {!jeMimoCyklus && (
          <ol className="flex items-center gap-0 overflow-x-auto pb-1" aria-label="Průběh zakázky">
            {CYKLUS.map((s, i) => {
              const done = i < aktualniIndex
              const current = i === aktualniIndex
              const paused = current && stav === 'CEKA'
              return (
                <li key={s} className="flex items-center flex-1 min-w-fit">
                  {i > 0 && (
                    <div className={`h-px flex-1 min-w-4 mx-1 ${done || current ? 'bg-green-500' : 'bg-gray-200 dark:bg-slate-600'}`} />
                  )}
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-none ${
                        done
                          ? 'bg-green-600 text-white'
                          : current
                            ? paused
                              ? 'bg-orange-500 text-white ring-2 ring-orange-200 dark:ring-orange-900'
                              : 'bg-green-600 text-white ring-2 ring-green-200 dark:ring-green-900'
                            : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400'
                      }`}
                    >
                      {done ? '✓' : paused ? '‖' : i + 1}
                    </span>
                    <span className={`text-xs ${current ? 'font-semibold text-gray-900 dark:text-white' : done ? 'text-gray-600 dark:text-slate-300' : 'text-gray-400 dark:text-slate-500'}`}>
                      {paused ? 'Čeká' : SERVIS_STAV_LABELS[s]}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {/* Sekundární akce */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-4 text-xs border-t border-gray-100 dark:border-slate-700 pt-3">
            {jdeReklamovat && (
              <button onClick={() => setReklamaceOpen(true)} className="text-purple-600 dark:text-purple-400 hover:underline font-medium">
                Vytvořit reklamaci
              </button>
            )}
            {jdeZrusit && (
              <button onClick={() => setConfirmAction('zrusit')} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:underline">
                Zrušit zakázku
              </button>
            )}
            {isAdmin && (
              <div className="ml-auto flex items-center gap-2">
                {manualStavOpen ? (
                  <>
                    <select
                      value={manualStav}
                      onChange={e => setManualStav(e.target.value)}
                      className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      {Object.entries(SERVIS_STAV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button onClick={nastavStavRucne} disabled={acting} className="text-green-600 dark:text-green-400 hover:underline font-medium disabled:opacity-50">
                      Nastavit
                    </button>
                    <button onClick={() => { setManualStavOpen(false); setManualStav(stav) }} className="text-gray-400 hover:underline">
                      Zrušit
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setManualStav(stav); setManualStavOpen(true) }} className="text-gray-400 dark:text-slate-500 hover:underline">
                    Změnit stav ručně
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Levý sloupec: plánování */}
        <div className="space-y-4">
          <div className={cardClass}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Plánování</h2>
            <div className="space-y-3">
              {stav === 'CEKA' && (
                <div>
                  <label className={labelClass}>Důvod čekání</label>
                  <input type="text" value={form.cekaDuvod} onChange={e => set('cekaDuvod', e.target.value)} disabled={!canEdit} placeholder="Např. čeká na díly" className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>Typ</label>
                <select value={form.typ} onChange={e => set('typ', e.target.value as NavstevaTyp)} disabled={!canEdit} className={inputClass}>
                  {Object.entries(TYP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Technik</label>
                <select value={form.technikId} onChange={e => set('technikId', e.target.value)} disabled={!canEdit} className={inputClass}>
                  <option value="">— nepřiřazen —</option>
                  {orgUsers.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Plánovaný termín</label>
                <input type="datetime-local" value={form.planovanyTermin} onChange={e => set('planovanyTermin', e.target.value)} disabled={!canEdit} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Skutečný termín</label>
                <input type="datetime-local" value={form.skutecnyTermin} onChange={e => set('skutecnyTermin', e.target.value)} disabled={!canEdit} className={inputClass} />
              </div>
              {canEdit && (
                <button onClick={save} disabled={saving} className={`${primaryBtn} w-full justify-center`}>
                  {saving ? 'Ukládám…' : 'Uložit změny'}
                </button>
              )}
            </div>
          </div>

          {/* Klient / zařízení */}
          <div className={cardClass}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Klient & zařízení</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-500 dark:text-slate-400">Klient</dt>
                <dd className="text-gray-900 dark:text-white">
                  {zakazka.klient ? (
                    <Link href={`/clients/${zakazka.klient.id}`} className="hover:underline">{zakazka.klient.jmeno}</Link>
                  ) : '—'}
                </dd>
              </div>
              {zakazka.klient?.telefon && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-slate-400">Telefon</dt>
                  <dd className="text-gray-900 dark:text-white"><a href={`tel:${zakazka.klient.telefon}`} className="hover:underline">{zakazka.klient.telefon}</a></dd>
                </div>
              )}
              {zakazka.klient?.adresa && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-slate-400">Adresa</dt>
                  <dd className="text-gray-900 dark:text-white">{zakazka.klient.adresa}</dd>
                  <div className="mt-1"><NavigateButton adresa={zakazka.klient.adresa} label="Navigovat" size="xs" /></div>
                </div>
              )}
              {zakazka.zarizeni && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-slate-400">Zařízení</dt>
                  <dd className="text-gray-900 dark:text-white">
                    <Link href={`/servis/zarizeni`} className="hover:underline">{zakazka.zarizeni.nazev}</Link>
                    {zakazka.zarizeni.vyrobniCislo && <span className="text-gray-500 dark:text-slate-400"> · {zakazka.zarizeni.vyrobniCislo}</span>}
                  </dd>
                </div>
              )}
              {zakazka.kontrakt && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-slate-400">Kontrakt</dt>
                  <dd className="text-gray-900 dark:text-white">{zakazka.kontrakt.cisloKontraktu ? `${zakazka.kontrakt.cisloKontraktu} · ` : ''}{zakazka.kontrakt.nazev}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Pravé dva sloupce: protokol, náklady, fotky */}
        <div className="lg:col-span-2 space-y-4">
          <div className={cardClass}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Výsledek práce</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Nalezené závady</label>
                <textarea rows={2} value={form.nalezeneZavady} onChange={e => set('nalezeneZavady', e.target.value)} disabled={!canEdit} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className={labelClass}>Provedená práce / zpráva</label>
                <textarea rows={3} value={form.zprava} onChange={e => set('zprava', e.target.value)} disabled={!canEdit} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className={labelClass}>Doporučení</label>
                <textarea rows={2} value={form.doporuceni} onChange={e => set('doporuceni', e.target.value)} disabled={!canEdit} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className={labelClass}>Interní poznámka</label>
                <textarea rows={2} value={form.poznamka} onChange={e => set('poznamka', e.target.value)} disabled={!canEdit} className={`${inputClass} resize-none`} />
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Náklady</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Práce (Kč)</label>
                <input type="number" min="0" step="0.01" value={form.nakladyCas} onChange={e => set('nakladyCas', e.target.value)} disabled={!canEdit} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Materiál (Kč)</label>
                <input type="number" min="0" step="0.01" value={form.nakladyMaterial} onChange={e => set('nakladyMaterial', e.target.value)} disabled={!canEdit} className={inputClass} />
              </div>
            </div>
          </div>

          <div className={cardClass} id="predani-sekce">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Předání zakázky</h2>
              {zakazka.protokolDokoncen ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Protokol dokončen {new Date(zakazka.protokolDokoncen).toLocaleDateString('cs-CZ')}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  Nedokončeno
                </span>
              )}
            </div>
            <label className={labelClass}>Podpis klienta</label>
            <SignatureCanvas onChange={setPodpis} existingDataUrl={podpis} disabled={!canEdit || !!zakazka.protokolDokoncen} />
            {!zakazka.protokolDokoncen && canEdit && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={dokoncitProtokol}
                  disabled={acting || saving}
                  className="inline-flex items-center gap-2 bg-[#1B5E20] hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {acting ? 'Dokončuji…' : 'Dokončit protokol a předat'}
                </button>
                <a
                  href={`/api/servis/zakazky/${zakazka.id}/protokol`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                >
                  Náhled protokolu (PDF)
                </a>
              </div>
            )}
            {zakazka.protokolDokoncen && (
              <a
                href={`/api/servis/zakazky/${zakazka.id}/protokol`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                Protokol (PDF)
              </a>
            )}
          </div>

          <div id="vyuctovani-sekce">
            <VyuctovaniSekce
              zakazkaId={zakazka.id}
              protokolDokoncen={zakazka.protokolDokoncen}
              vyfakturovano={zakazka.vyfakturovano}
              zaplaceno={zakazka.zaplaceno}
              canEdit={canEdit}
            />
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Fotky <span className="text-xs text-gray-400 dark:text-slate-500 font-normal">({fotky.length}/10)</span></h2>
              {canEdit && fotky.length < 10 && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" onChange={uploadFoto} className="hidden" />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-sm text-green-600 dark:text-green-400 hover:underline disabled:opacity-50">
                    {uploading ? 'Nahrávám…' : '+ Přidat fotku'}
                  </button>
                </>
              )}
            </div>
            {fotky.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500">Žádné fotky</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {fotky.map((src, i) => (
                  <div key={i} className="relative group aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-slate-700" />
                    {canEdit && (
                      <button onClick={() => deleteFoto(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
