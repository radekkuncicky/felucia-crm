import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ExtensionsManager from './ExtensionsManager'

const AVAILABLE_EXTENSIONS = [
  { nazev: 'digisign', label: 'DigiSign', popis: 'Elektronické podepisování dokumentů', icon: '✍️' },
  { nazev: 'mailchimp', label: 'Mailchimp', popis: 'Email marketing a automatizace', icon: '📧' },
  { nazev: 'merk', label: 'Merk', popis: 'Obchodní rejstřík – automatické doplnění dat firmy', icon: '🏢' },
  { nazev: 'ai-calls', label: 'AI analýza hovorů', popis: 'Nahrávání a přepis telefonních hovorů pomocí AI', icon: '🎙️' },
]

export default async function ExtensionsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')
  const orgId = session.user.orgId

  const extensions = await prisma.extension.findMany({ where: { orgId } })
  const extMap = Object.fromEntries(extensions.map(e => [e.nazev, e]))

  const data = AVAILABLE_EXTENSIONS.map(e => ({
    ...e,
    aktivni: extMap[e.nazev]?.aktivni ?? false,
    apiKlic: extMap[e.nazev]?.apiKlic ?? '',
    id: extMap[e.nazev]?.id ?? null,
  }))

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://crm.felucia.io'
  const webhookUrl = `${baseUrl}/api/webhooks/inquiry`
  const webhookSecret = process.env.WEBHOOK_SECRET ?? '(nenastaveno)'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rozšíření</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Aktivujte a nakonfigurujte rozšíření pro váš CRM</p>
      </div>

      {/* Webhook info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Webhook – příjem poptávek</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Napojte svůj web nebo kontaktní formulář na CRM. Každá poptávka se automaticky vytvoří jako nový obchodní případ.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Webhook URL (POST)</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 dark:text-white break-all">
                {webhookUrl}
              </code>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Secret (hlavička X-Webhook-Secret)</label>
            <code className="block bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 dark:text-white break-all">
              {webhookSecret}
            </code>
          </div>
          <div className="pt-1">
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Povinná těla požadavku: <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">jmeno</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">prijmeni</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">email</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">technologie</code> • Volitelné: <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">telefon</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">zprava</code>
            </p>
          </div>
        </div>
      </div>

      <ExtensionsManager extensions={data} />
    </div>
  )
}
