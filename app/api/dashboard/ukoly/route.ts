import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

/**
 * „Co mám dělat“ — sloučený seznam pro přihlášeného uživatele:
 *  - naplánované aktivity na OP (řešitel = já; u starých záznamů bez řešitele autor = já)
 *  - nehotové úkoly zakázek (řešitel = já)
 * Rozdělené do skupin PO_TERMINU / DNES / TYDEN / BEZ_TERMINU, seřazené podle termínu.
 */
export type CoMamDelatSkupina = 'PO_TERMINU' | 'DNES' | 'TYDEN' | 'BEZ_TERMINU'

export type CoMamDelatPolozka = {
  id: string
  druh: 'AKTIVITA' | 'UKOL'
  typ: string | null
  text: string
  datum: string | null
  cas: string | null
  skupina: CoMamDelatSkupina
  /** id OP (AKTIVITA) nebo zakázky (UKOL) — pro PATCH z dashboardu */
  parentId: string
  kontext: { label: string; popis: string | null; href: string }
}

const DNI_DOPREDU = 7

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, id: userId } = session.user
  const db = orgPrisma(orgId)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const horizont = new Date(today); horizont.setDate(today.getDate() + DNI_DOPREDU + 1)

  const [aktivity, ukoly] = await Promise.all([
    db.activity.findMany({
      where: {
        orgId,
        stav: 'PLANOVANA',
        datum: { lt: horizont },
        OR: [{ resitelId: userId }, { resitelId: null, userId }],
      },
      select: {
        id: true, typ: true, popis: true, cil: true, datum: true, cas: true,
        deal: { select: { id: true, kod: true, predmet: true, client: { select: { jmeno: true, prijmeni: true } } } },
      },
      orderBy: [{ datum: 'asc' }, { cas: 'asc' }],
      take: 100,
    }),
    db.zakazkaUkol.findMany({
      where: {
        orgId,
        hotovo: false,
        resitelId: userId,
        OR: [{ termin: null }, { termin: { lt: horizont } }],
      },
      select: {
        id: true, text: true, termin: true,
        zakazka: { select: { id: true, cislo: true, nazev: true, klient: { select: { jmeno: true, prijmeni: true } } } },
      },
      orderBy: [{ termin: { sort: 'asc', nulls: 'last' } }, { poradi: 'asc' }],
      take: 100,
    }),
  ])

  function skupina(d: Date | null): CoMamDelatSkupina {
    if (!d) return 'BEZ_TERMINU'
    if (d < today) return 'PO_TERMINU'
    if (d < tomorrow) return 'DNES'
    return 'TYDEN'
  }

  const polozky: CoMamDelatPolozka[] = [
    ...aktivity.map(a => ({
      id: a.id,
      druh: 'AKTIVITA' as const,
      typ: a.typ,
      text: a.popis || a.cil || a.typ,
      datum: a.datum.toISOString(),
      cas: a.cas,
      skupina: skupina(a.datum),
      parentId: a.deal.id,
      kontext: {
        label: a.deal.kod ?? 'OP',
        popis: `${a.deal.client.jmeno} ${a.deal.client.prijmeni}`.trim() || a.deal.predmet,
        href: `/deals/${a.deal.id}?tab=aktivity`,
      },
    })),
    ...ukoly.map(u => ({
      id: u.id,
      druh: 'UKOL' as const,
      typ: null,
      text: u.text,
      datum: u.termin?.toISOString() ?? null,
      cas: null,
      skupina: skupina(u.termin),
      parentId: u.zakazka.id,
      kontext: {
        label: u.zakazka.cislo,
        popis: `${u.zakazka.klient.jmeno} ${u.zakazka.klient.prijmeni}`.trim() || u.zakazka.nazev,
        href: `/zakazky/${u.zakazka.id}?tab=ukoly`,
      },
    })),
  ]

  const poradi: Record<CoMamDelatSkupina, number> = { PO_TERMINU: 0, DNES: 1, TYDEN: 2, BEZ_TERMINU: 3 }
  polozky.sort((a, b) =>
    poradi[a.skupina] - poradi[b.skupina]
    || (a.datum ?? '').localeCompare(b.datum ?? '')
    || (a.cas ?? '').localeCompare(b.cas ?? ''),
  )

  return NextResponse.json({ polozky })
}
