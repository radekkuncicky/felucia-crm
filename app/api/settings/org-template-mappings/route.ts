import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = session.user
  const db = orgPrisma(orgId)

  const mappings = await db.orgTemplateMapping.findMany({
    where: { orgId },
    select: { id: true, technologie: true, templateId: true },
  })
  return NextResponse.json(mappings)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { orgId } = session.user
  const db = orgPrisma(orgId)

  // body: { mappings: Array<{ technologie: string | null, templateId: string }> }
  const body = await req.json()
  const mappings: { technologie: string | null; templateId: string }[] = body.mappings ?? []

  // Validate all templateIds belong to this org
  const ids = mappings.map(m => m.templateId)
  if (ids.length > 0) {
    const count = await db.quoteTemplate.count({ where: { id: { in: ids }, orgId } })
    if (count !== ids.length) {
      return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 })
    }
  }

  // Upsert each mapping, delete removed ones
  await db.$transaction(async (tx) => {
    // Delete all existing mappings for this org
    await tx.orgTemplateMapping.deleteMany({ where: { orgId } })
    // Re-insert
    if (mappings.length > 0) {
      await tx.orgTemplateMapping.createMany({
        data: mappings.map(m => ({ orgId, technologie: m.technologie ?? null, templateId: m.templateId })),
      })
    }
  })

  const result = await db.orgTemplateMapping.findMany({
    where: { orgId },
    select: { id: true, technologie: true, templateId: true },
  })
  return NextResponse.json(result)
}
