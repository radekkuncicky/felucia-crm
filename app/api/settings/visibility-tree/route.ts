import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const nodes = await db.visibilityNode.findMany({
    where: { orgId },
    include: {
      users: {
        include: {
          user: { select: { id: true, jmeno: true, email: true } },
        },
      },
    },
    orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }],
  })

  return NextResponse.json(nodes)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json()
  const { nodes } = body as {
    nodes: { id?: string; parentId?: string | null; nazev: string; poradi?: number; users: { userId: string; viditelnost: 'ALL' | 'OWN' | 'SELECTED' }[] }[]
  }

  if (!Array.isArray(nodes)) {
    return NextResponse.json({ error: 'nodes must be an array' }, { status: 400 })
  }

  // Delete existing nodes (cascades to VisibilityNodeUser via onDelete: Cascade)
  await db.visibilityNodeUser.deleteMany({
    where: { node: { orgId } },
  })
  await db.visibilityNode.deleteMany({
    where: { orgId },
  })

  // Re-create nodes. We need to handle parentId references carefully.
  // First pass: create all nodes without parentId, collecting id mapping (client tempId -> real id)
  // We use the provided id as a "temp" key (may be client-generated cuid).
  // Strategy: create top-level first, then children.

  const idMap = new Map<string, string>() // tempId -> realId

  async function createNode(
    node: { id?: string; parentId?: string | null; nazev: string; poradi?: number; users: { userId: string; viditelnost: 'ALL' | 'OWN' | 'SELECTED' }[] },
    resolvedParentId: string | null
  ) {
    const created = await db.visibilityNode.create({
      data: {
        orgId,
        nazev: node.nazev,
        parentId: resolvedParentId,
        poradi: node.poradi ?? 0,
        users: {
          create: node.users.map(u => ({
            userId: u.userId,
            viditelnost: u.viditelnost,
          })),
        },
      },
    })
    if (node.id) {
      idMap.set(node.id, created.id)
    }
    return created
  }

  // Sort: root nodes first (no parentId or parentId not in nodes list)
  const nodeIds = new Set(nodes.map(n => n.id).filter(Boolean))

  const roots = nodes.filter(n => !n.parentId || !nodeIds.has(n.parentId))
  const children = nodes.filter(n => n.parentId && nodeIds.has(n.parentId))

  for (const node of roots) {
    await createNode(node, null)
  }

  // Multiple passes for nested children
  let remaining = children
  let maxPasses = 10
  while (remaining.length > 0 && maxPasses-- > 0) {
    const next: typeof remaining = []
    for (const node of remaining) {
      const realParentId = node.parentId ? idMap.get(node.parentId) : null
      if (realParentId || !node.parentId) {
        await createNode(node, realParentId ?? null)
      } else {
        next.push(node)
      }
    }
    remaining = next
  }

  return NextResponse.json({ ok: true })
}
