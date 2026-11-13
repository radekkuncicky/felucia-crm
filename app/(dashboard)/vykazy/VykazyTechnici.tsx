'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { formatDate, formatKc } from '@/lib/format'
import type { PrehledTechnik } from '@/lib/vykazPrace'

const h = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')} h`
const sazbaText = (v: number | null, jednotka: string) => (v == null ? '—' : `${formatKc(v)}/${jednotka}`)
const parse = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')))

function SazbyForm({ t, onDone }: { t: PrehledTechnik; onDone: () => void }) {
  const router = useRouter()
  const [hod, setHod] = useState(t.sazbaHodina != null ? String(t.sazbaHodina).replace('.', ',') : '')
  const [km, setKm] = useState(t.sazbaKm != null ? String(t.sazbaKm).replace('.', ',') : '')
  const [saving, setSaving] = useState(false)

  async function uloz(e: React.FormEvent) {
    e.preventDefault()
    const sazbaHodina = parse(hod); const sazbaKm = parse(km)
    if ((sazbaHodina != null && !Number.isFinite(sazbaHodina)) || (sazbaKm != null && !Number.isFinite(sazbaKm))) {
      toast.error('Sazby zadej jako čísla')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/vykazy/sazby', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: t.userId, sazbaHodina, sazbaKm }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Sazby se nepodařilo uložit'); return }
      toast.success(j.doplneno ? `Sazby uloženy a doplněny do ${j.doplneno} otevřených záznamů` : 'Sazby uloženy — platí pro nové záznamy')
      onDone()
      router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={uloz} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end bg-surface-2 rounded-lg p-3">
      <Field label="Kč za hodinu">
        <Input kind="castka" value={hod} onChange={e => setHod(e.target.value)} placeholder="např. 450" />
      </Field>
      <Field label="Kč za km">
        <Input kind="castka" value={km} onChange={e => setKm(e.target.value)} placeholder="např. 8" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>Uložit</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Zrušit</Button>
      </div>
      <p className="sm:col-span-3 text-xs text-muted">
        Nová sazba platí pro nové zápisy a doplní se do otevřených záznamů, které sazbu ještě nemají. Už zapsané sazby ani uzavřené výkazy se nemění.
      </p>
    </form>
  )
}

/** Technici: sazby, otevřeno k fakturaci, rozbalitelné záznamy s odkazem na zakázku / servis. */
export default function VykazyTechnici({ technici, canEditSazby }: { technici: PrehledTechnik[]; canEditSazby: boolean }) {
  const [editId, setEditId] = useState<string | null>(null)

  if (technici.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-line px-4 py-6 text-sm text-muted text-center">
        Zatím tu nejsou žádní technici. Přidáš je v Nastavení → Uživatelé (role Technik).
      </div>
    )
  }

  return (
    <section className="bg-surface rounded-xl border border-line overflow-hidden">
      <div className="px-4 py-3 border-b border-line">
        <h2 className="text-sm font-semibold text-fg">Technici</h2>
        <p className="text-xs text-muted">Otevřeno = zapsáno, ale technik to ještě neuzavřel do výkazu.</p>
      </div>
      <div className="divide-y divide-line">
        {technici.map(t => {
          const chybi = t.sazbaHodina == null || t.sazbaKm == null
          return (
            <div key={t.userId} className="px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <div className="min-w-[10rem]">
                  <p className="font-medium text-fg">{t.jmeno}{!t.aktivni && <span className="text-xs text-muted"> (neaktivní)</span>}</p>
                  <p className={`text-xs ${chybi ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-muted'}`}>
                    {chybi && !t.sazbaHodina && !t.sazbaKm ? 'Sazby nenastavené' : `${sazbaText(t.sazbaHodina, 'h')} · ${sazbaText(t.sazbaKm, 'km')}`}
                  </p>
                </div>
                <div className="text-sm text-fg">
                  {t.otevreno.pocet > 0 ? (
                    <>
                      <span className="font-semibold">{formatKc(t.otevreno.castka)}</span>
                      <span className="text-muted"> · {h(t.otevreno.hodiny)} · {t.otevreno.km} km{t.otevrenoOd ? ` · od ${formatDate(t.otevrenoOd)}` : ''}</span>
                      {t.otevreno.chybiSazba > 0 && <span className="text-amber-700 dark:text-amber-400"> · {t.otevreno.chybiSazba}× čeká na sazbu</span>}
                    </>
                  ) : <span className="text-muted">nic otevřeného</span>}
                </div>
                <div className="text-xs text-muted sm:ml-auto">
                  {t.posledni
                    ? <>Poslední výkaz č. {t.posledni.cislo} · {formatDate(t.posledni.vytvoreno)} · {formatKc(t.posledni.castka)}</>
                    : 'Zatím žádný uzavřený výkaz'}
                </div>
                {canEditSazby && editId !== t.userId && (
                  <Button size="sm" variant={chybi ? 'primary' : 'secondary'} onClick={() => setEditId(t.userId)}>
                    {chybi ? 'Nastavit sazby' : 'Sazby'}
                  </Button>
                )}
              </div>

              {editId === t.userId && <SazbyForm t={t} onDone={() => setEditId(null)} />}

              {t.zaznamy.length > 0 && (
                <details className="group">
                  <summary className="text-sm text-primary-dark dark:text-primary cursor-pointer list-none hover:underline">
                    <span className="group-open:hidden">Zobrazit otevřené záznamy ({t.zaznamy.length})</span>
                    <span className="hidden group-open:inline">Skrýt záznamy</span>
                  </summary>
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted uppercase">
                          <th className="py-1.5 pr-3 font-semibold">Datum</th>
                          <th className="py-1.5 pr-3 font-semibold">Zakázka</th>
                          <th className="py-1.5 pr-3 font-semibold">Co</th>
                          <th className="py-1.5 pr-3 font-semibold text-right">Hodiny</th>
                          <th className="py-1.5 pr-3 font-semibold text-right">Km</th>
                          <th className="py-1.5 font-semibold text-right">Částka</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.zaznamy.map(z => (
                          <tr key={z.id} className="border-t border-line align-top">
                            <td className="py-1.5 pr-3 whitespace-nowrap text-fg">{formatDate(z.datum)}</td>
                            <td className="py-1.5 pr-3">
                              <Link
                                href={z.zakazka.druh === 'SERVIS' ? `/servis/zakazky/${z.zakazka.id}` : `/zakazky/${z.zakazka.id}`}
                                className="text-fg hover:underline"
                              >
                                <span className="font-medium">{z.zakazka.cislo}</span> <span className="text-muted">{z.zakazka.nazev}</span>
                              </Link>
                            </td>
                            <td className="py-1.5 pr-3 text-fg">
                              {z.typ === 'POLOZKA' ? z.popis : 'Výjezd'}
                              {z.poznamka && <span className="block text-xs text-muted">{z.poznamka}</span>}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-fg">{z.typ === 'VYJEZD' ? h(z.hodiny) : '—'}</td>
                            <td className="py-1.5 pr-3 text-right text-fg">{z.typ === 'VYJEZD' ? z.km : '—'}</td>
                            <td className="py-1.5 text-right whitespace-nowrap text-fg">
                              {z.chybiSazba ? <span className="text-amber-700 dark:text-amber-400">čeká na sazbu</span> : formatKc(z.castka)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
