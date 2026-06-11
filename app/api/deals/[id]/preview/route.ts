import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({
    where: { id: params.id, orgId },
    include: {
      client: true,
      user: { select: { id: true, jmeno: true } },
      activities: {
        orderBy: { datum: 'desc' },
        take: 5,
      },
      quotes: {
        include: { items: true },
        orderBy: { vytvoreno: 'asc' },
      },
    },
  })

  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = {
    id: deal.id,
    kod: deal.kod,
    predmet: deal.predmet,
    stav: deal.stav,
    technologie: deal.technologie,
    dphSazba: deal.dphSazba,
    hodnotaZalohy: deal.hodnotaZalohy ? Number(deal.hodnotaZalohy) : null,
    poznamky: deal.poznamky,
    vytvoreno: deal.vytvoreno.toISOString(),
    terminRealizace: deal.terminRealizace?.toISOString() ?? null,
    client: {
      id: deal.client.id,
      jmeno: deal.client.jmeno,
      prijmeni: deal.client.prijmeni,
      telefon: deal.client.telefon,
      email: deal.client.email,
    },
    user: deal.user ? { id: deal.user.id, jmeno: deal.user.jmeno } : null,
    activities: deal.activities.map(a => ({
      id: a.id,
      typ: a.typ,
      popis: a.popis,
      datum: a.datum.toISOString(),
      stav: a.stav,
    })),
    quotes: deal.quotes.map(q => {
      const suma = q.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100), 0)
      return {
        id: q.id,
        nazev: q.nazev,
        kod: q.kod,
        aktivni: q.aktivni,
        suma,
      }
    }),
    konecnaCena: (() => {
      const activeQ = deal.quotes.find(q => q.aktivni)
      if (!activeQ) return 0
      return activeQ.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100), 0)
    })(),
    konecnaCenaSDph: (() => {
      const activeQ = deal.quotes.find(q => q.aktivni)
      if (!activeQ) return 0
      const cenaBezDph = activeQ.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100), 0)
      return cenaBezDph * (1 + Number(activeQ.dphSazba ?? 0) / 100)
    })(),
  }

  return NextResponse.json(result)
}
