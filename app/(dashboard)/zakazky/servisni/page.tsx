import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { getPerms } from '@/lib/permissions'

// DEPRECATED (servis-refactor Fáze 3): servisní zakázky se přesunuly do modulu Servis.
// Zakázky typ=SERVISNI (prodejní Zakazka) se už nezakládají. Tato route jen přesměrovává.
export default async function ServisniZakazkyRedirect() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  if (getPerms(session.user).servis === 'ZADNY') redirect('/zakazky')

  redirect('/servis/zakazky')
}
