import { NextResponse } from 'next/server'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { aresLookup } from '@/lib/ares'
import { checkRateLimit } from '@/lib/rateLimit'

// GET /api/mobile/obchod/ares?q=<ičo nebo název> — předvyplnění firmy u nového případu
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { limited } = checkRateLimit(`mobile-ares:${session!.user.id}`, 30, 60_000)
  if (limited) return NextResponse.json({ error: 'Příliš mnoho dotazů' }, { status: 429 })

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  return NextResponse.json(await aresLookup(q))
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
