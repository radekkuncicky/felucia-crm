import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const role = session.user.role
  if (role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { duvod } = await req.json()
  if (!duvod?.trim()) return NextResponse.json({ error: 'Důvod odmítnutí je povinný' }, { status: 400 })

  const predavak = await prisma.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (predavak.stav !== 'PODPISAN') {
    return NextResponse.json({ error: 'Lze odmítnout pouze podepsaný protokol' }, { status: 422 })
  }

  await prisma.$transaction([
    prisma.predavak.update({
      where: { id: params.id },
      data: { stav: 'ODMITNUTO', odmitnutoDuvod: duvod },
    }),
    prisma.notification.create({
      data: {
        orgId,
        userId: predavak.technikId,
        typ: 'PREDAVAK_ODMITNUTO',
        zprava: `Protokol ${predavak.cislo} byl odmítnut: ${duvod}`,
        url: `/zakazky/${predavak.zakazkaId}/predavaky/${predavak.id}`,
      },
    }),
    prisma.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Predavak',
        zaznamId: params.id,
        zaznamNazev: predavak.cislo,
        zmeny: { stavPred: 'PODPISAN', stavPo: 'ODMITNUTO', duvod },
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
