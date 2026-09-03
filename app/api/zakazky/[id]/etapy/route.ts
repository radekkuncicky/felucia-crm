import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { etapaProgressFromRaw, lzePridatDalsiEtapu } from '@/lib/zakazkaEtapy'
import { getPerms, forbidden } from '@/lib/permissions'

const MAX_ATTEMPTS = 5

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const etapy = await db.zakazkaEtapa.findMany({
    where: { zakazkaId: params.id, orgId },
    orderBy: { cislo: 'asc' },
    include: {
      predavaky: { select: { id: true, cislo: true, stav: true } },
      vyuctovani: { select: { id: true, cislo: true, stav: true } },
    },
  })

  return NextResponse.json(etapy)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Neplatná data požadavku.' }, { status: 400 })
  }
  const { nazev, montazOd, montazDo, poznamka } = body as Record<string, unknown>

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Zakázka nenalezena' }, { status: 404 })

  // Retry na (zakazkaId, cislo) kolizi — dvojklik nebo souběh dvou requestů by
  // jinak spadl jako neošetřená výjimka. Číslo i gating se přepočítá znovu
  // při každém pokusu, ne jen jednou dopředu.
  let lastError: unknown = null
  for (let pokus = 0; pokus < MAX_ATTEMPTS; pokus++) {
    const last = await db.zakazkaEtapa.findFirst({
      where: { zakazkaId: params.id },
      orderBy: { cislo: 'desc' },
      include: {
        predavaky: { select: { stav: true } },
        vyuctovani: { select: { stav: true } },
      },
    })
    if (last && !lzePridatDalsiEtapu([etapaProgressFromRaw(last)])) {
      return NextResponse.json(
        { error: `Etapu ${last.cislo} je nejdřív potřeba dokončit (montáž → předávka → vyúčtování), než půjde přidat další.` },
        { status: 422 },
      )
    }
    const cislo = (last?.cislo ?? 0) + 1

    try {
      const etapa = await db.$transaction(async tx => {
        const e = await tx.zakazkaEtapa.create({
          data: {
            orgId,
            zakazkaId: params.id,
            cislo,
            nazev: typeof nazev === 'string' ? nazev.trim() || null : null,
            montazOd: montazOd ? new Date(montazOd as string) : null,
            montazDo: montazDo ? new Date(montazDo as string) : null,
            poznamka: typeof poznamka === 'string' ? poznamka.trim() || null : null,
            stav: 'PLANOVANA',
          },
          include: {
            predavaky: { select: { id: true, cislo: true, stav: true } },
            vyuctovani: { select: { id: true, cislo: true, stav: true } },
          },
        })

        if (zakazka.stav === 'PREDANA') {
          await tx.zakazka.update({
            where: { id: params.id },
            data: { stav: 'V_REALIZACI' },
          })
        }

        return e
      })

      return NextResponse.json(etapa, { status: 201 })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        lastError = e
        continue
      }
      console.error(`[zakazky/etapy] selhalo založení etapy pro zakázku ${params.id}:`, e)
      return NextResponse.json({ error: 'Založení etapy se nezdařilo, zkuste to prosím znovu.' }, { status: 500 })
    }
  }

  console.error(`[zakazky/etapy] selhalo založení etapy pro zakázku ${params.id} po ${MAX_ATTEMPTS} pokusech:`, lastError)
  return NextResponse.json({ error: 'Založení etapy se nezdařilo kvůli souběhu, zkuste to prosím znovu.' }, { status: 500 })
}
