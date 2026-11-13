import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { canEditSazbyVykazu, getPerms } from '@/lib/permissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatKc } from '@/lib/format'
import { VYKAZ_INCLUDE, num, prehledTechniku } from '@/lib/vykazPrace'
import VykazyTechnici from './VykazyTechnici'
import UzavreneVykazy from './UzavreneVykazy'

export const metadata = { title: 'Práce techniků' }

const h = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')} h`

/** Přehled výkazů práce techniků pro vedení: otevřeno k fakturaci, sazby, uzavřené výkazy s PDF. */
export default async function VykazyPage({ searchParams }: { searchParams: { mesic?: string; technik?: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  const perms = getPerms(session.user)
  if (!perms.financeNakupky) redirect('/dashboard')

  const { orgId } = session.user
  const db = orgPrisma(orgId)

  const now = new Date()
  const zacatekMesice = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const mesic = /^\d{4}-\d{2}$/.test(searchParams.mesic ?? '') ? searchParams.mesic! : null
  const technikFiltr = searchParams.technik || null
  const mesicOd = mesic ? new Date(`${mesic}-01T00:00:00.000Z`) : null
  const mesicDo = mesicOd ? new Date(Date.UTC(mesicOd.getUTCFullYear(), mesicOd.getUTCMonth() + 1, 1)) : null

  const userSelect = { id: true, jmeno: true, aktivni: true, sazbaHodina: true, sazbaKm: true } as const
  const [technici, otevrene, vsechnyFakturace, fakturace] = await Promise.all([
    db.user.findMany({ where: { orgId, aktivni: true, role: { in: ['TECHNIK', 'HLAVNI_TECHNIK'] } }, select: userSelect }),
    db.vykazPrace.findMany({
      where: { orgId, fakturaceId: null },
      include: { ...VYKAZ_INCLUDE, user: { select: userSelect } },
    }),
    db.vykazFakturace.findMany({ where: { orgId }, select: { userId: true, cislo: true, obdobiDo: true, vytvoreno: true, castkaCelkem: true } }),
    db.vykazFakturace.findMany({
      where: {
        orgId,
        ...(technikFiltr ? { userId: technikFiltr } : {}),
        ...(mesicOd && mesicDo ? { vytvoreno: { gte: mesicOd, lt: mesicDo } } : {}),
      },
      include: { user: { select: { jmeno: true } } },
      orderBy: { vytvoreno: 'desc' },
      take: 100,
    }),
  ])

  const prehled = prehledTechniku(technici, otevrene, vsechnyFakturace)
  const otevrenoCelkem = prehled.reduce(
    (a, t) => ({ hodiny: a.hodiny + t.otevreno.hodiny, km: a.km + t.otevreno.km, castka: a.castka + t.otevreno.castka }),
    { hodiny: 0, km: 0, castka: 0 },
  )
  const tentoMesic = vsechnyFakturace.filter(f => f.vytvoreno >= zacatekMesice)
  const bezSazby = prehled.filter(t => t.aktivni && (t.sazbaHodina == null || t.sazbaKm == null))

  // měsíce pro filtr: od prvního výkazu po dnešek (max 24)
  const mesice: string[] = []
  const prvni = vsechnyFakturace.reduce<Date | null>((m, f) => (!m || f.vytvoreno < m ? f.vytvoreno : m), null)
  for (let d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)); mesice.length < 24; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))) {
    mesice.push(d.toISOString().slice(0, 7))
    if (!prvni || d <= prvni) break
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Práce techniků"
        description="Hodiny, km a položky, které technici zapisují v appce Felucia Technik. Sazby jsou jejich odměna (náklad firmy), bez DPH."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase text-muted">Otevřeno k fakturaci</p>
          <p className="text-2xl font-bold text-fg mt-1">{formatKc(otevrenoCelkem.castka)}</p>
          <p className="text-sm text-muted">{h(otevrenoCelkem.hodiny)} · {otevrenoCelkem.km} km</p>
        </div>
        <div className="bg-surface rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase text-muted">Uzavřeno tento měsíc</p>
          <p className="text-2xl font-bold text-fg mt-1">{formatKc(tentoMesic.reduce((a, f) => a + num(f.castkaCelkem), 0))}</p>
          <p className="text-sm text-muted">{tentoMesic.length} {tentoMesic.length === 1 ? 'výkaz' : tentoMesic.length >= 2 && tentoMesic.length <= 4 ? 'výkazy' : 'výkazů'}</p>
        </div>
        <div className={`rounded-xl border p-4 ${bezSazby.length ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-surface border-line'}`}>
          <p className="text-xs font-semibold uppercase text-muted">Sazby</p>
          {bezSazby.length ? (
            <>
              <p className="text-base font-semibold text-fg mt-1">Chybí: {bezSazby.map(t => t.jmeno).join(', ')}</p>
              <p className="text-sm text-muted">Bez sazby technik zapisuje, ale výkaz neuzavře.</p>
            </>
          ) : (
            <p className="text-base font-semibold text-fg mt-1">Všichni technici mají sazby</p>
          )}
        </div>
      </div>

      <VykazyTechnici technici={prehled} canEditSazby={canEditSazbyVykazu(perms)} />

      <UzavreneVykazy
        vykazy={fakturace.map(f => ({
          id: f.id, cislo: f.cislo, jmeno: f.user.jmeno, userId: f.userId,
          obdobiOd: f.obdobiOd.toISOString().slice(0, 10), obdobiDo: f.obdobiDo.toISOString().slice(0, 10),
          hodiny: num(f.hodinyCelkem), km: f.kmCelkem, castka: num(f.castkaCelkem), vytvoreno: f.vytvoreno.toISOString(),
        }))}
        mesice={mesice}
        mesic={mesic}
        technici={prehled.map(t => ({ id: t.userId, jmeno: t.jmeno }))}
        technik={technikFiltr}
      />
    </div>
  )
}
