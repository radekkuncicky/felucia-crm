import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ClientsTable from './ClientsTable'
import SectionTabActivator from '@/components/SectionTabActivator'

export default async function ClientsPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId

  const clients = await prisma.client.findMany({
    where: { orgId },
    include: { _count: { select: { deals: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  const rows = clients.map(c => ({
    id: c.id,
    typKlienta: c.typKlienta as 'FYZICKA_OSOBA' | 'FIRMA',
    jmeno: c.jmeno,
    prijmeni: c.prijmeni,
    telefon: c.telefon,
    email: c.email,
    ico: c.ico,
    mesto: c.mesto,
    ulice: c.ulice,
    psc: c.psc,
    dealCount: c._count.deals,
    vytvoreno: c.vytvoreno.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <SectionTabActivator id="clients" label="Klienti" href="/clients" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Klienti</h1>
        <Link href="/clients/new" className="hidden sm:flex bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors items-center gap-1">
          + Nový klient
        </Link>
      </div>
      <ClientsTable clients={rows} />
      {/* Mobile FAB */}
      <Link
        href="/clients/new"
        className="fab-bottom fixed right-4 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-white shadow-lg flex items-center justify-center sm:hidden transition-colors"
        style={{ paddingBottom: 0 }}
        aria-label="Nový klient"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </Link>
    </div>
  )
}
