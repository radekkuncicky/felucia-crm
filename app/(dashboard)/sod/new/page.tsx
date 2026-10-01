import { redirect } from 'next/navigation'

/** Samostatná stránka nové SOD zrušena — smlouva vzniká v detailu OP (GenerateSodModal). */
export default function SodNewRedirect({ searchParams }: { searchParams: { dealId?: string } }) {
  redirect(searchParams.dealId ? `/deals/${encodeURIComponent(searchParams.dealId)}` : '/deals')
}
