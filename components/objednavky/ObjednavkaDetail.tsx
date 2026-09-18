'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm'
import { formatDate, formatDateTime, formatKcPresne } from '@/lib/format'
import { OBJ_STAV_LABELS, OBJ_STAV_COLORS } from '@/app/(dashboard)/sklad/objednavkyStav'

/** Objednávka tak, jak ji vrací API (serializeObjednavka) */
export interface ObjednavkaDto {
  id: string
  cislo: string
  stav: string
  dodavatel: { id: string; nazev: string; email: string | null; telefon: string | null; kontaktOsoba: string | null; ico: string | null; dic: string | null; ulice: string | null; mesto: string | null; psc: string | null }
  zakazka: { id: string; cislo: string; nazev: string; mistoStavby: string | null; montazOd: string | null } | null
  vytvoril: { id: string; jmeno: string }
  zobrazitCeny: boolean
  pozadovanyTermin: string | null
  poznamka: string | null
  odeslano: string | null
  doruceno: string | null
  vytvoreno: string
  polozky: {
    id: string
    productId: string | null
    zakazkaPolozkaId: string | null
    objednaciKod: string | null
    nazev: string
    mnozstvi: number
    jednotka: string
    nakupniCena: number | null
    mnozstviDoruceno: number
  }[]
  celkem: number | null
  pocetPolozek: number
  pocetDorucenych: number
}

interface Props {
  objednavka: ObjednavkaDto
  canEdit: boolean
  showNakupky: boolean
  /** e-mail je nastavený (jinak tlačítko Odeslat disabled s vysvětlením) */
  emailConfigured: boolean
  onChange: (o: ObjednavkaDto) => void
  onDeleted?: () => void
  /** kompaktní režim (panel na /sklad) — bez velké hlavičky */
  compact?: boolean
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
const lbl = 'block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1'
const btn = 'px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50'
const btnSec = `${btn} text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700`
const btnPri = `${btn} text-white bg-green-600 hover:bg-green-700`
const fmtQty = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Operace selhala')
  return data
}

