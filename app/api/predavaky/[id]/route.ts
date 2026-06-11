import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

async function canAccess(userId: string, role: string, predavakId: string, orgId: string) {
  if (role === 'ADMIN') return true
  const p = await orgPrisma(orgId).predavak.findFirst({ where: { id: predavakId } })
  if (!p) return false
  if (role === 'TECHNIK') return p.technikId === userId
  return true // OBCHODNIK, MANAZER (ADMIN handled above)
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!(await canAccess(session.user.id, session.user.role, params.id, orgId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const predavak = await db.predavak.findFirst({
    where: { id: params.id, orgId },
    include: {
      technik: { select: { id: true, jmeno: true, email: true, telefon: true } },
      schvalil: { select: { id: true, jmeno: true } },
      zakazka: {
        include: {
          klient: { select: { id: true, jmeno: true, prijmeni: true, telefon: true } },
          vedouci: { select: { id: true, jmeno: true } },
        },
      },
      polozky: { orderBy: { id: 'asc' } },
      fotky: { orderBy: { vytvoreno: 'asc' } },
    },
  })

  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(predavak)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const isManager = session.user.role === 'ADMIN' || session.user.role === 'OBCHODNIK'

  const predavak = await db.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role === 'TECHNIK' && predavak.technikId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Admin/manager can reopen an approved protocol
  if (body.reopen && isManager) {
    const updated = await db.predavak.update({
      where: { id: params.id },
      data: { stav: 'ROZPRACOVAN', schvaleno: null, schvalenoId: null, podpisano: null },
    })
    return NextResponse.json(updated)
  }

  if (predavak.stav === 'SCHVALEN') {
    return NextResponse.json({ error: 'Nelze editovat schválený protokol' }, { status: 422 })
  }

  const { poznamka, klientPritomen, podpisSvg, polozky } = body

  const editingSubmitted = predavak.stav === 'PODPISAN'

  await db.$transaction(async tx => {
    await tx.predavak.update({
      where: { id: params.id },
      data: {
        poznamka: poznamka ?? undefined,
        klientPritomen: klientPritomen ?? undefined,
        podpisSvg: podpisSvg ?? undefined,
        ...(editingSubmitted ? { upravenoPodpisano: true } : {}),
      },
    })

    if (polozky && Array.isArray(polozky)) {
      for (const p of polozky) {
        await tx.predavakPolozka.update({
          where: { id: p.id, predavakId: params.id },
          data: {
            mnozstviPouzito: p.mnozstviPouzito ?? 0,
            zahrnuto: p.zahrnuto ?? true,
            poznamka: p.poznamka ?? null,
          },
        })
      }
    }
  })

  const updated = await db.predavak.findFirst({
    where: { id: params.id },
    include: { polozky: { orderBy: { id: 'asc' } }, fotky: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = session.user.role === 'ADMIN' || session.user.role === 'OBCHODNIK'
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const predavak = await db.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.predavak.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
