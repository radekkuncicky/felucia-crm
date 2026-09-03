import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { nazev, aktivni, apiKlic } = await req.json()

  const ext = await db.extension.upsert({
    where: { orgId_nazev: { orgId, nazev } },
    update: { aktivni, apiKlic: apiKlic || null },
    create: { orgId, nazev, aktivni, apiKlic: apiKlic || null },
  })
  return NextResponse.json(ext)
}
