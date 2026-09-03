import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ApiKeysManager from './ApiKeysManager'
import WebhooksManager from './WebhooksManager'
import { getPerms } from '@/lib/permissions'

export default async function ApiKeysPage() {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) redirect('/dashboard')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API a webhooky</h1>
      <ApiKeysManager />
      <WebhooksManager />
    </div>
  )
}
