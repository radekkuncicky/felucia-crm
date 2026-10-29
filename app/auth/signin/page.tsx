import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getTenantSlug, getTenantOrg } from '@/lib/tenant'
import SigninForm from './SigninForm'

/** Návrat po přihlášení jen na vlastní relativní cestu (např. OAuth souhlas /oauth/authorize) */
function bezpecnyNavrat(v: unknown): string | null {
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : null
}

export default async function SigninPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  const navrat = bezpecnyNavrat(searchParams.callbackUrl)
  const session = await getServerSession(authOptions)
  if (session && !session.user.isDemo) redirect(navrat ?? '/dashboard')

  const slug = await getTenantSlug()
  const org = slug ? await getTenantOrg(slug) : null

  return <SigninForm org={org} callbackUrl={navrat} />
}