function PrijemModal({ o, onClose, onDone }: { o: ObjednavkaDto; onClose: () => void; onDone: (o: ObjednavkaDto) => void }) {
  const otevrene = o.polozky.filter(p => p.mnozstviDoruceno < p.mnozstvi)
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(otevrene.map(p => [p.id, String(p.mnozstvi - p.mnozstviDoruceno)])))
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const polozky = otevrene.map(p => ({ id: p.id, mnozstvi: Number(qty[p.id] || 0) })).filter(p => p.mnozstvi > 0)
      if (polozky.length === 0) { toast.error('Zadejte přijaté množství'); return }
      const data = await api(`/api/objednavky/${o.id}/prijem`, 'POST', { polozky })
      toast.success(data.stav === 'DORUCENA' ? 'Dodávka přijata — objednávka doručena' : 'Částečná dodávka přijata na sklad')
      onDone(data)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-xl">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Přijmout dodávku · {o.cislo}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Přijaté množství se naskladní{o.zakazka ? ' a u kompletně doručených položek rovnou rezervuje pro zakázku' : ''}.</p>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-slate-400 uppercase">
                <th className="text-left py-1">Položka</th>
                <th className="text-right py-1 w-24">Objednáno</th>
                <th className="text-right py-1 w-24">Doručeno</th>
                <th className="text-right py-1 w-28">Přijmout teď</th>
              </tr>
            </thead>
            <tbody>
              {otevrene.map(p => (
                <tr key={p.id} className="border-t border-gray-100 dark:border-slate-700">
                  <td className="py-2 pr-2 text-gray-900 dark:text-white">{p.nazev}<span className="block text-xs font-mono text-gray-400">{p.objednaciKod ?? ''}</span></td>
                  <td className="py-2 text-right text-gray-600 dark:text-slate-400">{fmtQty(p.mnozstvi)} {p.jednotka}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-slate-400">{fmtQty(p.mnozstviDoruceno)}</td>
                  <td className="py-2 pl-2">
                    <input type="number" min="0" max={p.mnozstvi - p.mnozstviDoruceno} step="any" value={qty[p.id] ?? ''} onChange={e => setQty(q => ({ ...q, [p.id]: e.target.value }))} className={`${inp} text-right`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center pt-1">
            <button type="button" onClick={() => setQty(Object.fromEntries(otevrene.map(p => [p.id, String(p.mnozstvi - p.mnozstviDoruceno)])))} className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white">Přijmout vše</button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={btnSec}>Zrušit</button>
              <button type="submit" disabled={saving} className={btnPri}>{saving ? 'Ukládám…' : 'Přijmout na sklad'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function OdeslatModal({ o, onClose, onDone }: { o: ObjednavkaDto; onClose: () => void; onDone: (o: ObjednavkaDto) => void }) {
  const [to, setTo] = useState(o.dodavatel.email ?? '')
  const [zprava, setZprava] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const data = await api(`/api/objednavky/${o.id}/odeslat`, 'POST', { to, zprava })
      toast.success(`Objednávka odeslána na ${data.to}`)
      onDone(data.objednavka)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Odeslat dodavateli · {o.cislo}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">PDF objednávky půjde v příloze{o.zobrazitCeny ? ' včetně nákupních cen' : ' bez cen'}.</p>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          <div>
            <label className={lbl}>Komu</label>
            <input type="email" required value={to} onChange={e => setTo(e.target.value)} className={inp} placeholder="objednavky@dodavatel.cz" />
          </div>
          <div>
            <label className={lbl}>Zpráva (volitelné)</label>
            <textarea value={zprava} onChange={e => setZprava(e.target.value)} rows={4} className={inp} placeholder="Např. prosíme o dodání na místo realizace, kontakt na stavbě…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btnSec}>Zrušit</button>
            <button type="submit" disabled={sending || !to} className={btnPri}>{sending ? 'Odesílám…' : 'Odeslat e-mail'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ObjednavkaDetail({ objednavka: o, canEdit, showNakupky, emailConfigured, onChange, onDeleted, compact }: Props) {
  const [prijem, setPrijem] = useState(false)
  const [odeslat, setOdeslat] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ pozadovanyTermin: string; poznamka: string; polozky: Record<string, { mnozstvi: string; objednaciKod: string; nakupniCena: string }> }>({ pozadovanyTermin: '', poznamka: '', polozky: {} })
  const [busy, setBusy] = useState(false)

  const jeNavrh = o.stav === 'NAVRH'
  const otevrena = o.stav === 'NAVRH' || o.stav === 'ODESLANA' || o.stav === 'CASTECNE_DORUCENA'

  function startEdit() {
    setDraft({
      pozadovanyTermin: o.pozadovanyTermin ? o.pozadovanyTermin.slice(0, 10) : '',
      poznamka: o.poznamka ?? '',
      polozky: Object.fromEntries(o.polozky.map(p => [p.id, { mnozstvi: String(p.mnozstvi), objednaciKod: p.objednaciKod ?? '', nakupniCena: p.nakupniCena !== null ? String(p.nakupniCena) : '' }])),
    })
    setEditing(true)
  }

  async function saveEdit() {
    setBusy(true)
    try {
      const data = await api(`/api/objednavky/${o.id}`, 'PATCH', {
        pozadovanyTermin: draft.pozadovanyTermin || null,
        poznamka: draft.poznamka,
        polozky: o.polozky.map(p => ({
          id: p.id,
          mnozstvi: Number(draft.polozky[p.id]?.mnozstvi ?? p.mnozstvi),
          objednaciKod: draft.polozky[p.id]?.objednaciKod ?? p.objednaciKod,
          ...(showNakupky ? { nakupniCena: draft.polozky[p.id]?.nakupniCena === '' ? null : Number(draft.polozky[p.id]?.nakupniCena) } : {}),
        })),
      })
      onChange(data)
      setEditing(false)
      toast.success('Uloženo')
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  async function toggleCeny() {
    try { onChange(await api(`/api/objednavky/${o.id}`, 'PATCH', { zobrazitCeny: !o.zobrazitCeny })) } catch (e) { toast.error((e as Error).message) }
  }

  async function oznacitOdeslanou() {
    try { onChange(await api(`/api/objednavky/${o.id}`, 'PATCH', { stav: 'ODESLANA' })); toast.success('Označeno jako odesláno') } catch (e) { toast.error((e as Error).message) }
  }

  async function zrusit() {
    if (!(await confirmDialog(`Zrušit objednávku ${o.cislo}? Položky zakázky se vrátí do stavu Čeká.`, { confirmLabel: 'Zrušit objednávku' }))) return
    try { onChange(await api(`/api/objednavky/${o.id}`, 'PATCH', { stav: 'ZRUSENA' })); toast.success('Objednávka zrušena') } catch (e) { toast.error((e as Error).message) }
  }

  async function smazat() {
    if (!(await confirmDialog(`Smazat návrh ${o.cislo}?`, { confirmLabel: 'Smazat' }))) return
    try { await api(`/api/objednavky/${o.id}`, 'DELETE'); toast.success('Návrh smazán'); onDeleted?.() } catch (e) { toast.error((e as Error).message) }
  }

  const adresa = [o.dodavatel.ulice, [o.dodavatel.psc, o.dodavatel.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    <div className="space-y-5">
      {prijem && <PrijemModal o={o} onClose={() => setPrijem(false)} onDone={onChange} />}
      {odeslat && <OdeslatModal o={o} onClose={() => setOdeslat(false)} onDone={onChange} />}

      {/* Hlavička */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-bold font-mono text-gray-900 dark:text-white`}>{o.cislo}</h2>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${OBJ_STAV_COLORS[o.stav]}`}>{OBJ_STAV_LABELS[o.stav]}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Vytvořil {o.vytvoril.jmeno} · {formatDateTime(o.vytvoreno)}
            {o.odeslano && <> · odesláno {formatDate(o.odeslano)}</>}
            {o.doruceno && <> · doručeno {formatDate(o.doruceno)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/objednavky/${o.id}/pdf`} target="_blank" rel="noopener" className={btnSec}>Stáhnout PDF</a>
          {canEdit && otevrena && (
            <button
              type="button"
              onClick={() => setOdeslat(true)}
              disabled={!emailConfigured}
              title={emailConfigured ? undefined : 'Odesílání e-mailů není nastaveno (Nastavení → E-mail)'}
              className={btnSec}
            >
              Odeslat e-mailem
            </button>
          )}
          {canEdit && jeNavrh && <button type="button" onClick={oznacitOdeslanou} className={btnSec}>Označit jako odeslanou</button>}
          {canEdit && otevrena && <button type="button" onClick={() => setPrijem(true)} className={btnPri}>Přijmout dodávku</button>}
        </div>
      </div>

      {/* Dodavatel + zakázka + nastavení */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-gray-50 dark:bg-slate-900/40 rounded-lg p-3">
          <p className={lbl}>Dodavatel</p>
          <Link href={`/sklad?tab=dodavatele&id=${o.dodavatel.id}`} className="font-semibold text-gray-900 dark:text-white hover:underline">{o.dodavatel.nazev}</Link>
          {adresa && <p className="text-gray-600 dark:text-slate-400">{adresa}</p>}
          {o.dodavatel.kontaktOsoba && <p className="text-gray-600 dark:text-slate-400">{o.dodavatel.kontaktOsoba}</p>}
          {o.dodavatel.email && <p className="text-gray-600 dark:text-slate-400 break-all">{o.dodavatel.email}</p>}
          {o.dodavatel.telefon && <p className="text-gray-600 dark:text-slate-400">{o.dodavatel.telefon}</p>}
        </div>
        <div className="bg-gray-50 dark:bg-slate-900/40 rounded-lg p-3">
          <p className={lbl}>Zakázka</p>
          {o.zakazka ? (
            <>
              <Link href={`/zakazky/${o.zakazka.id}?tab=objednavky`} className="font-semibold text-gray-900 dark:text-white hover:underline">{o.zakazka.cislo}</Link>
              <p className="text-gray-600 dark:text-slate-400">{o.zakazka.nazev}</p>
              {o.zakazka.mistoStavby && <p className="text-xs text-gray-500 dark:text-slate-500">{o.zakazka.mistoStavby}</p>}
            </>
          ) : <p className="text-gray-400">Bez zakázky</p>}
        </div>
        <div className="bg-gray-50 dark:bg-slate-900/40 rounded-lg p-3 space-y-2">
          <div>
            <p className={lbl}>Požadovaný termín</p>
            {editing ? (
              <input type="date" value={draft.pozadovanyTermin} onChange={e => setDraft(d => ({ ...d, pozadovanyTermin: e.target.value }))} className={inp} />
            ) : <p className="text-gray-900 dark:text-white">{o.pozadovanyTermin ? formatDate(o.pozadovanyTermin) : '—'}</p>}
          </div>
          {showNakupky && (
            <label className={`flex items-center gap-2 text-xs ${canEdit && otevrena ? 'cursor-pointer' : 'opacity-70'}`}>
              <input type="checkbox" checked={o.zobrazitCeny} disabled={!canEdit || !otevrena} onChange={toggleCeny} className="rounded border-gray-300" />
              Nákupní ceny v PDF pro dodavatele
            </label>
          )}
        </div>
      </div>

      {/* Položky */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Položky ({o.pocetPolozek}) · doručeno {o.pocetDorucenych}/{o.pocetPolozek}</h3>
          {canEdit && jeNavrh && !editing && <button type="button" onClick={startEdit} className="text-xs text-primary dark:text-primary-light hover:underline">Upravit položky</button>}
          {editing && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white">Zrušit</button>
              <button type="button" onClick={saveEdit} disabled={busy} className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline disabled:opacity-50">{busy ? 'Ukládám…' : 'Uložit'}</button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-900/50 text-xs text-gray-500 dark:text-slate-400 uppercase">
                <th className="text-left px-4 py-2 w-8">#</th>
                <th className="text-left px-4 py-2">Obj. kód</th>
                <th className="text-left px-4 py-2">Název</th>
                <th className="text-right px-4 py-2">Množství</th>
                <th className="text-right px-4 py-2">Doručeno</th>
                {showNakupky && <th className="text-right px-4 py-2">Cena / MJ</th>}
                {showNakupky && <th className="text-right px-4 py-2">Celkem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {o.polozky.map((p, i) => {
                const d = draft.polozky[p.id]
                const hotovo = p.mnozstviDoruceno >= p.mnozstvi
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-slate-400">
                      {editing ? <input type="text" value={d?.objednaciKod ?? ''} onChange={e => setDraft(dr => ({ ...dr, polozky: { ...dr.polozky, [p.id]: { ...dr.polozky[p.id], objednaciKod: e.target.value } } }))} className={`${inp} w-28`} /> : (p.objednaciKod ?? '—')}
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">
                      {p.productId ? <Link href={`/products/${p.productId}`} className="hover:underline">{p.nazev}</Link> : p.nazev}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {editing ? <input type="number" min="0.001" step="any" value={d?.mnozstvi ?? ''} onChange={e => setDraft(dr => ({ ...dr, polozky: { ...dr.polozky, [p.id]: { ...dr.polozky[p.id], mnozstvi: e.target.value } } }))} className={`${inp} w-24 text-right inline-block`} /> : `${fmtQty(p.mnozstvi)} ${p.jednotka}`}
                    </td>
                    <td className={`px-4 py-2 text-right whitespace-nowrap ${hotovo ? 'text-green-600 dark:text-green-400' : p.mnozstviDoruceno > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                      {fmtQty(p.mnozstviDoruceno)}{hotovo && ' ✓'}
                    </td>
                    {showNakupky && (
                      <td className="px-4 py-2 text-right whitespace-nowrap text-gray-600 dark:text-slate-400">
                        {editing ? <input type="number" min="0" step="0.01" value={d?.nakupniCena ?? ''} onChange={e => setDraft(dr => ({ ...dr, polozky: { ...dr.polozky, [p.id]: { ...dr.polozky[p.id], nakupniCena: e.target.value } } }))} className={`${inp} w-28 text-right inline-block`} /> : (p.nakupniCena !== null ? formatKcPresne(p.nakupniCena) : '—')}
                      </td>
                    )}
                    {showNakupky && <td className="px-4 py-2 text-right whitespace-nowrap font-medium text-gray-900 dark:text-white">{p.nakupniCena !== null ? formatKcPresne(p.nakupniCena * p.mnozstvi) : '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
            {showNakupky && o.celkem !== null && (
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-slate-700">
                  <td colSpan={6} className="px-4 py-2 text-right text-sm font-semibold text-gray-700 dark:text-slate-300">Celkem bez DPH</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatKcPresne(o.celkem)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Poznámka */}
      <div>
        <p className={lbl}>Poznámka pro dodavatele</p>
        {editing ? (
          <textarea value={draft.poznamka} onChange={e => setDraft(d => ({ ...d, poznamka: e.target.value }))} rows={3} className={inp} />
        ) : <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{o.poznamka || <span className="text-gray-400">—</span>}</p>}
      </div>

      {canEdit && otevrena && (
        <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
          {jeNavrh && <button type="button" onClick={smazat} className="text-xs text-gray-500 hover:text-red-600">Smazat návrh</button>}
          {o.stav !== 'CASTECNE_DORUCENA' && <button type="button" onClick={zrusit} className="text-xs text-red-500 hover:text-red-700">Zrušit objednávku</button>}
        </div>
      )}
    </div>
  )
}
