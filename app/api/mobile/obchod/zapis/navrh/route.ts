import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPerms } from '@/lib/permissions'
import { checkRateLimit } from '@/lib/rateLimit'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin, klientAdresa } from '@/lib/mobile-helpers'
import { overAiKredity } from '@/lib/ai/kredity'
import { nactiFiremniKontext } from '@/lib/ai/firemniKontext'
import { navrhniZapis, ZapisChyba, ZAPIS_MAX_ZNAKU } from '@/lib/zapisJednani'

// POST /api/mobile/obchod/zapis/navrh — { text, dealId? } → { navrh, kredity }
// Jen návrh — nic neukládá. Diktát už má appka uložený (outbox) dřív, než volá AI.
export async function POST(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId, id: userId, role } = session!.user

  const { limited } = checkRateLimit(`zapis-navrh:${userId}`, 20, 60_000)
  if (limited) return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to za chvíli.' }, { status: 429 })

  const body = await req.json().catch(() => null) as { text?: unknown; dealId?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'Diktát je prázdný' }, { status: 400 })
  if (text.length > ZAPIS_MAX_ZNAKU) return NextResponse.json({ error: `Diktát je moc dlouhý (max ${ZAPIS_MAX_ZNAKU} znaků)` }, { status: 413 })

  const db = orgPrisma(orgId)
  let op = null
  if (typeof body?.dealId === 'string') {
    const deal = await db.deal.findFirst({
      where: { id: body.dealId, ...mobileDealScope(session!) },
      select: { predmet: true, technologie: true, adresaDila: true, client: { select: { jmeno: true, prijmeni: true, ulice: true, mesto: true, psc: true } } },
    })
    if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })
    op = {
      klient: `${deal.client.jmeno} ${deal.client.prijmeni}`.trim(),
      predmet: deal.predmet,
      technologie: deal.technologie,
      adresa: deal.adresaDila || klientAdresa(deal.client) || null,
    }
  }

  const blok = await overAiKredity(orgId)
  if (blok) return NextResponse.json({ error: blok.error }, { status: blok.status })

  const user = await db.user.findFirst({ where: { id: userId }, select: { jmeno: true } })
  try {
    const { navrh, kredity } = await navrhniZapis({
      ctx: { orgId, userId, role, jmeno: user?.jmeno ?? '', perms: getPerms(session!.user), zdroj: 'web' },
      diktat: text,
      op,
      firemniKontext: await nactiFiremniKontext(orgId),
    })
    return NextResponse.json({ navrh, kredity })
  } catch (e) {
    if (e instanceof ZapisChyba) return NextResponse.json({ error: e.message }, { status: 422 })
    console.error('[zapis/navrh]', e)
    return NextResponse.json({ error: 'AI teď neodpovídá. Diktát zůstal uložený, zkuste učesat později.' }, { status: 502 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
