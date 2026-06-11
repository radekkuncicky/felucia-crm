import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ActivitiesClient from './ActivitiesClient'
import SectionTabActivator from '@/components/SectionTabActivator'

const typLabels: Record<string, string> = {
  HOVOR: 'Telefonáty',
  EMAIL: 'Emaily',
  SCHUZKA: 'Schůzky',
  POZNAMKA: 'Poznámky',
  UKOL: 'Úkoly',
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: { typ?: string }
}) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const typFilter = searchParams.typ ?? ''

  const activities = await prisma.activity.findMany({
    where: {
      deal: { orgId },
      ...(typFilter ? { typ: typFilter as 'HOVOR' | 'EMAIL' | 'SCHUZKA' | 'POZNAMKA' | 'UKOL' } : {}),
    },
    include: {
      user: { select: { id: true, jmeno: true } },
      deal: {
        select: {
          id: true,
          predmet: true,
          kod: true,
          client: { select: { id: true, jmeno: true, prijmeni: true } },
        },
      },
    },
    orderBy: { datum: 'desc' },
    take: 500,
  })

  const heading = typFilter ? (typLabels[typFilter] ?? 'Aktivity') : 'Aktivity'

  return (
    <div className="space-y-6">
      <SectionTabActivator id="activities" label="Aktivity" href="/activities" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{heading}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Přehled aktivit napříč všemi obchodními případy
        </p>
      </div>

      <ActivitiesClient
        activities={activities.map(a => ({
          id: a.id,
          typ: a.typ,
          popis: a.popis,
          datum: new Date(a.datum).toISOString().split('T')[0],
          splneno: a.splneno,
          stav: a.stav as 'PLANOVANA' | 'DOKONCENA' | 'ZRUSENA',
          cil: a.cil ?? null,
          vysledek: a.vysledek ?? null,
          user: a.user,
          deal: {
            id: a.deal.id,
            predmet: a.deal.predmet,
            kod: a.deal.kod,
            client: a.deal.client,
          },
        }))}
        defaultTyp={typFilter}
      />
    </div>
  )
}
