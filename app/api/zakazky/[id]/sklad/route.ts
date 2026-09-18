import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { stavProduktu, zkontrolujMinimum } from '@/lib/sklad'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { polozkaId, mnozstvi, nakupniCena, poznamka } = await req.json()

  if (!polozkaId || !mnozstvi || nakupniCena === undefined) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  // Verify polozka belongs to this zakazka & org
  const polozka = await db.zakazkaPolozka.findFirst({
    where: { id: polozkaId, zakazkaId: params.id, zakazka: { orgId } },
  })
  if (!polozka) return NextResponse.json({ error: 'Položka nenalezena' }, { status: 404 })

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Zakázka nenalezena' }, { status: 404 })

  const shouldAdvanceStav = zakazka.stav === 'PRIRAZENA' || zakazka.stav === 'NOVA'

  await db.$transaction([
    db.skladPohyb.create({
      data: {
        orgId,
        zakazkaId: params.id,
        polozkaId,
        productId: polozka.productId,
        typ: 'REZERVACE',
        nazev: polozka.nazev,
        mnozstvi,
        nakupniCena,
        duvod: poznamka ?? null,
        vytvorilId: session.user.id,
      },
    }),
    db.zakazkaPolozka.update({
      where: { id: polozkaId },
      data: { stav: 'NASKLADNENO', nakupniCena },
    }),
    db.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'ZakazkaPolozka',
        zaznamId: polozkaId,
        zaznamNazev: polozka.nazev,
        zmeny: { stav: 'NASKLADNENO', nakupniCena },
      },
    }),
    ...(shouldAdvanceStav ? [
      db.zakazka.update({
        where: { id: params.id },
        data: { stav: 'V_REALIZACI' },
      }),
      db.auditLog.create({
        data: {
          orgId,
          userId: session.user.id,
          typAkce: 'UPDATE',
          typZaznamu: 'Zakazka',
          zaznamId: params.id,
          zaznamNazev: zakazka.nazev,
          zmeny: { from: zakazka.stav, to: 'V_REALIZACI', duvod: 'První naskladnění' },
        },
      }),
    ] : []),
  ])

  // Dostupnost po rezervaci — UI ji ukáže; rezervace nad dostupné množství se
  // neblokuje (materiál se rezervuje dřív, než dorazí), jen se hlásí.
  let stav = null
  if (polozka.productId) {
    stav = await stavProduktu(db, orgId, polozka.productId)
    await zkontrolujMinimum(orgId, polozka.productId)
  }

  return NextResponse.json({ ok: true, zakazkaNovyStav: shouldAdvanceStav ? 'V_REALIZACI' : null, stav })
}
