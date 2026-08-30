import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { logAction } from '@/lib/auditLog'

const PATCH_POLA = [
  'jmeno', 'prijmeni', 'telefon', 'email', 'ulice', 'mesto', 'psc', 'ico', 'dic',
] as const

// PATCH /api/mobile/obchod/klienti/[id] — úprava kontaktu a adresy klienta z appky
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const client = await db.client.findFirst({ where: { id: params.id } })
  if (!client) return NextResponse.json({ error: 'Klient nenalezen' }, { status: 404 })
  if (client.anonymizedAt) return NextResponse.json({ error: 'Anonymizovaný klient nelze upravovat' }, { status: 409 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Neplatný požadavek' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  for (const pole of PATCH_POLA) {
    if (typeof body[pole] === 'string') data[pole] = (body[pole] as string).trim() || null
    else if (body[pole] === null) data[pole] = null
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Žádná pole ke změně' }, { status: 400 })
  }
  if (data.jmeno === null) {
    return NextResponse.json({ error: 'Jméno je povinné' }, { status: 400 })
  }

  const updated = await db.client.update({ where: { id: params.id }, data })

  await logAction({
    orgId: session!.user.orgId,
    userId: session!.user.id,
    typAkce: 'UPDATE',
    typZaznamu: 'Client',
    zaznamId: client.id,
    zaznamNazev: `${updated.jmeno} ${updated.prijmeni}`.trim(),
    zmeny: data,
  })

  return NextResponse.json({ id: updated.id, ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
