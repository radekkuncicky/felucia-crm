'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PredavakStav } from '@prisma/client'
import { toast } from 'sonner'
import { SignatureCanvas } from '@/components/SignatureCanvas'
import { formatDate } from '@/lib/format'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PolozkaData {
  id: string
  nazev: string
  planovanoMnozstvi: number
  mnozstviPouzito: number
  jednotka: string
  zahrnuto: boolean
  poznamka: string
}

interface FotoData {
  id: string
  url: string
  popis: string
  vytvoreno: string
}

interface PredavakData {
  id: string
  cislo: string
  stav: PredavakStav
  poznamka: string
  klientPritomen: boolean
  podpisSvg: string | null
  odmitnutoDuvod: string | null
  upravenoPodpisano: boolean
  vytvoreno: string
  podpisano: string | null
  schvaleno: string | null
  technik: { id: string; jmeno: string; email: string }
  schvalil: { id: string; jmeno: string } | null
  zakazka: {
    id: string
    cislo: string
    nazev: string
    klient: { id: string; jmeno: string; prijmeni: string; telefon: string | null; email?: string | null }
    vedouci: { id: string; jmeno: string } | null
  }
  polozky: PolozkaData[]
  fotky: FotoData[]
  vyuctovani: { id: string; cislo: string } | null
}

interface Props {
  predavak: PredavakData
  currentUserId: string
  role: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAV_LABELS: Record<PredavakStav, string> = {
  ROZPRACOVAN: 'Rozpracován',
  PODPISAN: 'Podepsán',
  SCHVALEN: 'Schválen',
  ODMITNUTO: 'Odmítnuto',
}

const STAV_COLORS: Record<PredavakStav, string> = {
  ROZPRACOVAN: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  PODPISAN: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SCHVALEN: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ODMITNUTO: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PredavakClient({ predavak: initial, currentUserId, role }: Props) {
  const router = useRouter()
  const isTechnik = role === 'TECHNIK'
  const isManager = role === 'ADMIN' || role === 'OBCHODNIK'
  const isOwnTechnik = initial.technik.id === currentUserId
  const canEdit = initial.stav !== 'SCHVALEN' && (isOwnTechnik || isManager)

  const [stav, setStav] = useState<PredavakStav>(initial.stav)
  const [polozky, setPolozky] = useState<PolozkaData[]>(initial.polozky)
  const [fotky, setFotky] = useState<FotoData[]>(initial.fotky)
  const [poznamka, setPoznamka] = useState(initial.poznamka)
  const [klientPritomen, setKlientPritomen] = useState(initial.klientPritomen)
  const [podpisSvg, setPodpisSvg] = useState<string | null>(initial.podpisSvg)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmPodpsat, setConfirmPodpsat] = useState(false)
  const [confirmSchvalit, setConfirmSchvalit] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [odmitnutiDuvod, setOdmitnutiDuvod] = useState('')
  const [odmitnutiModal, setOdmitnutiModal] = useState(false)
  const [newRow, setNewRow] = useState<{ nazev: string; mnozstvi: string; jednotka: string } | null>(null)
  const [savingNew, setSavingNew] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, type: 'ok' | 'err') {
    if (type === 'ok') toast.success(msg)
    else toast.error(msg)
  }

