import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/auditLog'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod || getPerms(session.user).zakazkyEdit)) return forbidden('Nemáte oprávnění upravovat klienty')
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const client = await db.client.findFirst({ where: { id: params.id, orgId } })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (client.anonymizedAt) return NextResponse.json({ error: 'Anonymizovaný klient nelze upravovat' }, { status: 409 })

  const body = await req.json()
  // SECURITY FIX: Include orgId in update where clause for defense-in-depth (prevents IDOR even if findFirst check were bypassed)
  const updated = await db.client.update({
    where: { id: params.id, orgId },
    data: {
      typKlienta: body.typKlienta === 'FIRMA' ? 'FIRMA' : body.typKlienta === 'FYZICKA_OSOBA' ? 'FYZICKA_OSOBA' : client.typKlienta,
      jmeno: body.jmeno ?? client.jmeno,
      prijmeni: body.prijmeni !== undefined ? (body.prijmeni || '') : client.prijmeni,
      telefon: body.telefon !== undefined ? (body.telefon || null) : client.telefon,
      email: body.email !== undefined ? (body.email || null) : client.email,
      ulice: body.ulice !== undefined ? (body.ulice || null) : client.ulice,
      mesto: body.mesto !== undefined ? (body.mesto || null) : client.mesto,
      psc: body.psc !== undefined ? (body.psc || null) : client.psc,
      ico: body.ico !== undefined ? (body.ico || null) : client.ico,
      dic: body.dic !== undefined ? (body.dic || null) : client.dic,
      poznamka: body.poznamka !== undefined ? (body.poznamka || null) : client.poznamka,
    },
  })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'UPDATE',
    typZaznamu: 'Client',
    zaznamId: params.id,
    zaznamNazev: `${updated.jmeno} ${updated.prijmeni}`,
    zmeny: body,
  })

  return NextResponse.json(updated)
}
