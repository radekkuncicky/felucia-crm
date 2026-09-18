import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

type Params = { params: { id: string; dodavatelId: string } }

/** Úprava vazby; `hlavni: true` shodí příznak ostatním dodavatelům produktu. */
export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const vazba = await db.productDodavatel.findFirst({
    where: { orgId, productId: params.id, dodavatelId: params.dodavatelId },
    select: { id: true, hlavni: true },
  })
  if (!vazba) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if ('objednaciKod' in body) data.objednaciKod = typeof body.objednaciKod === 'string' && body.objednaciKod.trim() ? body.objednaciKod.trim() : null
  if ('dodaciLhuta' in body) data.dodaciLhuta = typeof body.dodaciLhuta === 'string' && body.dodaciLhuta.trim() ? body.dodaciLhuta.trim() : null
  if ('nakupniCena' in body && perms.financeNakupkyEdit) {
    data.nakupniCena = body.nakupniCena !== null && body.nakupniCena !== '' ? Number(body.nakupniCena) : null
  }
  if (body.hlavni === true) data.hlavni = true
  if (body.hlavni === false && vazba.hlavni) {
    return NextResponse.json({ error: 'Hlavního dodavatele lze jen přepnout na jiného' }, { status: 400 })
  }

  const updated = await db.$transaction(async tx => {
    if (data.hlavni === true) await tx.productDodavatel.updateMany({ where: { orgId, productId: params.id }, data: { hlavni: false } })
    return tx.productDodavatel.update({
      where: { id: vazba.id },
      data,
      select: {
        id: true, dodavatelId: true, objednaciKod: true, nakupniCena: true, dodaciLhuta: true, hlavni: true,
        dodavatel: { select: { id: true, nazev: true, email: true, aktivni: true } },
      },
    })
  })
  return NextResponse.json({ ...updated, nakupniCena: perms.financeNakupky && updated.nakupniCena !== null ? Number(updated.nakupniCena) : null })
}

/** Odebrání dodavatele od produktu; byl-li hlavní, hlavním se stane první zbývající. */
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const vazba = await db.productDodavatel.findFirst({
    where: { orgId, productId: params.id, dodavatelId: params.dodavatelId },
    select: { id: true, hlavni: true },
  })
  if (!vazba) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.$transaction(async tx => {
    await tx.productDodavatel.delete({ where: { id: vazba.id } })
    if (vazba.hlavni) {
      const dalsi = await tx.productDodavatel.findFirst({ where: { orgId, productId: params.id }, orderBy: { vytvoreno: 'asc' }, select: { id: true } })
      if (dalsi) await tx.productDodavatel.update({ where: { id: dalsi.id }, data: { hlavni: true } })
    }
  })
  return NextResponse.json({ ok: true })
}
