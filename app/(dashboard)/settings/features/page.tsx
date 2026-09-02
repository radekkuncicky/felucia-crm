import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getOrgSettings } from '@/lib/orgSettings'
import FeaturesClient from './FeaturesClient'
import { getPerms } from '@/lib/permissions'

export default async function FeaturesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!getPerms(session.user).nastaveniOrg) redirect('/dashboard')

  const settings = await getOrgSettings(session.user.orgId)
  const plan = session.user.plan

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Funkce a přepínače</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Zapněte nebo vypněte funkce podle potřeb vaší firmy.
        </p>
      </div>
      <FeaturesClient settings={settings} plan={plan} />
    </div>
  )
}
