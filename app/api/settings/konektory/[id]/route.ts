import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'

/** Zruší připojený konektor (MCP) — jen vlastní, v rámci vlastní org. Tokeny přestanou platit hned. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const r = await orgPrisma(orgId).oAuthPripojeni.updateMany({
    where: { id: params.id, orgId, userId: session.user.id, zruseno: null },
    data: { zruseno: new Date() },
  })
  if (r.count === 0) return NextResponse.json({ error: 'Nenalezeno' }, { status: 404 })
  console.log(`[ai-mcp] konektor ${params.id} zrušen uživatelem ${session.user.id}`)
  return NextResponse.json({ ok: true })
}
