import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'

// DEPRECATED (servis-refactor Fáze 3): servisní zakázky se přesunuly do modulu Servis.
// Zakázky typ=SERVISNI (prodejní Zakazka) se už nezakládají. Tato route jen přesměrovává.
export default async function ServisniZakazkyRedirect() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { serviceAccess: true, role: true },
  })
  if (user?.role !== 'ADMIN' && !user?.serviceAccess) redirect('/zakazky')

  redirect('/servis/zakazky')
}
