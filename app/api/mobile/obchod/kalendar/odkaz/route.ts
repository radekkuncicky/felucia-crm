import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { calendarOdkazy } from '@/lib/calendarToken'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'

// GET  /api/mobile/obchod/kalendar/odkaz — odkaz na odběr ICS (webcal pro iPhone)
// POST /api/mobile/obchod/kalendar/odkaz — zneplatní dosavadní odkaz a vrátí nový
//      (stejný mechanismus jako „Obnovit odkaz“ v profilu na webu)
async function odpoved(req: Request, zneplatnit: boolean) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const user = zneplatnit
    ? await db.user.update({ where: { id: userId }, data: { calendarTokenVersion: { increment: 1 } }, select: { calendarTokenVersion: true } })
    : await db.user.findUnique({ where: { id: userId }, select: { calendarTokenVersion: true } })
  if (!user) return NextResponse.json({ error: 'Uživatel nenalezen' }, { status: 404 })
  return NextResponse.json(calendarOdkazy(userId, user.calendarTokenVersion))
}

export const GET = (req: Request) => odpoved(req, false)
export const POST = (req: Request) => odpoved(req, true)
