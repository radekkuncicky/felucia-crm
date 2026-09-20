import { NextResponse } from 'next/server'
import { FORBIDDEN_SLUGS } from '@/lib/slug'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'


export async function GET(req: Request) {
  // Bez limitu by šlo enumerovat slugy (= názvy zákazníků) hrubou silou
  if (checkRateLimit(`check-slug:${getClientIp(req)}`, 60, 60 * 1000).limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků' }, { status: 429 })
  }
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('slug') ?? ''

  const slug = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)

  if (!slug) {
    return NextResponse.json({ available: false, slug: '' })
  }

  if (FORBIDDEN_SLUGS.includes(slug)) {
    return NextResponse.json({ available: false, slug })
  }

  const existing = await prisma.organization.findUnique({ where: { slug } })
  return NextResponse.json({ available: !existing, slug })
}
