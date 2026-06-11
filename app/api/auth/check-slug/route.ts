import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const FORBIDDEN_SLUGS = ['www', 'app', 'api', 'admin', 'mail', 'felucia', 'test', 'demo', 'staging']

export async function GET(req: Request) {
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
