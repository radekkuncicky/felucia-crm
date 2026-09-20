import { redirect } from 'next/navigation'

// Zařízení žijí v servisním portfoliu (klient → zařízení → smlouva). Route zachována
// kvůli starým odkazům/záložkám.
export default function ZarizeniRedirect() {
  redirect('/servis/portfolio')
}
