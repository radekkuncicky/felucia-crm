import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'

/**
 * Podklad pro modal „Objednat u dodavatele": položky zakázky (výchozí výběr = Čeká)
 * s dodavateli jejich produktu (hlavní první) + seznam všech aktivních dodavatelů.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad !== 'PLNY') return forbidden()
  if (!(await canAccessZakazka(session.user, perms, params.id))) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const [zakazka, polozky, dodavatele] = await Promise.all([
    db.zakazka.findFirst({ where: { id: params.id, orgId }, select: { montazOd: true } }),
    db.zakazkaPolozka.findMany({
      where: { zakazkaId: params.id, zakazka: { orgId } },
      orderBy: { poradi: 'asc' },
      include: {
        product: {
          select: {
            id: true, objednaciKod: true, nakladovaCena: true,
            dodavatele: { select: { dodavatelId: true, objednaciKod: true, nakupniCena: true, hlavni: true, dodavatel: { select: { nazev: true, aktivni: true } } }, orderBy: [{ hlavni: 'desc' }, { vytvoreno: 'asc' }] },
          },
        },
        objednavkaPolozky: { where: { objednavka: { stav: { in: ['NAVRH', 'ODESLANA', 'CASTECNE_DORUCENA'] } } }, select: { objednavka: { select: { cislo: true } } } },
      },
    }),
    db.dodavatel.findMany({ where: { orgId, aktivni: true }, select: { id: true, nazev: true, email: true }, orderBy: { nazev: 'asc' } }),
  ])

  return NextResponse.json({
    montazOd: zakazka?.montazOd?.toISOString() ?? null,
    dodavatele,
    polozky: polozky.map(p => ({
      id: p.id,
      productId: p.productId,
      nazev: p.nazev,
      kod: p.kod,
      mnozstvi: Number(p.mnozstvi),
      jednotka: p.jednotka,
      stav: p.stav,
      vOtevreneObjednavce: p.objednavkaPolozky.map(o => o.objednavka.cislo),
      dodavatele: (p.product?.dodavatele ?? []).filter(d => d.dodavatel.aktivni).map(d => ({
        dodavatelId: d.dodavatelId,
        nazev: d.dodavatel.nazev,
        hlavni: d.hlavni,
        objednaciKod: d.objednaciKod ?? p.product?.objednaciKod ?? null,
        nakupniCena: perms.financeNakupky && d.nakupniCena !== null ? Number(d.nakupniCena) : null,
      })),
    })),
  })
}
