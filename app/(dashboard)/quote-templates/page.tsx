import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Technologie } from '@prisma/client'
import DeleteTemplateButton from './DeleteTemplateButton'
import DuplicateTemplateButton from './DuplicateTemplateButton'

const techLabels: Record<Technologie, string> = {
  KLIMA: 'Klimatizace', TEPELNE_CERPADLO: 'Tepelné čerpadlo', REKUPERACE: 'Rekuperace',
  PODLAHOVE_TOPENI: 'Podlahové topení', VZDUCHOTECHNIKA: 'Vzduchotechnika', JINE: 'Jiné',
}

export default async function QuoteTemplatesPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId

  const templates = await prisma.quoteTemplate.findMany({
    where: { orgId },
    orderBy: { nazev: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vzorové nabídky</h1>
        <Link
          href="/quote-templates/new"
          className="bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + Nová šablona
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Název</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Technologie</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Položky</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {templates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                  Žádné šablony. Přidejte první vzorovou nabídku.
                </td>
              </tr>
            )}
            {templates.map((tpl) => {
              type PolozkaItem = { nazev?: string; cena_za_kus?: number; mnozstvi?: number }
              const polozky = (Array.isArray(tpl.polozky) ? tpl.polozky : []) as PolozkaItem[]
              return (
                <tr key={tpl.id} className="hover:bg-gray-50 transition-colors align-top">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{tpl.nazev}</p>
                    {tpl.popis && <p className="text-xs text-gray-400 mt-0.5">{tpl.popis}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {tpl.technologie ? techLabels[tpl.technologie] : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {polozky.length === 0 ? (
                      <span className="text-xs text-gray-400">Žádné položky</span>
                    ) : (
                      <ul className="space-y-1">
                        {polozky.map((p, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-4 text-sm">
                            <span className="text-gray-800">{p.nazev ?? '—'}</span>
                            <span className="text-gray-400 text-xs whitespace-nowrap">
                              {p.mnozstvi != null ? `${p.mnozstvi} ×` : ''}{' '}
                              {p.cena_za_kus != null ? `${Number(p.cena_za_kus).toLocaleString('cs-CZ')} Kč` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/quote-templates/${tpl.id}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                        Upravit
                      </Link>
                      <DuplicateTemplateButton id={tpl.id} />
                      <DeleteTemplateButton id={tpl.id} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
