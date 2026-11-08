import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPerms, forbidden } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { abraKonfigurace, AbraChyba } from '@/lib/abra/flexi'
import { nazevZakazkyAbra, odesliZakazkuDoAbry, CISLO_ZAKAZKY_ABRA } from '@/lib/abra/zakazka'
import { nazevKlienta } from '@/lib/abra/adresar'

/**
 * POST { dryRun } — založí zakázku (i s odběratelem) v ABRA Flexi.
 * Jen org napojená na Flexi (ABRA_FLEXI_ORG_SLUG) a jen s nastaveniOrg (ADMIN/JEDNATEL).
 * dryRun = náhled nanečisto, nic se neuloží ani ve Flexi, ani u nás.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()

  const k = abraKonfigurace()
  if (!k || session.user.orgSlug !== k.orgSlug) return NextResponse.json({ error: 'ABRA není napojená' }, { status: 404 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const z = await db.zakazka.findFirst({
    where: { id: params.id, orgId },
    select: { id: true, cislo: true, technologie: true, klient: true },
  })
  if (!z) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!CISLO_ZAKAZKY_ABRA.test(z.cislo)) {
    return NextResponse.json({ error: `Do ABRA jdou jen zakázky s číslem ve tvaru RR-NNN (tahle má ${z.cislo}).` }, { status: 422 })
  }

  const body = await req.json().catch(() => ({})) as { dryRun?: unknown }
  const dryRun = body.dryRun !== false
  const zakazka = { cislo: z.cislo, technologie: z.technologie, klient: z.klient }

  try {
    const r = await odesliZakazkuDoAbry(k, zakazka, { dryRun })
    const abraId = r.abraId && /^\d+$/.test(r.abraId) ? Number(r.abraId) : null

    if (!dryRun) {
      await db.zakazka.update({ where: { id: z.id }, data: { abraZakazkaId: abraId, abraOdeslano: new Date() } })
      await logAudit({
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Zakazka',
        zaznamId: z.id,
        zaznamNazev: z.cislo,
        zmeny: { abra: r.stav, abraId, adresarId: r.adresarId, adresarZalozen: r.adresarZalozen },
      })
    }

    return NextResponse.json({
      stav: r.stav,
      dryRun,
      kod: z.cislo,
      nazev: nazevZakazkyAbra(zakazka),
      odberatel: nazevKlienta(z.klient),
      adresarNovy: r.adresarZalozen,
      existovala: r.existovala,
      abraId,
    })
  } catch (e) {
    if (e instanceof AbraChyba) return NextResponse.json({ error: e.message }, { status: 502 })
    throw e
  }
}
