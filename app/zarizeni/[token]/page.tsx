import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { notFound } from 'next/navigation'

const TYP_LABELS: Record<string, string> = {
  TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  KLIMATIZACE: 'Klimatizace',
  REKUPERACE: 'Rekuperace',
  PODLAHOVE_VYTAPENI: 'Podlahové vytápění',
  VZDUCHOTECHNIKA: 'Vzduchotechnika',
  OHREV_TV: 'Ohřev TUV',
  JINE: 'Jiné',
}

const NAVSTEVA_TYP_LABELS: Record<string, string> = {
  PLANOVANY_SERVIS: 'Plánovaný servis',
  PORUCHA: 'Porucha',
  ZARUCNI_OPRAVA: 'Záruční oprava',
  POZARUCNI_OPRAVA: 'Pozáruční oprava',
  UVEDENI_DO_PROVOZU: 'Uvedení do provozu',
  KONTROLA: 'Kontrola',
}

const STAV_LABELS: Record<string, string> = {
  PLANOVANA: 'Plánovaná',
  POTVRZENA: 'Potvrzená',
  PROBIHA: 'Probíhá',
  DOKONCENA: 'Dokončená',
  ZRUSENA: 'Zrušená',
  PRESLA: 'Prošlá',
}

const STAV_COLORS: Record<string, string> = {
  PLANOVANA: 'bg-blue-100 text-blue-700',
  POTVRZENA: 'bg-teal-100 text-teal-700',
  PROBIHA: 'bg-yellow-100 text-yellow-700',
  DOKONCENA: 'bg-green-100 text-green-700',
  ZRUSENA: 'bg-red-100 text-red-700',
  PRESLA: 'bg-orange-100 text-orange-700',
}

