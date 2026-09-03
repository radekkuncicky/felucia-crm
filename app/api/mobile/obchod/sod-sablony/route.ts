import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'

// GET /api/mobile/obchod/sod-sablony — smluvní šablony org pro výběr při tvorbě SOD
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const db = orgPrisma(session!.user.orgId)
  const sablony = await db.contractTemplate.findMany({
    select: { id: true, nazev: true, popis: true, typSablony: true },
    orderBy: { nazev: 'asc' },
  })
  return NextResponse.json(sablony)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
