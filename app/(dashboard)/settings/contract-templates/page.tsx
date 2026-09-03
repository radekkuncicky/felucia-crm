import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ContractTemplatesManager from './ContractTemplatesManager'
import { getPerms } from '@/lib/permissions'

export default async function ContractTemplatesPage() {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) redirect('/deals')
  const orgId = session.user.orgId

  const [templates, org] = await Promise.all([
    prisma.contractTemplate.findMany({ where: { orgId }, orderBy: { nazev: 'asc' } }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { prilohaVopPath: true, prilohaVzspPath: true, prilohaCenikPath: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nastavení</h1>
      </div>
      <ContractTemplatesManager
        templates={templates.map(t => ({ id: t.id, nazev: t.nazev, popis: t.popis, obsah: t.obsah }))}
        prilohaVop={org?.prilohaVopPath ?? null}
        prilohaVzsp={org?.prilohaVzspPath ?? null}
        prilohaCenik={org?.prilohaCenikPath ?? null}
      />
    </div>
  )
}
