import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/auditLog'
import { anonymizedClientData } from '@/lib/clientAnonymize'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Pouze admin může anonymizovat klienta' }, { status: 403 })
  }

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const client = await db.client.findFirst({ where: { id: params.id, orgId } })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (client.anonymizedAt) return NextResponse.json({ error: 'Klient je již anonymizován' }, { status: 409 })

  const puvodniJmeno = `${client.jmeno} ${client.prijmeni}`.trim()

  const anonymized = await db.client.update({
    where: { id: params.id, orgId },
    data: anonymizedClientData(params.id),
  })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'UPDATE',
    typZaznamu: 'Client',
    zaznamId: params.id,
    zaznamNazev: `Anonymizace klienta (dříve: ${puvodniJmeno})`,
    zmeny: { action: 'anonymize' },
  })

  return NextResponse.json(anonymized)
}
