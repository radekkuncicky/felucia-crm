import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPlanLimits } from '@/lib/planLimits'
import { overAutorizacniPozadavek } from '@/lib/oauth'
import SouhlasKlient from './SouhlasKlient'

export const metadata = { title: 'Připojit aplikaci — Felucia' }

/** OAuth 2.1 autorizace MCP konektoru: přihlášení stávajícím účtem Felucie + souhlas */
export default async function OAuthAuthorizePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const params = Object.fromEntries(
    Object.entries(searchParams).filter((e): e is [string, string] => typeof e[1] === 'string'),
  )
  const r = await overAutorizacniPozadavek(params)
  if (!r.ok && !r.fatalni) redirect(r.redirect)

  const session = await getServerSession(authOptions)
  if (r.ok && (!session || session.user.isDemo)) {
    const zpet = `/oauth/authorize?${new URLSearchParams(params).toString()}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(zpet)}`)
  }

  const org = session ? await prisma.organization.findUnique({ where: { id: session.user.orgId }, select: { nazev: true, plan: true } }) : null
  const bezAi = !!org && !getPlanLimits(org.plan).canUseAI

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm space-y-5">
        <div className="text-sm font-semibold text-primary">Felucia CRM</div>
        {!r.ok ? (
          <>
            <h1 className="text-xl font-bold text-fg">Připojení nelze dokončit</h1>
            <p className="text-sm text-muted">{r.chyba} Zkuste konektor v aplikaci přidat znovu.</p>
          </>
        ) : bezAi ? (
          <>
            <h1 className="text-xl font-bold text-fg">Konektor není ve vašem plánu</h1>
            <p className="text-sm text-muted">Připojení AI aplikací je součástí AI asistentky (plán Standard a vyšší).</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-fg">„{r.p.klient.nazev}“ chce přístup k Felucii</h1>
            <p className="text-sm text-muted">
              Přihlášen(a) jako <strong className="text-fg">{session!.user.jmeno}</strong> · {org?.nazev}
            </p>
            <ul className="space-y-1.5 text-sm text-fg list-disc pl-5">
              <li>číst zakázky, obchodní případy, klienty a katalog v rozsahu vašich oprávnění,</li>
              <li>zakládat a měnit záznamy vaším jménem — aplikace se vás před každou změnou zeptá,</li>
              <li>přístup jde kdykoli zrušit v Nastavení → Připojené aplikace.</li>
            </ul>
            <SouhlasKlient params={params} />
          </>
        )}
      </div>
    </main>
  )
}
