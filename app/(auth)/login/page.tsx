import { redirect } from 'next/navigation'

/** Starý vstup (žlutý NANTO) — jen přesměrování kvůli starým odkazům a záložkám. */
export default function LoginRedirect({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === 'string') qs.set(k, v)
  }
  const q = qs.toString()
  redirect(q ? `/auth/signin?${q}` : '/auth/signin')
}
