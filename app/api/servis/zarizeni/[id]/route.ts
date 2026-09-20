import { getPlanLimits } from '@/lib/planLimits'
import { forbidden, getPerms } from '@/lib/permissions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const zarizeni = await db.zarizeni.findFirst({
    where: { id: params.id, orgId },
    include: {
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
      deal: { select: { id: true, kod: true, predmet: true } },
      servisniKontrakty: {
        include: {
          servisniZakazky: {
            where: { stav: 'NAPLANOVANA' },
            orderBy: { planovanyTermin: 'asc' },
            take: 1,
          },
        },
      },
      servisniZakazky: {
        orderBy: { planovanyTermin: 'desc' },
        take: 10,
        include: { technik: { select: { id: true, jmeno: true } } },
      },
    },
  })

  if (!zarizeni) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(zarizeni)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).servisDispecink) return forbidden()
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const zarizeni = await db.zarizeni.findFirst({ where: { id: params.id, orgId } })
  if (!zarizeni) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  const updated = await db.zarizeni.update({
    where: { id: params.id },
    data: {
      nazev: body.nazev ?? zarizeni.nazev,
      typ: body.typ ?? zarizeni.typ,
      vyrobniCislo: body.vyrobniCislo !== undefined ? (body.vyrobniCislo || null) : zarizeni.vyrobniCislo,
      datumInstalace: body.datumInstalace !== undefined
        ? (body.datumInstalace ? new Date(body.datumInstalace) : null)
        : zarizeni.datumInstalace,
      zarukaDo: body.zarukaDo !== undefined
        ? (body.zarukaDo ? new Date(body.zarukaDo) : null)
        : zarizeni.zarukaDo,
      poznamka: body.poznamka !== undefined ? (body.poznamka || null) : zarizeni.poznamka,
      aktivni: body.aktivni !== undefined ? body.aktivni : zarizeni.aktivni,
    },
  })

  return NextResponse.json(updated)
}
