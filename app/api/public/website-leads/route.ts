import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { notifyNewLead } from '@/lib/leadNotify'

const MAX_BODY_BYTES = 32 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000

interface WebsiteLeadBody {
  source?: unknown
  submittedAt?: unknown
  contact?: {
    name?: unknown
    email?: unknown
    phone?: unknown
  }
  service?: unknown
  message?: unknown
  order?: {
    price?: unknown
    serviceSlug?: unknown
  }
  hasAttachments?: unknown
  attachmentsInfo?: {
    count?: unknown
    note?: unknown
  }
  meta?: {
    pageUrl?: unknown
  }
}

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

function err(status: number, error: string, headers?: Record<string, string>, details?: Record<string, string>) {
  return NextResponse.json(
    details ? { ok: false, error, details } : { ok: false, error },
    { status, headers }
  )
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const apiKeyValue = req.headers.get('x-api-key')
  const key = apiKeyValue ? await prisma.apiKey.findUnique({ where: { klic: apiKeyValue } }) : null
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, key?.allowedOrigins ?? null) })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const origin = req.headers.get('origin')

  const ipLimit = checkRateLimit(`website_leads:ip:${ip}`, 20, 60 * 1000)
  if (ipLimit.limited) {
    log(ip, 429)
    return err(429, 'rate_limited')
  }

  // Auth se ověřuje z hlavičky (levné) dřív, než se vůbec čte tělo requestu —
  // nginx na téhle doméně povoluje těla až 50 MB, takže neautentizovaný
  // požadavek by jinak donutil proces bufferovat velký payload ještě před 401.
  const apiKeyValue = req.headers.get('x-api-key')
  if (!apiKeyValue) {
    log(ip, 401)
    return err(401, 'unauthorized')
  }

  const apiKey = await prisma.apiKey.findUnique({ where: { klic: apiKeyValue } })
  if (!apiKey || !apiKey.aktivni) {
    log(ip, 401)
    return err(401, 'unauthorized')
  }

  if (origin && apiKey.allowedOrigins) {
    const list = apiKey.allowedOrigins.split(',').map(s => s.trim()).filter(Boolean)
    if (!list.includes('*') && !list.includes(origin)) {
      log(ip, 403)
      return err(403, 'forbidden_origin')
    }
  }

  const hdrs = corsHeaders(origin, apiKey.allowedOrigins)

  const text = await req.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    log(ip, 400)
    return err(400, 'invalid_json', hdrs)
  }

  let body: WebsiteLeadBody
  try {
    body = JSON.parse(text)
  } catch {
    log(ip, 400)
    return err(400, 'invalid_json', hdrs)
  }

  const org = await prisma.organization.findUnique({
    where: { id: apiKey.orgId },
    select: { plan: true },
  })
  if (!org || org.plan === 'STARTER') {
    log(ip, 403)
    return err(403, 'forbidden', hdrs)
  }

  const source = typeof body.source === 'string' ? body.source.trim() : ''
  const submittedAtRaw = typeof body.submittedAt === 'string' ? body.submittedAt : ''
  const submittedAt = submittedAtRaw ? new Date(submittedAtRaw) : null
  const name = typeof body.contact?.name === 'string' ? body.contact.name.trim() : ''
  const emailRaw = typeof body.contact?.email === 'string' ? body.contact.email.trim() : ''
  const phone = typeof body.contact?.phone === 'string' ? body.contact.phone.trim().slice(0, 20) : null

  const details: Record<string, string> = {}
  if (!source) details.source = 'required'
  if (!submittedAt || isNaN(submittedAt.getTime())) details.submittedAt = 'required'
  if (!name || name.length > 100) details.name = 'required'
  if (!emailRaw || emailRaw.length > 255 || !EMAIL_RE.test(emailRaw)) details.email = 'required'

  if (Object.keys(details).length > 0) {
    log(ip, 422)
    return err(422, 'validation', hdrs, details)
  }

  const email = emailRaw.toLowerCase()

  // Idempotence: retry se stejnou kombinací email + submittedAt do 5 min od
  // přijetí → vrátit původní lead beze změny (dle zadání). Přesná shoda na
  // submittedAt (ne jen časové okno) zabrání tichému zahození jiného,
  // reálného podání se stejným e-mailem.
  const existing = await prisma.lead.findFirst({
    where: {
      orgId: apiKey.orgId,
      apiKeyId: apiKey.id,
      email,
      submittedAt,
      vytvoreno: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) },
    },
    orderBy: { vytvoreno: 'desc' },
  })
  if (existing) {
    log(ip, 200)
    return NextResponse.json({ ok: true, id: existing.id }, { headers: hdrs })
  }

  const service = typeof body.service === 'string' ? body.service.trim().slice(0, 100) : null
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : null
  const orderPrice = typeof body.order?.price === 'number' ? body.order.price : null
  const orderSlug = typeof body.order?.serviceSlug === 'string' ? body.order.serviceSlug.trim().slice(0, 100) : null
  const attachmentsCount = typeof body.attachmentsInfo?.count === 'number' ? body.attachmentsInfo.count : null
  const attachmentsNote = typeof body.attachmentsInfo?.note === 'string' ? body.attachmentsInfo.note.trim().slice(0, 300) : null
  const pageUrl = typeof body.meta?.pageUrl === 'string' ? body.meta.pageUrl.trim().slice(0, 500) : null

  const zprava = buildZprava({ source, service, message, orderPrice, orderSlug, attachmentsCount, attachmentsNote, pageUrl })

  const lead = await prisma.lead.create({
    data: {
      orgId: apiKey.orgId,
      jmeno: name,
      email,
      telefon: phone,
      zdroj: 'WEB_FORMULAR',
      status: 'NOVY',
      zprava,
      apiKeyId: apiKey.id,
      submittedAt,
    },
  })

  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  notifyNewLead(apiKey.orgId, lead.id, name).catch(() => {})

  log(ip, 200)
  return NextResponse.json({ ok: true, id: lead.id }, { headers: hdrs })
}

function buildZprava(fields: {
  source: string
  service: string | null
  message: string | null
  orderPrice: number | null
  orderSlug: string | null
  attachmentsCount: number | null
  attachmentsNote: string | null
  pageUrl: string | null
}) {
  const lines: string[] = [`Zdroj formuláře: ${fields.source}`]
  if (fields.service) lines.push(`Služba: ${fields.service}`)
  if (fields.orderPrice !== null) {
    lines.push(`Objednávka: ${fields.orderPrice.toLocaleString('cs-CZ')} Kč${fields.orderSlug ? ` (${fields.orderSlug})` : ''}`)
  }
  if (fields.attachmentsCount) {
    lines.push(`Přílohy: ${fields.attachmentsCount}${fields.attachmentsNote ? ` — ${fields.attachmentsNote}` : ''}`)
  }
  if (fields.pageUrl) lines.push(`Stránka: ${fields.pageUrl}`)
  if (fields.message) lines.push('', fields.message)
  return lines.join('\n')
}

function log(ip: string, status: number) {
  console.log(`[website-leads] ip=${ip} status=${status}`)
}
