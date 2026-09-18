import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPerms } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { isOrgEmailConfigured } from '@/lib/email'
import { loadObjednavkaFull } from '@/lib/objednavkaDokument'
import { serializeObjednavka } from '@/lib/objednavky'
import ObjednavkaDetailClient from './ObjednavkaDetailClient'

export default async function ObjednavkaDetailPage({ params }: { params: { id: string; objednavkaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') notFound()
  if (!(await canAccessZakazka(session.user, perms, params.id))) notFound()

  const orgId = session.user.orgId
  const o = await loadObjednavkaFull(orgId, params.objednavkaId)
  if (!o || o.zakazkaId !== params.id) notFound()

  return (
    <div className="space-y-4">
      <Link href={`/zakazky/${params.id}?tab=objednavky`} className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
        ← Zpět na objednávky
      </Link>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <ObjednavkaDetailClient
          objednavka={serializeObjednavka(o, perms.financeNakupky)}
          canEdit={perms.sklad === 'PLNY'}
          showNakupky={perms.financeNakupky}
          emailConfigured={await isOrgEmailConfigured(orgId)}
          zakazkaId={params.id}
        />
      </div>
    </div>
  )
}
