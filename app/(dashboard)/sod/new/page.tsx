import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { notFound } from 'next/navigation'
import SodNewClient from './SodNewClient'

export default async function SodNewPage({
  searchParams,
}: {
  searchParams: { dealId?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  if (!getPerms(session.user).obchod) notFound()

  const dealId = searchParams.dealId ?? null

  return <SodNewClient dealId={dealId} />
}
