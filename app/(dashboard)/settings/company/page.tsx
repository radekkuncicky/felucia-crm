import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import CompanySettingsForm from './CompanySettingsForm'
import { getPerms } from '@/lib/permissions'

export default async function CompanySettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) redirect('/dashboard')
  const orgId = session.user.orgId

  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) redirect('/dashboard')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nastavení firmy</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Základní údaje vaší organizace</p>
      </div>
      <CompanySettingsForm org={{
        id: org.id,
        nazev: org.nazev,
        ico: org.ico ?? '',
        dic: org.dic ?? '',
        sidlo: org.sidlo ?? '',
        telefon: org.telefon ?? '',
        email: org.email ?? '',
        web: org.web ?? '',
        logo: org.logo ?? '',
        logoBw: org.logoBw ?? '',
      }} />
    </div>
  )
}
