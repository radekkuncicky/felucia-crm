'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavigateButton } from '@/components/NavigateButton'
import { SignatureCanvas } from '@/components/SignatureCanvas'
import VyuctovaniSekce from '@/components/servis/VyuctovaniSekce'
import {
  type NavstevaTyp,
  SERVIS_STAV_LABELS,
  TYP_LABELS,
  stavLabel,
  stavColor,
  typLabel,
} from '@/lib/servisStav'

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
}

interface OrgUser {
  id: string
  jmeno: string
}

interface Props {
  zakazka: Zakazka
  orgUsers: OrgUser[]
  canEdit: boolean
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export default function ZakazkaDetailClient({ zakazka, orgUsers, canEdit }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [fotky, setFotky] = useState<string[]>(zakazka.fotky)
  const [uploading, setUploading] = useState(false)
  const [podpis, setPodpis] = useState<string | null>(zakazka.podpisKlienta)

  const [form, setForm] = useState({
    stav: zakazka.stav,
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

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function patch(override: Record<string, unknown> = {}) {
    return fetch(`/api/servis/zakazky/${zakazka.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stav: form.stav,
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

  // Handoff: dokončení protokolu = přechod do DOKONCENA, což nastaví
  // protokolDokoncen (brána do vyúčtování). Vyžaduje podpis klienta.
  async function dokoncitProtokol() {
    if (!podpis) {
      alert('Pro dokončení protokolu je potřeba podpis klienta.')
      return
    }
    if (!confirm('Dokončit protokol a předat zakázku? Po dokončení ji bude možné vyúčtovat.')) return
    setFinishing(true)
    try {
      const res = await patch({ stav: 'DOKONCENA' })
      if (res.ok) router.refresh()
      else alert('Dokončení se nezdařilo.')
    } finally {
      setFinishing(false)
    }
  }

  async function uploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/servis/zakazky/${zakazka.id}/fotky`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setFotky(data.fotky)
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function deleteFoto(index: number) {
    const res = await fetch(`/api/servis/zakazky/${zakazka.id}/fotky`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    })
    if (res.ok) {
      const data = await res.json()
      setFotky(data.fotky)
    }
  }

  const inputClass = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500'
  const labelClass = 'block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1'
  const cardClass = 'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5'

  return (
    <div className="space-y-4">
      {/* Hlavička */}
      <div className={`${cardClass} flex flex-wrap items-start justify-between gap-4`}>
        <div>
          <Link href="/servis/zakazky" className="text-sm text-gray-500 dark:text-slate-400 hover:underline">← Zpět na seznam</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {zakazka.cislo ?? 'Servisní zakázka'}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stavColor(form.stav)}`}>{stavLabel(form.stav)}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{typLabel(form.typ)}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/servis/zakazky/${zakazka.id}/protokol`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Protokol PDF
          </a>
          {canEdit && (
            <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50">
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Levý sloupec: stav, plánování */}
        <div className="space-y-4">
          <div className={cardClass}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Stav & plánování</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Stav</label>
                <select value={form.stav} onChange={e => set('stav', e.target.value)} disabled={!canEdit} className={inputClass}>
                  {Object.entries(SERVIS_STAV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {form.stav === 'CEKA' && (
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

          <div className={cardClass}>
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
                  disabled={finishing || saving}
                  className="inline-flex items-center gap-2 bg-[#1B5E20] hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {finishing ? 'Dokončuji…' : 'Dokončit protokol a předat'}
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

          <VyuctovaniSekce
            zakazkaId={zakazka.id}
            protokolDokoncen={zakazka.protokolDokoncen}
            vyfakturovano={zakazka.vyfakturovano}
            zaplaceno={zakazka.zaplaceno}
            canEdit={canEdit}
          />

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
