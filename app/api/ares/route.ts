import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { aresLookup } from '@/lib/ares'
import { checkRateLimit } from '@/lib/rateLimit'

export type { AresFirma } from '@/lib/ares'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Našeptávač má debounce 300 ms — 60/min per uživatel je pohodlná rezerva, brání jen zneužití
  const { limited } = checkRateLimit(`ares:${session.user.id}`, 60, 60_000)
  if (limited) return NextResponse.json({ error: 'Příliš mnoho dotazů na ARES, zkuste to za chvíli.' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()

  return NextResponse.json(await aresLookup(q))
}
