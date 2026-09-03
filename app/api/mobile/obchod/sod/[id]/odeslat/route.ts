import { NextResponse } from 'next/server'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { odeslatSodFlow } from '@/lib/sodOdeslatFlow'

// POST /api/mobile/obchod/sod/[id]/odeslat — odeslání smlouvy klientovi
// k podpisu na dálku (klient si ji projde a podepíše přes odkaz + SMS OTP).
// { email?, telefon? } — prázdné = kontakty klienta ze smlouvy. Bez platného
// interního podpisu zmocněnce vznikne žádost (cekaNaPodpis: true) a smlouva
// odejde klientovi automaticky, až ji zmocněnec podepíše na webu.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const body = await req.json().catch(() => ({}))
  const vysledek = await odeslatSodFlow({
    orgId: session!.user.orgId,
    userId: session!.user.id,
    plan: session!.user.plan,
    sodId: params.id,
    email: typeof body.email === 'string' ? body.email : undefined,
    telefon: typeof body.telefon === 'string' ? body.telefon : undefined,
    req,
  })
  if ('error' in vysledek) {
    return NextResponse.json({ error: vysledek.error }, { status: vysledek.status })
  }
  return NextResponse.json(vysledek)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
