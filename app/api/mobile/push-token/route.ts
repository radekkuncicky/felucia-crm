import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, requireObchodnikOrAdmin, klientAppky } from '@/lib/mobile-helpers'
import { logAction } from '@/lib/auditLog'
import { pushTokenSloupec, type PushAppka } from '@/lib/push'

/** Felucia Sales posílá app: 'SALES'; bez pole = Felucia Tech (starší buildy). */
function appkaZ(v: unknown): PushAppka {
  return v === 'SALES' ? 'SALES' : 'TECH'
}

// Obchodník bez zakázek/servisu (jen Sales) by u technické kontroly dostal 403
function overAppku(session: Awaited<ReturnType<typeof getMobileOrWebSession>>, app: PushAppka) {
  return app === 'SALES' ? requireObchodnikOrAdmin(session) : requireTechnikOrAdmin(session)
}

export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { token?: string; app?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const authErr = overAppku(session, appkaZ(body.app))
  if (authErr) return authErr

  if (!body.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'Chybí token' }, { status: 400 })
  }

  const app = appkaZ(body.app)
  const sloupec = pushTokenSloupec(app)
  const db = orgPrisma(session!.user.orgId)
  const pred = await db.user.findFirst({ where: { id: session!.user.id }, select: { pushToken: true, pushTokenSales: true } })
  await db.user.update({
    where: { id: session!.user.id },
    data: { [sloupec]: body.token },
  })

  // jen při změně tokenu (appka ho registruje při každém startu) — platforma + verze appky do auditu
  if (pred?.[sloupec] !== body.token) {
    await logAction({
      orgId: session!.user.orgId,
      userId: session!.user.id,
      typAkce: 'UPDATE',
      typZaznamu: 'MobilePushToken',
      zaznamId: session!.user.id,
      zaznamNazev: app === 'SALES' ? 'Registrace notifikací v appce Sales' : 'Registrace notifikací v appce',
      zmeny: klientAppky(req),
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await getMobileOrWebSession(req)
  const app = appkaZ(new URL(req.url).searchParams.get('app'))
  const authErr = overAppku(session, app)
  if (authErr) return authErr

  await orgPrisma(session!.user.orgId).user.update({
    where: { id: session!.user.id },
    data: { [pushTokenSloupec(app)]: null },
  })

  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
