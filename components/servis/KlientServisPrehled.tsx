import Link from 'next/link'
import { formatDate } from '@/lib/format'
import { ZARIZENI_TYP_LABEL } from '@/lib/calendarEvents'
import { stavLabel, stavColor, jeProsla, typLabel, jeUrgentni } from '@/lib/servisStav'

// Tab „Servis" na kartě klienta (server component, jen odkazy): zařízení se
// smlouvami, servisní zakázky, CTA. Plná správa (QR, nová smlouva, detail
// kontraktu) je v portfoliu — sem vede „Otevřít v portfoliu".

export interface KlientServisData {
  klientId: string
  zarizeni: {
    id: string
    nazev: string
    typ: string
    vyrobniCislo: string | null
    zarukaDo: string | null
    aktivni: boolean
    kontrakty: { id: string; nazev: string; cisloKontraktu: string | null; aktivni: boolean; intervalMesicu: number }[]
  }[]
  zakazky: {
    id: string
    cislo: string | null
    typ: string
    stav: string
    popis: string | null
    priorita: string
    planovanyTermin: string | null
    skutecnyTermin: string | null
    zarizeniNazev: string | null
    technikJmeno: string | null
  }[]
  canCreate: boolean
}

export default function KlientServisPrehled({ klientId, zarizeni, zakazky, canCreate }: KlientServisData) {
  const otevrene = zakazky.filter(z => ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'CEKA', 'REKLAMACE'].includes(z.stav))
  const historie = zakazky.filter(z => !otevrene.includes(z))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {zarizeni.filter(z => z.aktivni).length} zařízení · {zarizeni.reduce((n, z) => n + z.kontrakty.filter(k => k.aktivni).length, 0)} aktivních smluv · {otevrene.length} otevřených zakázek
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/servis/portfolio?klient=${klientId}`} className="text-sm text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700">
            Otevřít v portfoliu
          </Link>
          {canCreate && (
            <Link href={`/servis/nova?klientId=${klientId}`} className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-1.5">
              + Nová servisní akce
            </Link>
          )}
        </div>
      </div>

      {/* Zařízení */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Zařízení a smlouvy</h3>
        </div>
        {zarizeni.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 dark:text-slate-500 text-center">Žádné zařízení v evidenci — přidej ho v portfoliu nebo při nové servisní akci.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {zarizeni.map(z => (
              <div key={z.id} className={`px-5 py-3 flex flex-wrap items-center gap-3 ${z.aktivni ? '' : 'opacity-60'}`}>
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-gray-900 dark:text-white">{z.nazev}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {ZARIZENI_TYP_LABEL[z.typ] ?? z.typ}
                    {z.vyrobniCislo && ` · SN ${z.vyrobniCislo}`}
                    {z.zarukaDo && ` · záruka do ${formatDate(z.zarukaDo)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {z.kontrakty.length === 0 && <span className="text-xs text-gray-400 dark:text-slate-500 italic">bez smlouvy</span>}
                  {z.kontrakty.map(k => (
                    <span key={k.id} className={`text-xs px-2 py-0.5 rounded-full ${k.aktivni ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                      {k.cisloKontraktu ? `${k.cisloKontraktu} · ` : ''}{k.nazev}{!k.aktivni ? ' (ukončeno)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zakázky */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Servisní zakázky</h3>
        </div>
        {zakazky.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 dark:text-slate-500 text-center">Zatím žádná servisní zakázka.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {[...otevrene, ...historie].map(z => {
              const prosla = jeProsla(z.stav, z.planovanyTermin)
              const datum = z.skutecnyTermin ?? z.planovanyTermin
              return (
                <Link key={z.id} href={`/servis/zakazky/${z.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <span className={`w-20 text-sm flex-shrink-0 ${prosla ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-slate-300'}`}>
                    {datum ? formatDate(datum) : <span className="italic text-gray-400">bez termínu</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {z.cislo && <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{z.cislo}</span>}
                      <span className="text-sm text-gray-900 dark:text-white truncate">{z.popis ?? typLabel(z.typ)}</span>
                      {jeUrgentni(z.priorita) && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Urgentní</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {[z.popis ? typLabel(z.typ) : null, z.zarizeniNazev, z.technikJmeno].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${stavColor(z.stav)}`}>{stavLabel(z.stav)}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
