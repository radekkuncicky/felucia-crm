import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

function corsHeaders(origin: string | null, allowedOrigins: string | null) {
  const allowed = resolveAllowedOrigin(origin, allowedOrigins)
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function resolveAllowedOrigin(origin: string | null, allowedOrigins: string | null): string {
  if (!allowedOrigins) return origin ?? '*'
  const list = allowedOrigins.split(',').map(s => s.trim()).filter(Boolean)
  if (list.includes('*')) return origin ?? '*'
  if (origin && list.includes(origin)) return origin
  return list[0] ?? '*'
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const apiKey = req.headers.get('x-api-key') ?? extractBearer(req)
  const key = apiKey ? await prisma.apiKey.findUnique({ where: { klic: apiKey } }) : null
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, key?.allowedOrigins ?? null) })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const ip = getClientIp(req)

  const ipLimit = checkRateLimit(`public_leads:ip:${ip}`, 20, 10 * 60 * 1000)
  if (ipLimit.limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků. Zkuste to znovu za chvíli.' }, {
      status: 429,
      headers: { 'Retry-After': '600' },
    })
  }

  const apiKeyValue = req.headers.get('x-api-key') ?? extractBearer(req)
  if (!apiKeyValue) {
    return NextResponse.json({ error: 'Chybí API klíč.' }, { status: 401 })
  }

  const apiKey = await prisma.apiKey.findUnique({ where: { klic: apiKeyValue } })
  if (!apiKey || !apiKey.aktivni) {
    return NextResponse.json({ error: 'Neplatný nebo neaktivní API klíč.' }, { status: 401 })
  }

  if (origin && apiKey.allowedOrigins) {
    const list = apiKey.allowedOrigins.split(',').map(s => s.trim()).filter(Boolean)
    if (!list.includes('*') && !list.includes(origin)) {
      return NextResponse.json({ error: 'Origin není povolen.' }, { status: 403 })
    }
  }

  const keyLimit = checkRateLimit(`public_leads:key:${apiKey.id}`, 200, 60 * 60 * 1000)
  if (keyLimit.limited) {
    return NextResponse.json({ error: 'Limit API klíče byl překročen.' }, { status: 429 })
  }

  // Plan check — leady only STANDARD+
  const org = await prisma.organization.findUnique({
    where: { id: apiKey.orgId },
    select: { plan: true },
  })
  if (!org || org.plan === 'STARTER') {
    return NextResponse.json({ error: 'Modul Leady není dostupný v tomto plánu.' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatné JSON tělo požadavku.' }, { status: 400 })
  }

  const jmeno = typeof body.jmeno === 'string' ? body.jmeno.trim() : ''
  const prijmeni = typeof body.prijmeni === 'string' ? body.prijmeni.trim() : ''
  const telefon = typeof body.telefon === 'string' ? body.telefon.trim() : null
  const email = typeof body.email === 'string' ? body.email.trim() : null
  const firma = typeof body.firma === 'string' ? body.firma.trim() : null
  const zprava = typeof body.zprava === 'string' ? body.zprava.trim() : null

  const fullName = [jmeno, prijmeni].filter(Boolean).join(' ') || firma || ''
  if (!fullName) {
    return NextResponse.json({ error: 'Pole jmeno (nebo firma) je povinné.' }, { status: 400 })
  }

  const lead = await prisma.lead.create({
    data: {
      orgId: apiKey.orgId,
      jmeno: fullName,
      email: email || null,
      telefon: telefon || null,
      firma: firma || null,
      zprava: zprava || null,
      zdroj: 'WEB_FORMULAR',
      status: 'NOVY',
      apiKeyId: apiKey.id,
    },
  })

  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  notifyNewLead(apiKey.orgId, lead.id, fullName).catch(() => {})

  const hdrs = corsHeaders(origin, apiKey.allowedOrigins)
  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201, headers: hdrs })
}

async function notifyNewLead(orgId: string, leadId: string, jmeno: string) {
  const settings = await prisma.orgSettings.findUnique({ where: { orgId } })
  if (!settings?.notifNovyLead) return

  const users = await prisma.user.findMany({
    where: { orgId, aktivni: true, role: { in: ['ADMIN', 'OBCHODNIK'] } },
    select: { id: true },
  })

  await prisma.notification.createMany({
    data: users.map(u => ({
      orgId,
      userId: u.id,
      typ: 'NOVY_LEAD',
      zprava: `Nový lead z webu: ${jmeno}`,
      url: `/leady/${leadId}`,
    })),
  })
}

function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7).trim()
}
