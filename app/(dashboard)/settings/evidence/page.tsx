import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import EvidenceManager from './EvidenceManager'
import { IconUser, IconClipboard, IconDocument, IconBox } from '@/components/ui/Icons'

const ENTITY_TYPES = [
  { key: 'Client', label: 'Klient', icon: <IconUser className="w-5 h-5" /> },
  { key: 'Deal', label: 'Obchodní případ', icon: <IconClipboard className="w-5 h-5" /> },
  { key: 'Quote', label: 'Nabídka', icon: <IconDocument className="w-5 h-5" /> },
  { key: 'Product', label: 'Produkt', icon: <IconBox className="w-5 h-5" /> },
]

export default async function EvidencePage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')
  const orgId = session.user.orgId

  const fields = await prisma.customField.findMany({
    where: { orgId },
    orderBy: [{ entityType: 'asc' }, { poradi: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nastavení evidence</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Definujte vlastní pole pro záznamy v CRM</p>
      </div>
      <EvidenceManager
        entityTypes={ENTITY_TYPES}
        fields={fields.map(f => ({
          id: f.id,
          entityType: f.entityType,
          nazev: f.nazev,
          typ: f.typ,
          povinne: f.povinne,
          povinneOdStavu: f.povinneOdStavu ?? '',
          poradi: f.poradi,
          aktivni: f.aktivni,
        }))}
      />
    </div>
  )
}
