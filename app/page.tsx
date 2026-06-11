import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import FeluciaLanding from './FeluciaLanding'

export const metadata = {
  title: 'Felucia — CRM pro HVAC firmy',
  description: 'Spravujte zakázky, nabídky a klienty na jednom místě. S AI asistentkou Dášou ušetříte hodiny každý týden.',
  openGraph: {
    title: 'Felucia — CRM pro HVAC firmy',
    description: 'Specializovaný CRM pro HVAC profesionály. 14 dní zdarma, bez závazků.',
    url: 'https://felucia.io',
    siteName: 'Felucia',
    type: 'website',
  },
}

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session && !session.user.isDemo) redirect('/dashboard')
  return <FeluciaLanding />
}
