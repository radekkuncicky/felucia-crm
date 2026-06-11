import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getTenantSlug, getTenantOrg } from '@/lib/tenant'
import SigninForm from './SigninForm'

export default async function SigninPage() {
  const session = await getServerSession(authOptions)
  if (session && !session.user.isDemo) redirect('/dashboard')

  const slug = await getTenantSlug()
  const org = slug ? await getTenantOrg(slug) : null

  return <SigninForm org={org} />
}
