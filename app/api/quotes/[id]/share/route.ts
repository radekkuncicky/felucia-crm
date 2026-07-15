import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { ensureQuoteShare, getQuoteShare, revokeQuoteShare, quoteShareUrl, QUOTE_SHARE_DNI } from '@/lib/quoteShare'

function auth(session: Session | null): { session: Session; error?: undefined } | { session?: undefined; error: NextResponse } {
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (session.user.role === 'TECHNIK') {
    return { error: NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 }) }
  }
  return { session }
}

// Stav sdílení nabídky
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = auth(await getServerSession(authOptions))
  if (error) return error

  const share = await getQuoteShare(params.id, session!.user.orgId)
  if (!share) return NextResponse.json({ shared: false })
  return NextResponse.json({
    shared: true,
    url: quoteShareUrl(session!.user.orgSlug, share.token),
    expiresAt: share.expiresAt.toISOString(),
  })
}

// Vytvoří veřejný odkaz (nebo vrátí existující platný)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = auth(await getServerSession(authOptions))
  if (error) return error

  const share = await ensureQuoteShare(params.id, session!.user.orgId)
  if (!share) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })
  return NextResponse.json({
    shared: true,
    url: quoteShareUrl(session!.user.orgSlug, share.token),
    expiresAt: share.expiresAt.toISOString(),
    platnostDni: QUOTE_SHARE_DNI,
  })
}

// Zneplatní veřejný odkaz
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = auth(await getServerSession(authOptions))
  if (error) return error

  const ok = await revokeQuoteShare(params.id, session!.user.orgId)
  if (!ok) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })
  return NextResponse.json({ shared: false })
}
