import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin, klientAdresa } from '@/lib/mobile-helpers'
import { najdiDuplicitnihoKlienta } from '@/lib/clientDuplicate'

const OTEVRENE_STAVY_VYJMA = ['USPECH', 'PAS', 'ZNEPLATNENO'] as const

// POST /api/mobile/obchod/klienti/duplicity — { jmeno?, prijmeni?, telefon?, email? }
// -> { match: { id, jmeno, prijmeni, telefon, email, adresa, otevrenePripady } | null }
// Mobilní varianta /api/clients/check-duplicate (stejná logika z lib/clientDuplicate),
// volá se z formuláře Nový případ před založením klienta.
export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }
  const { jmeno, prijmeni, telefon, email } = body as Record<string, unknown>

  const klienti = await db.client.findMany({
    where: { anonymizedAt: null },
    select: { id: true, jmeno: true, prijmeni: true, telefon: true, email: true, ulice: true, mesto: true, psc: true },
  })

  const match = najdiDuplicitnihoKlienta(klienti, {
    jmeno: typeof jmeno === 'string' ? jmeno : null,
    prijmeni: typeof prijmeni === 'string' ? prijmeni : null,
    telefon: typeof telefon === 'string' ? telefon : null,
    email: typeof email === 'string' ? email : null,
  })
  if (!match) return NextResponse.json({ match: null })

  const plny = klienti.find(k => k.id === match.id)!
  const otevrenePripady = await db.deal.count({
    where: { clientId: match.id, stav: { notIn: [...OTEVRENE_STAVY_VYJMA] } },
  })

  return NextResponse.json({
    match: {
      id: match.id,
      jmeno: match.jmeno,
      prijmeni: match.prijmeni,
      telefon: match.telefon,
      email: match.email,
      adresa: klientAdresa(plny) || null,
      otevrenePripady,
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