  // Auto-save poznamka
  useEffect(() => {
    if (!canEdit) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      autoSave({ poznamka })
    }, 2000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poznamka])

  async function autoSave(data: Partial<{ poznamka: string; klientPritomen: boolean }>) {
    await fetch(`/api/predavaky/${initial.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/predavaky/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poznamka,
          klientPritomen,
          podpisSvg,
          polozky: polozky.map(p => ({
            id: p.id,
            mnozstviPouzito: p.mnozstviPouzito,
            zahrnuto: p.zahrnuto,
            poznamka: p.poznamka || null,
          })),
        }),
      })
      if (res.ok) {
        showToast('Uloženo', 'ok')
      } else {
        showToast('Chyba při ukládání', 'err')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePodepsat() {
    setConfirmPodpsat(false)
    setSaving(true)
    try {
      // First save current state
      await fetch(`/api/predavaky/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poznamka,
          klientPritomen,
          podpisSvg,
          polozky: polozky.map(p => ({ id: p.id, mnozstviPouzito: p.mnozstviPouzito, zahrnuto: p.zahrnuto, poznamka: p.poznamka || null })),
        }),
      })

      const res = await fetch(`/api/predavaky/${initial.id}/podepsat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podpisSvg, klientPritomen, poznamka }),
      })

      if (res.ok) {
        const data = await res.json()
        setStav('PODPISAN')
        showToast(
          data.zakazkaNovyStav === 'PREDANA'
            ? 'Protokol odeslán ke schválení — zakázka automaticky označena jako Předaná'
            : 'Protokol odeslán ke schválení',
          'ok'
        )
        router.refresh()
      } else {
        const err = await res.json()
        showToast(err.error ?? 'Chyba při odesílání', 'err')
      }
    } finally {
      setSaving(false)
    }
  }

  // Ověří skutečný stav na serveru; 'UNKNOWN' = síť/server nedostupný (nepropadne ven)
  async function reconcileStav(): Promise<PredavakStav | 'UNKNOWN'> {
    try {
      const r = await fetch(`/api/predavaky/${initial.id}`)
      if (!r.ok) return 'UNKNOWN'
      const data = await r.json()
      return data.stav as PredavakStav
    } catch {
      return 'UNKNOWN'
    }
  }

  async function handleSchvalit() {
    setConfirmSchvalit(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/predavaky/${initial.id}/schvalit`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setStav('SCHVALEN')
        if (data.vyuctovaniId) {
          showToast(`Protokol schválen — vyúčtování ${data.vyuctovaniCislo ?? ''} připraveno`, 'ok')
          router.push(`/zakazky/${initial.zakazka.id}/vyuctovani/${data.vyuctovaniId}`)
        } else {
          showToast('Protokol schválen', 'ok')
          router.refresh()
        }
        return
      }
      // Chyba — ověř skutečný stav (souběžný request mohl protokol mezitím schválit)
      const real = await reconcileStav()
      if (real === 'SCHVALEN') {
        setStav('SCHVALEN')
        showToast('Protokol schválen, vyúčtování vytvořeno', 'ok')
        router.refresh()
      } else if (real === 'UNKNOWN') {
        showToast('Nepodařilo se ověřit stav, obnovte stránku', 'err')
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.error ?? 'Chyba při schvalování', 'err')
      }
    } catch {
      // POST spadl na síti — ověř, zda akce přesto neprošla
      const real = await reconcileStav()
      if (real === 'SCHVALEN') {
        setStav('SCHVALEN')
        showToast('Protokol schválen, vyúčtování vytvořeno', 'ok')
        router.refresh()
      } else {
        showToast('Nepodařilo se ověřit stav, obnovte stránku', 'err')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleReopen() {
    setConfirmReopen(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/predavaky/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reopen: true }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setStav('ROZPRACOVAN')
        showToast(
          data.zakazkaNovyStav === 'V_REALIZACI'
            ? 'Protokol vrácen k úpravám — zakázka je zpět v realizaci'
            : 'Protokol vrácen k úpravám',
          'ok'
        )
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.error ?? 'Chyba', 'err')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setConfirmDelete(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/predavaky/${initial.id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Protokol smazán', 'ok')
        router.push(`/zakazky/${initial.zakazka.id}?tab=predavaky`)
      } else {
        const err = await res.json()
        showToast(err.error ?? 'Chyba při mazání', 'err')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleOdmitnout() {
    if (!odmitnutiDuvod.trim()) return
    setSaving(true)
    setOdmitnutiModal(false)
    try {
      const res = await fetch(`/api/predavaky/${initial.id}/odmitnout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duvod: odmitnutiDuvod }),
      })
      if (res.ok) {
        setStav('ODMITNUTO')
        showToast('Protokol odmítnut', 'ok')
        router.refresh()
      } else {
        const err = await res.json()
        showToast(err.error ?? 'Chyba', 'err')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNewRow() {
    if (!newRow || !newRow.nazev.trim()) return
    setSavingNew(true)
    try {
      const res = await fetch(`/api/predavaky/${initial.id}/polozky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: newRow.nazev, mnozstvi: Number(newRow.mnozstvi), jednotka: newRow.jednotka }),
      })
      if (res.ok) {
        const p = await res.json()
        setPolozky(prev => [...prev, {
          id: p.id,
          nazev: p.nazev,
          planovanoMnozstvi: Number(p.planovanoMnozstvi),
          mnozstviPouzito: Number(p.mnozstviPouzito),
          jednotka: p.jednotka,
          zahrnuto: p.zahrnuto,
          poznamka: p.poznamka ?? '',
        }])
        setNewRow(null)
      }
    } finally {
      setSavingNew(false)
    }
  }

  async function handleFotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (fotky.length >= 20) { showToast('Maximálně 20 fotek na protokol', 'err'); break }
        if (file.size > 5 * 1024 * 1024) { showToast(`${file.name}: příliš velká (max 5 MB)`, 'err'); continue }

        const dataUrl: string = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })

        const res = await fetch(`/api/predavaky/${initial.id}/foto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: dataUrl, popis: file.name }),
        })
        if (res.ok) {
          const foto = await res.json()
          setFotky(prev => [...prev, { id: foto.id, url: foto.url, popis: foto.popis ?? '', vytvoreno: foto.vytvoreno }])
        }
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleFotoDelete(fotoId: string) {
    const res = await fetch(`/api/predavaky/${initial.id}/foto/${fotoId}`, { method: 'DELETE' })
    if (res.ok) setFotky(prev => prev.filter(f => f.id !== fotoId))
  }

  const onSignatureChange = useCallback((dataUrl: string | null) => {
    setPodpisSvg(dataUrl)
  }, [])

  const zahrnutoCount = polozky.filter(p => p.zahrnuto).length
  const canSubmit = zahrnutoCount > 0 && (!klientPritomen || !!podpisSvg)
  const submitBlockReason = zahrnutoCount === 0
    ? 'Zaškrtněte alespoň 1 položku'
    : klientPritomen && !podpisSvg
      ? 'Chybí podpis klienta (nebo odznačte „Klient byl přítomen")'
      : null

  return (
    <>
      {/* Confirm podepsat */}
      {confirmPodpsat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Odeslat ke schválení?</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-5">
              Po odeslání nelze položky upravit. Protokol bude odeslán vedoucímu ke schválení.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmPodpsat(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handlePodepsat} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                {saving ? 'Odesílám…' : 'Odeslat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm schvalit */}
      {confirmSchvalit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Schválit protokol?</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-5">
              Schválením protokolu <strong>{initial.cislo}</strong> budou použité položky označeny jako vydané ze skladu a bude automaticky vytvořeno vyúčtování.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmSchvalit(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handleSchvalit} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                {saving ? 'Schvaluji…' : 'Schválit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm reopen */}
      {confirmReopen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Vrátit protokol k úpravám?</h3>
            <div className="text-sm text-gray-600 dark:text-slate-400 mb-5 space-y-2">
              <p>Protokol <strong>{initial.cislo}</strong> se vrátí do stavu <strong>Rozpracován</strong> a technik ho bude muset znovu podepsat.</p>
              {stav === 'SCHVALEN' && (
                <p>
                  Zároveň se zruší schválení: vydané položky se vrátí na sklad
                  {initial.vyuctovani && <> a smaže se návrh vyúčtování <strong>{initial.vyuctovani.cislo}</strong></>}.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmReopen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handleReopen} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50">
                {saving ? 'Vracím…' : 'Vrátit k úpravám'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Smazat protokol?</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-5">
              Protokol <strong>{initial.cislo}</strong> včetně všech položek a fotek bude <strong>trvale smazán</strong>. Tuto akci nelze vzít zpět.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                {saving ? 'Mažu…' : 'Smazat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Odmitnutí modal */}
      {odmitnutiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Odmítnout protokol</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Důvod odmítnutí *</label>
              <textarea
                value={odmitnutiDuvod}
                onChange={e => setOdmitnutiDuvod(e.target.value)}
                rows={3}
                style={{ fontSize: 16 }}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setOdmitnutiModal(false); setOdmitnutiDuvod('') }} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handleOdmitnout} disabled={!odmitnutiDuvod.trim() || saving} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                Odmítnout
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 pb-40 md:pb-6">
        {/* ─── Header ─── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
          <div className="flex flex-col gap-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-slate-500">
              <a href={`/zakazky/${initial.zakazka.id}?tab=predavaky`} className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors">{initial.zakazka.cislo}</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <span className="text-gray-600 dark:text-slate-300 font-medium">{initial.cislo}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-2xl font-bold text-green-600 dark:text-green-400">{initial.cislo}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[stav]}`}>
                    {STAV_LABELS[stav]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Technik: <strong>{initial.technik.jmeno}</strong> · Vytvořen {formatDate(initial.vytvoreno)}
                  {initial.podpisano && ` · Podepsán ${formatDate(initial.podpisano)}`}
                  {initial.schvaleno && ` · Schválen ${formatDate(initial.schvaleno)}`}
                </p>
                {initial.schvalil && (
                  <p className="text-xs text-gray-500 dark:text-slate-400">Schválil: {initial.schvalil.jmeno}</p>
                )}
              </div>

              {/* Action buttons desktop */}
              <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                <HeaderActions
                  predavakId={initial.id}
                  zakazkaId={initial.zakazka.id}
                  vyuctovani={initial.vyuctovani}
                  stav={stav}
                  canEdit={canEdit}
                  isTechnik={isTechnik}
                  isManager={isManager}
                  isOwnTechnik={isOwnTechnik}
                  saving={saving}
                  canSubmit={canSubmit}
                  submitBlockReason={submitBlockReason}
                  onSave={handleSave}
                  onPodepsat={() => setConfirmPodpsat(true)}
                  onSchvalit={() => setConfirmSchvalit(true)}
                  onOdmitnout={() => setOdmitnutiModal(true)}
                  onReopen={() => setConfirmReopen(true)}
                  onDelete={() => setConfirmDelete(true)}
                />
              </div>
            </div>

            {/* Odmítnuto důvod */}
            {stav === 'ODMITNUTO' && initial.odmitnutoDuvod && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase mb-1">Důvod odmítnutí</p>
                <p className="text-sm text-red-800 dark:text-red-300">{initial.odmitnutoDuvod}</p>
              </div>
            )}

            {/* Upraveno po odeslání */}
            {initial.upravenoPodpisano && stav === 'PODPISAN' && (
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Upraveno po odeslání</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">Technik upravil obsah protokolu po jeho odeslání ke schválení.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Položky ─── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Položky ({zahrnutoCount} / {polozky.length})</h2>
            {canEdit && (
              <button
                onClick={() => setNewRow({ nazev: '', mnozstvi: '1', jednotka: 'ks' })}
                className="text-sm font-medium text-primary dark:text-primary-light hover:underline"
              >
                + Přidat položku
              </button>
            )}
          </div>

            {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1B5E20]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white uppercase w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white uppercase">Název</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-white uppercase">Plánováno</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-white uppercase">Použito</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white uppercase">Jed.</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white uppercase">Poznámka</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-white uppercase">Zahrnuto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {polozky.map((p, idx) => (
                  <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 ${!p.zahrnuto ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.nazev}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">{p.planovanoMnozstvi}</td>
                    <td className="px-4 py-3 text-right">
                      {canEdit ? (
                        <input
                          type="number"
                          value={p.mnozstviPouzito}
                          min={0}
                          step={0.01}
                          onChange={e => {
                            const next = [...polozky]
                            next[idx] = { ...p, mnozstviPouzito: Number(e.target.value) }
                            setPolozky(next)
                          }}
                          className="w-20 text-right border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
                        />
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-white">{p.mnozstviPouzito}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{p.jednotka}</td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <input
                          type="text"
                          value={p.poznamka}
                          placeholder="Poznámka…"
                          onChange={e => {
                            const next = [...polozky]
                            next[idx] = { ...p, poznamka: e.target.value }
                            setPolozky(next)
                          }}
                          className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1B5E20] focus:bg-white dark:focus:bg-slate-600"
                        />
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-slate-400 italic">{p.poznamka}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canEdit ? (
                        <input
                          type="checkbox"
                          checked={p.zahrnuto}
                          onChange={e => {
                            const next = [...polozky]
                            next[idx] = { ...p, zahrnuto: e.target.checked }
                            setPolozky(next)
                          }}
                          className="cursor-pointer rounded border-gray-300 text-[#1B5E20] focus:ring-[#1B5E20]"
                          style={{ width: 18, height: 18 }}
                        />
                      ) : (
                        <span>{p.zahrnuto ? '☑' : '☐'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {canEdit && newRow !== null && (
                  <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                    <td className="px-4 py-3 text-gray-400 text-xs">—</td>
                    <td className="px-4 py-3">
                      <input
                        value={newRow.nazev}
                        onChange={e => setNewRow(r => r && { ...r, nazev: e.target.value })}
                        placeholder="Název *"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveNewRow(); if (e.key === 'Escape') setNewRow(null) }}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
                        style={{ minWidth: 140 }}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={newRow.mnozstvi}
                        onChange={e => setNewRow(r => r && { ...r, mnozstvi: e.target.value })}
                        min="0.01"
                        step="0.01"
                        className="w-20 text-right border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 dark:text-slate-600 text-xs">—</td>
                    <td className="px-4 py-3">
                      <input
                        value={newRow.jednotka}
                        onChange={e => setNewRow(r => r && { ...r, jednotka: e.target.value })}
                        className="w-16 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-400 dark:text-slate-600 text-xs">—</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={handleSaveNewRow}
                          disabled={savingNew || !newRow.nazev.trim()}
                          className="text-xs px-2 py-1 text-white bg-[#1B5E20] hover:bg-green-800 rounded disabled:opacity-50"
                        >
                          {savingNew ? '…' : 'Uložit'}
                        </button>
                        <button
                          onClick={() => setNewRow(null)}
                          className="text-xs px-2 py-1 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded"
                        >
                          Zrušit
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="divide-y divide-gray-100 dark:divide-slate-700 md:hidden">
            {canEdit && newRow !== null && (
              <div className="px-4 py-4 space-y-3 bg-blue-50/50 dark:bg-blue-900/10">
                <input
                  value={newRow.nazev}
                  onChange={e => setNewRow(r => r && { ...r, nazev: e.target.value })}
                  placeholder="Název *"
                  autoFocus
                  style={{ fontSize: 16 }}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[48px]"
                />
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Množství</label>
                    <input
                      type="number"
                      value={newRow.mnozstvi}
                      onChange={e => setNewRow(r => r && { ...r, mnozstvi: e.target.value })}
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      style={{ fontSize: 16 }}
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[48px]"
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Jednotka</label>
                    <input
                      value={newRow.jednotka}
                      onChange={e => setNewRow(r => r && { ...r, jednotka: e.target.value })}
                      style={{ fontSize: 16 }}
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[48px]"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveNewRow}
                    disabled={savingNew || !newRow.nazev.trim()}
                    className="flex-1 bg-[#1B5E20] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-50 min-h-[48px]"
                  >
                    {savingNew ? 'Ukládám…' : 'Uložit'}
                  </button>
                  <button
                    onClick={() => setNewRow(null)}
                    className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl py-3 font-medium text-sm min-h-[48px]"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            )}
            {polozky.map((p, idx) => (
              <div key={p.id} className={`px-4 py-4 ${!p.zahrnuto ? 'opacity-40' : ''}`}>
                {/* Top row: checkbox + name */}
                <div className="flex items-start gap-3 mb-3">
                  {canEdit ? (
                    <input
                      type="checkbox"
                      checked={p.zahrnuto}
                      onChange={e => {
                        const next = [...polozky]
                        next[idx] = { ...p, zahrnuto: e.target.checked }
                        setPolozky(next)
                      }}
                      className="mt-0.5 flex-shrink-0 cursor-pointer rounded border-gray-300 text-[#1B5E20] focus:ring-[#1B5E20]"
                      style={{ width: 24, height: 24, minHeight: 'unset', minWidth: 'unset' }}
                    />
                  ) : (
                    <span className="text-xl flex-shrink-0" style={{ minHeight: 'unset', minWidth: 'unset' }}>
                      {p.zahrnuto ? '☑' : '☐'}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{p.nazev}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      Plánováno: <strong>{p.planovanoMnozstvi} {p.jednotka}</strong>
                    </p>
                  </div>
                </div>

                {/* Použito row — large input on mobile */}
                {canEdit ? (
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-gray-600 dark:text-slate-400 font-medium w-16 flex-shrink-0">Použito:</span>
                    <input
                      type="number"
                      value={p.mnozstviPouzito}
                      min={0}
                      step={0.01}
                      inputMode="decimal"
                      onChange={e => {
                        const next = [...polozky]
                        next[idx] = { ...p, mnozstviPouzito: Number(e.target.value) }
                        setPolozky(next)
                      }}
                      style={{ fontSize: 20, fontWeight: 600, textAlign: 'center' }}
                      className="flex-1 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[52px]"
                    />
                    <span className="text-sm text-gray-500 dark:text-slate-400 flex-shrink-0">{p.jednotka}</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 dark:text-slate-300 mb-2">
                    Použito: <strong>{p.mnozstviPouzito} {p.jednotka}</strong>
                  </p>
                )}

                {/* Poznámka */}
                {canEdit ? (
                  <input
                    type="text"
                    value={p.poznamka}
                    placeholder="Poznámka k položce…"
                    onChange={e => {
                      const next = [...polozky]
                      next[idx] = { ...p, poznamka: e.target.value }
                      setPolozky(next)
                    }}
                    style={{ fontSize: 16 }}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1B5E20] focus:bg-white dark:focus:bg-slate-600 min-h-[48px]"
                  />
                ) : (
                  p.poznamka && <p className="text-xs text-gray-500 dark:text-slate-400 italic">{p.poznamka}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Fotodokumentace ─── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Fotodokumentace ({fotky.length}/20)</h2>
            {canEdit && fotky.length < 20 && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-sm font-medium text-primary dark:text-primary-light hover:underline disabled:opacity-50"
              >
                {uploading ? 'Nahrávám…' : '+ Přidat foto'}
              </button>
            )}
          </div>

          {/* Upload button */}
          {canEdit && (
            <>
              {/* Mobile: big camera button */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="md:hidden mx-4 mt-4 w-[calc(100%-2rem)] flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white rounded-xl py-4 text-base font-semibold disabled:opacity-50 transition-colors min-h-[56px]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {uploading ? 'Nahrávám…' : 'Přidat foto'}
              </button>
              {/* Desktop: drag & drop zone */}
              <div
                className="hidden md:block mx-4 mt-4 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl p-5 text-center cursor-pointer hover:border-green-400 dark:hover:border-green-600 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFotoUpload(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
              >
                <svg className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-400 dark:text-slate-500">Přetáhněte nebo klikněte pro foto</p>
                <p className="text-xs text-gray-300 dark:text-slate-600 mt-0.5">Max 5 MB, max 20 fotek</p>
              </div>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={e => handleFotoUpload(e.target.files)}
          />

          {fotky.length > 0 && (
            <div className="p-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {fotky.map(f => (
                <div key={f.id} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={f.popis || 'foto'}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-slate-700"
                  />
                  {canEdit && (
                    <button
                      onClick={() => handleFotoDelete(f.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {fotky.length === 0 && !canEdit && (
            <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-8">Žádné fotky</p>
          )}
        </div>

        {/* ─── Poznámka ─── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Poznámka</h2>
          {canEdit ? (
            <textarea
              value={poznamka}
              onChange={e => setPoznamka(e.target.value)}
              placeholder="Popis provedených prací, poznámky k instalaci…"
              rows={4}
              style={{ fontSize: 16 }}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          ) : (
            <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap min-h-[60px]">
              {poznamka || <span className="italic text-gray-400">Bez poznámky</span>}
            </p>
          )}
        </div>

        {/* ─── Podpis ─── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Podpis klienta</h2>

          {canEdit ? (
            <div className="space-y-4">
              {/* Toggle klientPritomen */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => {
                    const next = !klientPritomen
                    setKlientPritomen(next)
                    autoSave({ klientPritomen: next })
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${klientPritomen ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${klientPritomen ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Klient byl přítomen
                </span>
              </label>

              {klientPritomen ? (
                <SignatureCanvas
                  onChange={onSignatureChange}
                  existingDataUrl={podpisSvg}
                />
              ) : (
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-4">
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Klient nebyl při předání přítomen.
                    <br />
                    Protokol bude odeslán ke schválení bez podpisu.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {initial.klientPritomen ? 'Klient byl přítomen' : 'Klient nebyl přítomen'}
              </p>
              {initial.klientPritomen && initial.podpisSvg ? (
                <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white p-2" style={{ maxWidth: 400 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={initial.podpisSvg} alt="Podpis klienta" className="w-full" style={{ maxHeight: 160, objectFit: 'contain' }} />
                </div>
              ) : initial.klientPritomen ? (
                <p className="text-sm text-gray-400 italic">Podpis chybí</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ─── Sticky footer (mobile) — positioned ABOVE the BottomNav ─── */}
      {canEdit && stav !== 'PODPISAN' && (
        <div
          className="fixed left-0 right-0 z-40 bg-[#0D1A0E] border-t border-green-900/50 md:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))', padding: '10px 16px' }}
        >
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-white/10 text-white rounded-xl py-3.5 font-medium text-sm disabled:opacity-50 min-h-[52px]"
            >
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
            <button
              onClick={() => setConfirmPodpsat(true)}
              disabled={saving || !canSubmit}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3.5 font-medium text-sm disabled:opacity-50 min-h-[52px]"
            >
              Odeslat ke schválení
            </button>
          </div>
          {submitBlockReason && (
            <p className="text-xs text-amber-400 text-center mt-2">{submitBlockReason}</p>
          )}
        </div>
      )}

      {/* Technik editing a submitted protocol */}
      {canEdit && stav === 'PODPISAN' && !isManager && (
        <div
          className="fixed left-0 right-0 z-40 bg-[#0D1A0E] border-t border-green-900/50 md:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))', padding: '10px 16px' }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-white/10 text-white rounded-xl py-3.5 font-medium text-sm disabled:opacity-50 min-h-[52px]"
          >
            {saving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        </div>
      )}

      {/* Manager approve buttons mobile */}
      {isManager && stav === 'PODPISAN' && (
        <div
          className="fixed left-0 right-0 z-40 bg-[#0D1A0E] border-t border-green-900/50 md:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))', padding: '10px 16px' }}
        >
          <div className="flex gap-3">
            <button
              onClick={() => setOdmitnutiModal(true)}
              disabled={saving}
              className="flex-1 bg-red-600 text-white rounded-xl py-3.5 font-medium text-sm min-h-[52px]"
            >
              Odmítnout
            </button>
            <button
              onClick={() => setConfirmSchvalit(true)}
              disabled={saving}
              className="flex-1 bg-green-500 text-white rounded-xl py-3.5 font-medium text-sm min-h-[52px]"
            >
              Schválit
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── HeaderActions ────────────────────────────────────────────────────────────

function HeaderActions({
  predavakId, zakazkaId, vyuctovani, stav, canEdit, isTechnik, isManager, isOwnTechnik, saving, canSubmit, submitBlockReason,
  onSave, onPodepsat, onSchvalit, onOdmitnout, onReopen, onDelete,
}: {
  predavakId: string
  zakazkaId: string
  vyuctovani: { id: string; cislo: string } | null
  stav: PredavakStav
  canEdit: boolean
  isTechnik: boolean
  isManager: boolean
  isOwnTechnik: boolean
  saving: boolean
  canSubmit: boolean
  submitBlockReason: string | null
  onSave: () => void
  onPodepsat: () => void
  onSchvalit: () => void
  onOdmitnout: () => void
  onReopen: () => void
  onDelete: () => void
}) {
  const showPdf = stav === 'SCHVALEN' && (!isTechnik || isOwnTechnik)

  if (isManager && stav === 'PODPISAN') {
    return (
      <>
        <button
          onClick={onDelete}
          disabled={saving}
          className="text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Smazat
        </button>
        {canEdit && (
          <button
            onClick={onSave}
            disabled={saving}
            className="text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        )}
        <button
          onClick={onOdmitnout}
          disabled={saving}
          className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Odmítnout
        </button>
        <button
          onClick={onSchvalit}
          disabled={saving}
          className="text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Schválit
        </button>
      </>
    )
  }

  if (canEdit && stav === 'PODPISAN') {
    return (
      <button
        onClick={onSave}
        disabled={saving}
        className="text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {saving ? 'Ukládám…' : 'Uložit změny'}
      </button>
    )
  }

  if (canEdit && (stav === 'ROZPRACOVAN' || stav === 'ODMITNUTO')) {
    return (
      <>
        {isManager && (
          <button
            onClick={onDelete}
            disabled={saving}
            className="text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Smazat
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className="text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        {(isTechnik ? isOwnTechnik : true) && (
          <span title={submitBlockReason ?? undefined}>
            <button
              onClick={onPodepsat}
              disabled={saving || !canSubmit}
              className="text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Odeslat ke schválení
            </button>
          </span>
        )}
      </>
    )
  }

  if (showPdf) {
    return (
      <>
        {/* Schválený protokol drží skladové výdeje a vyúčtování — mazat se smí až po vrácení k úpravám */}
        {isManager && (
          <button
            onClick={onReopen}
            disabled={saving}
            className="text-sm font-medium text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Vrátit k úpravám
          </button>
        )}
        {!isTechnik && vyuctovani && (
          <a
            href={`/zakazky/${zakazkaId}/vyuctovani/${vyuctovani.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#1B5E20] hover:bg-green-800 px-4 py-2 rounded-lg transition-colors"
          >
            Vyúčtování {vyuctovani.cislo}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}
        <a
          href={`/api/predavaky/${predavakId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Stáhnout PDF
        </a>
        <button
          title="Připravujeme"
          disabled
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 px-4 py-2 rounded-lg cursor-not-allowed opacity-60"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Odeslat klientovi
        </button>
      </>
    )
  }

  return null
}

