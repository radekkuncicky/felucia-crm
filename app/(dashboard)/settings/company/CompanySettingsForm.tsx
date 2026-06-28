'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'


interface OrgData {
  id: string
  nazev: string
  ico: string
  dic: string
  sidlo: string
  telefon: string
  email: string
  web: string
  logo: string
  logoBw: string
}

export default function CompanySettingsForm({ org }: { org: OrgData }) {
  const router = useRouter()
  const [form, setForm] = useState(org)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoBwUploading, setLogoBwUploading] = useState(false)

  function set(field: keyof OrgData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/settings/company/logo', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        set('logo', data.logo)
      }
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleLogoBwUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoBwUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/settings/company/logo-bw', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        set('logoBw', data.logoBw)
      }
    } finally {
      setLogoBwUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/settings/company`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { setError('Chyba při ukládání'); return }
      setSaved(true)
      router.refresh()
    } catch { setError('Chyba při ukládání') }
    finally { setSaving(false) }
  }

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400'
  const lbl = 'block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-5">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}
      {saved && <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm px-3 py-2 rounded-lg">Uloženo ✓</div>}

      <div>
        <label className={lbl}>Název firmy *</label>
        <input value={form.nazev} onChange={e => set('nazev', e.target.value)} className={inp} placeholder="FELUCIA s.r.o." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>IČO</label>
          <input value={form.ico} onChange={e => set('ico', e.target.value)} className={inp} placeholder="12345678" />
        </div>
        <div>
          <label className={lbl}>DIČ</label>
          <input value={form.dic} onChange={e => set('dic', e.target.value)} className={inp} placeholder="CZ12345678" />
        </div>
      </div>

      <div>
        <label className={lbl}>Sídlo (adresa)</label>
        <input value={form.sidlo} onChange={e => set('sidlo', e.target.value)} className={inp} placeholder="Václavské náměstí 1, 110 00 Praha 1" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Telefon</label>
          <input value={form.telefon} onChange={e => set('telefon', e.target.value)} className={inp} placeholder="+420 123 456 789" />
        </div>
        <div>
          <label className={lbl}>Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inp} placeholder="info@firma.cz" />
        </div>
      </div>

      <div>
        <label className={lbl}>Web</label>
        <input value={form.web} onChange={e => set('web', e.target.value)} className={inp} placeholder="https://www.firma.cz" />
      </div>

      <div className="space-y-4">
        <div>
          <label className={lbl}>Barevné logo</label>
          <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-blue-600 border border-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20">
            {logoUploading ? 'Nahrávám…' : 'Vybrat soubor'}
            <input type="file" accept=".jpg,.jpeg,.png,.svg" className="hidden" onChange={handleLogoUpload} />
          </label>
          {form.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo} alt="Barevné logo" className="mt-2 h-16 object-contain border border-gray-200 dark:border-slate-600 rounded-lg p-2 bg-white" />
          )}
        </div>

        <div>
          <label className={lbl}>Černobílé logo <span className="text-gray-400 font-normal">(používá se ve smlouvách)</span></label>
          <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-blue-600 border border-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20">
            {logoBwUploading ? 'Nahrávám…' : 'Vybrat soubor'}
            <input type="file" accept=".jpg,.jpeg,.png,.svg" className="hidden" onChange={handleLogoBwUpload} />
          </label>
          {form.logoBw && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoBw} alt="Černobílé logo" className="mt-2 h-16 object-contain border border-gray-200 dark:border-slate-600 rounded-lg p-2 bg-white" />
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
        <strong>Placeholdery v šablonách:</strong>{' '}
        {`{{org_nazev}}, {{org_ico}}, {{org_dic}}, {{org_sidlo}}, {{org_telefon}}, {{org_email}}`}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
      >
        {saving ? 'Ukládám…' : 'Uložit změny'}
      </button>
    </div>
  )
}
