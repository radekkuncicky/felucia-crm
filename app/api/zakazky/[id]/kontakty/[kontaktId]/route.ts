import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canTechnikAccessZakazka } from '@/lib/zakazkyHelpers'
import { parseKontaktInput } from '@/lib/zakazkaKontakt'

async function guard(session: Session | null, zakazkaId: string) {
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const isTechnik = session.user.role === 'TECHNIK'
  if (isTechnik && !(await canTechnikAccessZakazka(session.user.id, zakazkaId))) {
    return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { err: null }
}

export async function PATCH(req: Request, { params }: { params: { id: string; kontaktId: string } }) {
  const session = await getServerSession(authOptions)
  const { err } = await guard(session, params.id)
  if (err) return err

  const db = orgPrisma(session!.user.orgId)
  const existing = await db.zakazkaKontakt.findFirst({ where: { id: params.kontaktId, zakazkaId: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = parseKontaktInput(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const kontakt = await db.zakazkaKontakt.update({
    where: { id: params.kontaktId },
    data: parsed.data,
  })

  return NextResponse.json(kontakt)
}

export async function DELETE(req: Request, { params }: { params: { id: string; kontaktId: string } }) {
  const session = await getServerSession(authOptions)
  const { err } = await guard(session, params.id)
  if (err) return err

  const db = orgPrisma(session!.user.orgId)
  const existing = await db.zakazkaKontakt.findFirst({ where: { id: params.kontaktId, zakazkaId: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.zakazkaKontakt.delete({ where: { id: params.kontaktId } })
  return NextResponse.json({ ok: true })
}
