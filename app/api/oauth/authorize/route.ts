import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getPlanLimits } from '@/lib/planLimits'
import { issuerZ, overAutorizacniPozadavek, redirectSKodem, vydejKod } from '@/lib/oauth'

/**
 * Souhlas uživatele s připojením konektoru (volá stránka /oauth/authorize).
 * Org a uživatel výhradně ze session; vrací adresu, kam prohlížeč přejde
 * (CSP form-action 'self' by přesměrování z formuláře na cizí doménu zablokovala).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.isDemo) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

  // CSRF: jen z vlastní stránky
  const origin = req.headers.get('origin')
  if (!origin || origin !== issuerZ(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const r = await overAutorizacniPozadavek(body.params ?? {})
  if (!r.ok) {
    return r.fatalni ? NextResponse.json({ error: r.chyba }, { status: 400 }) : NextResponse.json({ redirect: r.redirect })
  }

  if (body.povolit !== true) {
    const u = new URL(r.p.redirectUri)
    u.searchParams.set('error', 'access_denied')
    if (r.p.state) u.searchParams.set('state', r.p.state)
    return NextResponse.json({ redirect: u.toString() })
  }

  if (!getPlanLimits(session.user.plan).canUseAI) {
    return NextResponse.json({ error: 'AI asistentka (a tím i konektor) není ve vašem plánu.' }, { status: 403 })
  }

  const kod = await vydejKod({
    orgId: session.user.orgId,
    userId: session.user.id,
    klientId: r.p.klient.id,
    redirectUri: r.p.redirectUri,
    codeChallenge: r.p.codeChallenge,
    resource: r.p.resource,
  })
  console.log(`[ai-mcp] souhlas: user=${session.user.id} org=${session.user.orgId} klient=${r.p.klient.clientId}`)
  return NextResponse.json({ redirect: redirectSKodem(r.p, kod) })
}