function zarukaStatus(zarukaDo: Date | null) {
  if (!zarukaDo) return null
  const diff = (zarukaDo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return { label: 'Záruka vypršela', cls: 'text-red-600 font-semibold' }
  if (diff < 90) return { label: `Vyprší za ${Math.ceil(diff)} dní`, cls: 'text-orange-600 font-semibold' }
  return { label: 'V záruce', cls: 'text-green-600 font-semibold' }
}

export default async function PublicZarizeniPage({ params }: { params: { token: string } }) {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '')

  let zarizeniId: string
  try {
    const { payload } = await jwtVerify(params.token, secret)
    zarizeniId = payload.zarizeniId as string
  } catch {
    notFound()
  }

  const zarizeni = await prisma.zarizeni.findFirst({
    where: { id: zarizeniId, qrToken: params.token },
    include: {
      klient: { select: { jmeno: true, prijmeni: true, telefon: true, email: true, ulice: true, mesto: true, psc: true } },
      servisniKontrakty: {
        where: { aktivni: true },
        take: 1,
        select: { nazev: true, typ: true, intervalMesicu: true, zacatek: true, konec: true },
      },
      servisniNavstevy: {
        orderBy: { planovanyTermin: 'desc' },
        take: 5,
        include: { technik: { select: { jmeno: true } } },
      },
    },
  })

  if (!zarizeni) notFound()

  const klient = zarizeni.klient
  const adresaKlienta = [klient.ulice, [klient.mesto, klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const mapsUrl = adresaKlienta ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresaKlienta)}` : null
  const kontrakt = zarizeni.servisniKontrakty[0] ?? null
  const ws = zarukaStatus(zarizeni.zarukaDo)
  const now = new Date()

  const SERVIS_TYP_LABELS: Record<string, string> = {
    ROCNI: 'Roční',
    POLOLETNI: 'Pololetní',
    DVOULETNI: 'Dvouletní',
    JEDNOURAZOVY: 'Jednorázový',
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        .title-font { font-family: 'Space Grotesk', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D4C8, #7B2FBE)' }}>
          <span className="text-white text-xs font-bold">F</span>
        </div>
        <span className="text-xs text-gray-400 font-medium">Felucia CRM</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Device header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-semibold">
                    {TYP_LABELS[zarizeni.typ] ?? zarizeni.typ}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${zarizeni.aktivni ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {zarizeni.aktivni ? 'Aktivní' : 'Neaktivní'}
                  </span>
                </div>
                <h1 className="title-font text-xl font-bold text-gray-900 leading-tight">{zarizeni.nazev}</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Zařízení details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Zařízení</h2>
          </div>
          <div className="p-5 space-y-3">
            {zarizeni.vyrobniCislo && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Výrobní číslo</p>
                <p className="text-sm font-semibold text-gray-800 font-mono">{zarizeni.vyrobniCislo}</p>
              </div>
            )}
            {zarizeni.datumInstalace && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Datum instalace</p>
                <p className="text-sm font-semibold text-gray-800">{zarizeni.datumInstalace.toLocaleDateString('cs-CZ')}</p>
              </div>
            )}
            {zarizeni.zarukaDo && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Záruka do</p>
                <p className={`text-sm font-semibold ${ws?.cls ?? 'text-gray-800'}`}>
                  {zarizeni.zarukaDo.toLocaleDateString('cs-CZ')}
                  {ws && <span className="ml-2 text-xs">({ws.label})</span>}
                </p>
              </div>
            )}
            {zarizeni.poznamka && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Technická poznámka</p>
                <p className="text-sm text-gray-700 leading-relaxed">{zarizeni.poznamka}</p>
              </div>
            )}
          </div>
        </div>

        {/* Klient */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Klient</h2>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Jméno</p>
              <p className="text-sm font-semibold text-gray-800">{klient.jmeno} {klient.prijmeni}</p>
            </div>
            {adresaKlienta && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Adresa</p>
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-cyan-600 underline underline-offset-2">
                    {adresaKlienta}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-gray-800">{adresaKlienta}</p>
                )}
              </div>
            )}
            {klient.telefon && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Telefon</p>
                <a href={`tel:${klient.telefon}`} className="text-sm font-semibold text-cyan-600">
                  {klient.telefon}
                </a>
              </div>
            )}
            {klient.email && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Email</p>
                <a href={`mailto:${klient.email}`} className="text-sm font-semibold text-cyan-600">
                  {klient.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Servisní kontrakt */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Servisní kontrakt</h2>
          </div>
          <div className="p-5">
            {kontrakt ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Název</p>
                  <p className="text-sm font-semibold text-gray-800">{kontrakt.nazev}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Typ</p>
                    <p className="text-sm font-semibold text-gray-800">{SERVIS_TYP_LABELS[kontrakt.typ] ?? kontrakt.typ}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Interval</p>
                    <p className="text-sm font-semibold text-gray-800">každých {kontrakt.intervalMesicu} měs.</p>
                  </div>
                </div>
                {kontrakt.konec && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Platí do</p>
                    <p className="text-sm font-semibold text-gray-800">{new Date(kontrakt.konec).toLocaleDateString('cs-CZ')}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Bez servisního kontraktu</p>
            )}
          </div>
        </div>

        {/* Historie servisů */}
        {zarizeni.servisniNavstevy.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Historie servisů</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {zarizeni.servisniNavstevy.map(n => (
                <div key={n.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800">
                          {new Date(n.planovanyTermin).toLocaleDateString('cs-CZ')}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAV_COLORS[n.stav] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STAV_LABELS[n.stav] ?? n.stav}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{NAVSTEVA_TYP_LABELS[n.typ] ?? n.typ}{n.technik ? ` · ${n.technik.jmeno}` : ''}</p>
                      {n.zprava && (
                        <p className="text-sm text-gray-600 mt-1.5 leading-relaxed line-clamp-2">{n.zprava.slice(0, 100)}{n.zprava.length > 100 ? '…' : ''}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">Powered by <span className="font-semibold" style={{ color: '#00D4C8' }}>Felucia CRM</span></p>
          <p className="text-xs text-gray-300 mt-1">{now.toLocaleString('cs-CZ')}</p>
        </div>

      </div>
    </div>
  )
}
