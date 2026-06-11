import { headers } from 'next/headers'
import { prisma } from './prisma'

export async function getTenantSlug(): Promise<string | null> {
  const headersList = headers()
  return headersList.get('x-tenant-slug')
}

export async function getTenantOrg(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    select: { id: true, nazev: true, plan: true, logo: true, slug: true },
  })
}

export function getSubdomainUrl(slug: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  if (isDev) return 'http://localhost:3000'
  return `https://${slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'}`
}
