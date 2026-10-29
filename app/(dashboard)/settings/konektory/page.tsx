import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { formatDateTime } from '@/lib/format'
import KonektoryClient from './KonektoryClient'

export default async function KonektoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  const orgId = session.user.orgId

  const pripojeni = await orgPrisma(orgId).oAuthPripojeni.findMany({
    where: { orgId, userId: session.user.id, zruseno: null, refreshExpiruje: { gt: new Date() } },
    select: { id: true, vytvoreno: true, posledniPouziti: true, klient: { select: { nazev: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Připojené aplikace</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          AI aplikace (např. Claude), které mají přes konektor přístup k Felucii vaším jménem. Adresa konektoru:{' '}
          <code className="text-xs">https://felucia.io/api/mcp</code>
        </p>
      </div>
      <KonektoryClient
        polozky={pripojeni.map(p => ({
          id: p.id,
          nazev: p.klient.nazev,
          pripojeno: formatDateTime(p.vytvoreno),
          naposledy: p.posledniPouziti ? formatDateTime(p.posledniPouziti) : null,
        }))}
      />
    </div>
  )
}
