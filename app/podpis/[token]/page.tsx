import type { Metadata } from 'next'
import PodpisClient from './PodpisClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Podpis smlouvy',
  robots: { index: false, follow: false },
}

// Veřejná stránka podpisu smlouvy — bez přihlášení, autorizace tokenem
// z e-mailu + SMS kódem (řeší /api/public/podpis/[token]).
export default function PodpisPage({ params }: { params: { token: string } }) {
  return <PodpisClient token={params.token} />
}
