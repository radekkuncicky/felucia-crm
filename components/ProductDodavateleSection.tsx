'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm'
import { formatKcPresne } from '@/lib/format'
import AresAutocomplete from '@/components/AresAutocomplete'
import type { AresFirma } from '@/hooks/useAresLookup'

/**
 * Dodavatelé produktu (M:N s objednacím kódem a nákupní cenou, jeden hlavní).
 * Samostatně si načítá data z /api/products/[id]/dodavatele — nezávisí na formuláři produktu.
 */

export interface Vazba {
  id: string
  dodavatelId: string
  objednaciKod: string | null
  nakupniCena: number | null
  dodaciLhuta: string | null
  hlavni: boolean
  dodavatel: { id: string; nazev: string; email: string | null; aktivni: boolean }
}

interface DodavatelOption { id: string; nazev: string }

interface Props {
  productId: string
  /** financeNakupky — nákupní ceny od dodavatele */
  showNakupky: boolean
  /** sklad PLNY — přidávání/úprava vazeb */
  canEdit: boolean
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-gray-900 dark:text-white'
const label = 'block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5'

type FormState = { dodavatelId: string; novyNazev: string; novyAres: AresFirma | null; objednaciKod: string; nakupniCena: string; dodaciLhuta: string }
const emptyForm: FormState = { dodavatelId: '', novyNazev: '', novyAres: null, objednaciKod: '', nakupniCena: '', dodaciLhuta: '' }

export default function ProductDodavateleSection({ productId, showNakupky, canEdit }: Props) {
  const [vazby, setVazby] = useState<Vazba[] | null>(null)
  const [dodavatele, setDodavatele] = useState<DodavatelOption[]>([])
  const [editing, setEditing] = useState<'new' | string | null>(null) // 'new' | dodavatelId
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/products/${productId}/dodavatele`)
    if (res.ok) setVazby(await res.json())
  }, [productId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!canEdit) return
    fetch('/api/dodavatele').then(r => r.ok ? r.json() : []).then(setDodavatele).catch(() => {})
  }, [canEdit])

  function startNew() {
    setForm(emptyForm)
    setEditing('new')
  }

  function startEdit(v: Vazba) {
    setForm({
      dodavatelId: v.dodavatelId,
      novyNazev: '',
      novyAres: null,
      objednaciKod: v.objednaciKod ?? '',
      nakupniCena: v.nakupniCena !== null ? String(v.nakupniCena) : '',
      dodaciLhuta: v.dodaciLhuta ?? '',
    })
    setEditing(v.dodavatelId)
  }

  async function save() {
    setSaving(true)
    try {
      let dodavatelId = form.dodavatelId
      // Rychlé založení dodavatele přímo z produktu
      if (editing === 'new' && dodavatelId === '__new') {
        if (!form.novyNazev.trim()) { toast.error('Zadejte název dodavatele'); return }
        // Z ARES rovnou IČO/DIČ/sídlo (uživatel mohl název ještě upravit → bere se z inputu)
        const a = form.novyAres
        const res = await fetch('/api/dodavatele', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nazev: form.novyNazev, ...(a ? { ico: a.ico, dic: a.dic ?? '', ulice: a.ulice, mesto: a.mesto, psc: a.psc } : {}) }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) { toast.error(d.error ?? 'Dodavatele se nepodařilo založit'); return }
        dodavatelId = d.id
        setDodavatele(prev => [...prev, { id: d.id, nazev: d.nazev }].sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')))
      }
      if (!dodavatelId) { toast.error('Vyberte dodavatele'); return }

      const payload = {
        dodavatelId,
        objednaciKod: form.objednaciKod,
        nakupniCena: form.nakupniCena === '' ? null : Number(form.nakupniCena),
        dodaciLhuta: form.dodaciLhuta,
      }
      const res = editing === 'new'
        ? await fetch(`/api/products/${productId}/dodavatele`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/products/${productId}/dodavatele/${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Uložení selhalo'); return }
      toast.success(editing === 'new' ? 'Dodavatel přidán' : 'Uloženo')
      setEditing(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function setHlavni(v: Vazba) {
    const res = await fetch(`/api/products/${productId}/dodavatele/${v.dodavatelId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hlavni: true }),
    })
    if (res.ok) { toast.success(`${v.dodavatel.nazev} je hlavní dodavatel`); load() }
  }

  async function remove(v: Vazba) {
    if (!(await confirmDialog(`Odebrat dodavatele ${v.dodavatel.nazev} od tohoto produktu?`, { confirmLabel: 'Odebrat' }))) return
    const res = await fetch(`/api/products/${productId}/dodavatele/${v.dodavatelId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Dodavatel odebrán'); load() }
  }

  const uzPrirazeni = new Set((vazby ?? []).map(v => v.dodavatelId))
  const volniDodavatele = dodavatele.filter(d => !uzPrirazeni.has(d.id))

  return (
    <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Dodavatelé</h3>
        {canEdit && editing === null && (
          <button type="button" onClick={startNew} className="text-sm font-medium text-primary dark:text-primary-light hover:underline">+ Přidat dodavatele</button>
        )}
      </div>

      {vazby === null ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Načítám…</p>
      ) : vazby.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">
          Zatím žádný dodavatel. {canEdit ? 'Přidejte ho, aby šel produkt objednat ze zakázky.' : ''}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-700 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          {vazby.map(v => (
            <li key={v.id} className="px-3 py-2.5 text-sm">
              {editing === v.dodavatelId ? (
                <VazbaForm form={form} setForm={setForm} showNakupky={showNakupky} dodavatele={[]} mode="edit" dodavatelNazev={v.dodavatel.nazev} saving={saving} onSave={save} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="min-w-[160px] flex-1">
                    <Link href={`/sklad?tab=dodavatele&id=${v.dodavatel.id}`} className="font-medium text-gray-900 dark:text-white hover:underline">{v.dodavatel.nazev}</Link>
                    {v.hlavni && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Hlavní</span>}
                    {!v.dodavatel.aktivni && <span className="ml-2 text-[10px] uppercase text-gray-400">neaktivní</span>}
                  </div>
                  <div className="text-gray-600 dark:text-slate-400">
                    <span className="text-xs text-gray-400 dark:text-slate-500">Obj. kód </span>
                    <span className="font-mono">{v.objednaciKod ?? '—'}</span>
                  </div>
                  {showNakupky && (
                    <div className="text-gray-600 dark:text-slate-400">
                      <span className="text-xs text-gray-400 dark:text-slate-500">Nák. cena </span>
                      {v.nakupniCena !== null ? formatKcPresne(v.nakupniCena) : '—'}
                    </div>
                  )}
                  {v.dodaciLhuta && <div className="text-xs text-gray-400 dark:text-slate-500">{v.dodaciLhuta}</div>}
                  {canEdit && (
                    <div className="flex items-center gap-2 text-xs ml-auto">
                      {!v.hlavni && <button type="button" onClick={() => setHlavni(v)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">Nastavit hlavní</button>}
                      <button type="button" onClick={() => startEdit(v)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">Upravit</button>
                      <button type="button" onClick={() => remove(v)} className="text-red-500 hover:text-red-700">Odebrat</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
          {editing === 'new' && (
            <li className="px-3 py-3 bg-gray-50 dark:bg-slate-900/40">
              <VazbaForm form={form} setForm={setForm} showNakupky={showNakupky} dodavatele={volniDodavatele} mode="new" saving={saving} onSave={save} onCancel={() => setEditing(null)} />
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function VazbaForm({ form, setForm, showNakupky, dodavatele, mode, dodavatelNazev, saving, onSave, onCancel }: {
  form: FormState
  setForm: (f: FormState) => void
  showNakupky: boolean
  dodavatele: DodavatelOption[]
  mode: 'new' | 'edit'
  dodavatelNazev?: string
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v })
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Dodavatel</label>
          {mode === 'edit' ? (
            <p className="text-sm font-medium text-gray-900 dark:text-white py-2">{dodavatelNazev}</p>
          ) : (
            <select value={form.dodavatelId} onChange={e => set('dodavatelId', e.target.value)} className={inp} autoFocus>
              <option value="">— vyberte —</option>
              {dodavatele.map(d => <option key={d.id} value={d.id}>{d.nazev}</option>)}
              <option value="__new">+ Nový dodavatel…</option>
            </select>
          )}
          {mode === 'new' && form.dodavatelId === '__new' && (
            <div className="mt-2 space-y-2">
              <AresAutocomplete
                onSelect={f => setForm({ ...form, novyNazev: f.nazev, novyAres: f })}
                placeholder="Hledat v ARES (název nebo IČO)"
              />
              <input type="text" value={form.novyNazev} onChange={e => set('novyNazev', e.target.value)} className={inp} placeholder="Název nového dodavatele" />
              {form.novyAres && (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Z ARES: IČO {form.novyAres.ico}{form.novyAres.dic ? `, DIČ ${form.novyAres.dic}` : ''}{form.novyAres.mesto ? `, ${form.novyAres.mesto}` : ''} — doplní se k dodavateli.
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <label className={label}>Objednací kód u dodavatele</label>
          <input type="text" value={form.objednaciKod} onChange={e => set('objednaciKod', e.target.value)} className={inp} placeholder="Kód, pod kterým ho dodavatel vede" />
        </div>
        {showNakupky && (
          <div>
            <label className={label}>Nákupní cena (Kč / MJ)</label>
            <input type="number" min="0" step="0.01" value={form.nakupniCena} onChange={e => set('nakupniCena', e.target.value)} className={inp} placeholder="Volitelné" />
          </div>
        )}
        <div>
          <label className={label}>Dodací lhůta</label>
          <input type="text" value={form.dodaciLhuta} onChange={e => set('dodaciLhuta', e.target.value)} className={inp} placeholder="Např. 3–5 dní" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">Zrušit</button>
        <button type="button" onClick={onSave} disabled={saving} className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">{saving ? 'Ukládám…' : 'Uložit'}</button>
      </div>
    </div>
  )
}
