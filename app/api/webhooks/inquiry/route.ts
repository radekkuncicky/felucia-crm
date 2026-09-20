import { prisma } from '@/lib/prisma'
import { timingSafeEqual } from 'crypto'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'
import { Technologie } from '@prisma/client'

// SECURITY FIX: Webhook secret is mandatory — reject all requests if not configured
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

const techMap: Record<string, Technologie> = {
  'tepelne-cerpadlo': 'TEPELNE_CERPADLO',
  'tepelné-čerpadlo': 'TEPELNE_CERPADLO',
  'rekuperace': 'REKUPERACE',
  'rekuperační': 'REKUPERACE',
  'klimatizace': 'KLIMA',
  'klima': 'KLIMA',
  'podlahove-topeni': 'PODLAHOVE_TOPENI',
  'podlahové-topení': 'PODLAHOVE_TOPENI',
  'vzduchotechnika': 'VZDUCHOTECHNIKA',
  'jine': 'JINE',
  'jiné': 'JINE',
  'other': 'JINE',
}

async function generateKod(orgId: string): Promise<string> {
  const yr = new Date().getFullYear()
  const yrShort = yr % 100
  const startOfYear = new Date(`${yr}-01-01`)
  const endOfYear = new Date(`${yr + 1}-01-01`)
  const count = await prisma.deal.count({
    where: { orgId, vytvoreno: { gte: startOfYear, lt: endOfYear } },
  })
  return `OP-${yrShort.toString().padStart(2, '0')}-${(count + 1).toString().padStart(3, '0')}`
}

export async function POST(req: Request) {
  // SECURITY FIX: Require WEBHOOK_SECRET to be configured — if missing, reject all requests
  // to prevent unauthenticated deal creation in a multi-tenant environment
  if (!WEBHOOK_SECRET) {
    console.error('[webhook/inquiry] WEBHOOK_SECRET is not configured — rejecting request')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }
  const incoming = req.headers.get('x-webhook-secret') ?? ''
  const a = Buffer.from(incoming), b = Buffer.from(WEBHOOK_SECRET)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (checkRateLimit(`webhook-inquiry:${getClientIp(req)}`, 60, 60 * 60 * 1000).limited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { jmeno, prijmeni, email, telefon, technologie, zprava } = body

  if (!jmeno || !prijmeni || !email || !technologie) {
    return NextResponse.json({ error: 'Chybí povinná pole: jmeno, prijmeni, email, technologie' }, { status: 400 })
  }

  // Resolve technologie enum
  const tech: Technologie = techMap[technologie.toLowerCase()] ?? 'JINE'

  // Find first active org (webhook is org-agnostic for now; pick by zdroj or fallback to first)
  // In future, add orgId to request or resolve via webhook secret
  const org = await prisma.organization.findFirst({ where: { aktivni: true }, orderBy: { vytvoreno: 'asc' } })
  if (!org) return NextResponse.json({ error: 'No active organization' }, { status: 500 })
  const orgId = org.id

  // Find or create client by email
  let client = await prisma.client.findFirst({ where: { orgId, email } })
  if (!client) {
    client = await prisma.client.create({
      data: { orgId, jmeno, prijmeni, email, telefon: telefon ?? null },
    })
  }

  // Generate deal code and create deal
  const kod = await generateKod(orgId)
  const deal = await prisma.deal.create({
    data: {
      orgId,
      clientId: client.id,
      kod,
      technologie: tech,
      stav: 'NOVY',
      predmet: `Poptávka – ${jmeno} ${prijmeni}`,
    },
  })

  // Add activity with message text
  if (zprava) {
    await prisma.activity.create({
      data: {
        dealId: deal.id,
        typ: 'POZNAMKA',
        popis: zprava,
        datum: new Date(),
        splneno: false,
      },
    })
  }

  return NextResponse.json({ success: true, dealId: deal.id, clientId: client.id }, { status: 201 })
}
