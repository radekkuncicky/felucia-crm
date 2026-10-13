import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPerms, forbidden } from '@/lib/permissions'
import { kpiPristup, nactiNastaveni } from '@/lib/kpi'
import { isKpiKod } from '@/lib/kpi/registry'
import { logAudit } from '@/lib/audit'

/** Cíle, zapnutí a pořadí KPI vedení (jen modulKpi + oprávnění kpi). */
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  if (!(await kpiPristup(orgId, getPerms(session.user)))) return forbidden()

  const body = await req.json().catch(() => null)
  const polozky: unknown[] = Array.isArray(body?.polozky) ? body.polozky : []
  const data: { kod: string; aktivni: boolean; cil: number | null; poradi: number }[] = []
  for (const p of polozky) {
    const r = p as Record<string, unknown>
    if (!isKpiKod(r.kod)) return NextResponse.json({ error: 'Neznámé KPI' }, { status: 400 })
    const cil = r.cil === null || r.cil === '' || r.cil === undefined ? null : Number(r.cil)
    if (cil !== null && (!Number.isFinite(cil) || Math.abs(cil) > 1e12)) {
      return NextResponse.json({ error: 'Neplatný cíl' }, { status: 400 })
    }
    data.push({ kod: r.kod, aktivni: r.aktivni === true, cil, poradi: Number.isInteger(r.poradi) ? (r.poradi as number) : 0 })
  }
  if (!data.length) return NextResponse.json({ error: 'Nic k uložení' }, { status: 400 })

  const db = orgPrisma(orgId)
  await db.$transaction(data.map(d => db.kpiNastaveni.upsert({
    where: { orgId_kod: { orgId, kod: d.kod } },
    create: { orgId, ...d },
    update: { aktivni: d.aktivni, cil: d.cil, poradi: d.poradi },
  })))
  await logAudit({
    orgId, userId: session.user.id, typAkce: 'UPDATE', typZaznamu: 'KpiNastaveni',
    zaznamId: orgId, zaznamNazev: 'KPI vedení', zmeny: { polozky: data },
  })
  return NextResponse.json({ nastaveni: await nactiNastaveni(db, orgId) })
}
