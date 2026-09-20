import { redirect } from 'next/navigation'

// Kontrakty žijí v servisním portfoliu (klient → zařízení → smlouva). Route zachována
// kvůli starým odkazům/záložkám.
export default function KontraktyRedirect() {
  redirect('/servis/portfolio')
}
