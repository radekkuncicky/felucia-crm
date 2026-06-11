import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import TemplateForm from '../TemplateForm'
import Link from 'next/link'

type TemplateItem = { product_id?: string; nazev: string; mnozstvi: number; cena_za_kus: number; poznamky?: string }

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId

  const template = await prisma.quoteTemplate.findFirst({ where: { id: params.id, orgId } })

  if (!template) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/quote-templates" className="text-gray-400 hover:text-gray-600 text-sm">← Vzorové nabídky</Link>
        <h1 className="text-2xl font-bold text-gray-900">Upravit šablonu</h1>
      </div>
      <TemplateForm
        template={{ id: template.id, nazev: template.nazev, popis: template.popis ?? '', technologie: template.technologie ?? '', polozky: Array.isArray(template.polozky) ? (template.polozky as TemplateItem[]) : [] }}
      />
    </div>
  )
}
