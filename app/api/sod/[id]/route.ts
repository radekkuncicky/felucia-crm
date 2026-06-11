import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const sod = await db.sod.findFirst({
    where: { id: params.id, orgId },
    include: {
      deal: { include: { client: true } },
    },
  })
  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(sod)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const sod = await db.sod.findFirst({ where: { id: params.id, orgId } })
  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  const updated = await db.sod.update({
    where: { id: params.id },
    data: {
      typ: body.typ ?? sod.typ,
      klientJmeno: body.klientJmeno ?? sod.klientJmeno,
      klientAdresa: body.klientAdresa !== undefined ? body.klientAdresa : sod.klientAdresa,
      klientEmail: body.klientEmail !== undefined ? body.klientEmail : sod.klientEmail,
      klientTelefon: body.klientTelefon !== undefined ? body.klientTelefon : sod.klientTelefon,
      klientIco: body.klientIco !== undefined ? body.klientIco : sod.klientIco,
      klientDic: body.klientDic !== undefined ? body.klientDic : sod.klientDic,
      kontaktniOsoba: body.kontaktniOsoba !== undefined ? body.kontaktniOsoba : sod.kontaktniOsoba,
      kontaktniTelefon: body.kontaktniTelefon !== undefined ? body.kontaktniTelefon : sod.kontaktniTelefon,
      predmetDila: body.predmetDila ?? sod.predmetDila,
      adresaDila: body.adresaDila !== undefined ? body.adresaDila : sod.adresaDila,
      terminPrevzeti: body.terminPrevzeti !== undefined ? body.terminPrevzeti : sod.terminPrevzeti,
      pocetDniRealizace: body.pocetDniRealizace !== undefined ? body.pocetDniRealizace : sod.pocetDniRealizace,
      zmenaTerm: body.zmenaTerm !== undefined ? body.zmenaTerm : sod.zmenaTerm,
      cenaBezDph: body.cenaBezDph !== undefined ? body.cenaBezDph : sod.cenaBezDph,
      cenaSDph: body.cenaSDph !== undefined ? body.cenaSDph : sod.cenaSDph,
      dphSazba: body.dphSazba ?? sod.dphSazba,
      zalohaKc: body.zalohaKc !== undefined ? body.zalohaKc : sod.zalohaKc,
      zalohaSplatnost: body.zalohaSplatnost !== undefined ? body.zalohaSplatnost : sod.zalohaSplatnost,
      zalohaKategorie: body.zalohaKategorie !== undefined ? body.zalohaKategorie : sod.zalohaKategorie,
      poznamky: body.poznamky !== undefined ? body.poznamky : sod.poznamky,
      textSmlouvy: body.textSmlouvy !== undefined ? body.textSmlouvy : sod.textSmlouvy,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Pouze admin může mazat SOD' }, { status: 403 })
  }

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const sod = await db.sod.findFirst({ where: { id: params.id, orgId } })
  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.sod.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
