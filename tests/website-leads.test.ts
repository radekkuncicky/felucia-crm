import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as leadsPost } from '@/app/api/public/website-leads/route'
import { leadPredmet, sluzbaToTechnologie } from '@/lib/leadService'

const RUN = `website-leads-${Date.now()}`

let orgId: string
let apiKey: string

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { nazev: 'Test Website Leads', slug: RUN, plan: 'STANDARD' },
  })
  orgId = org.id
  apiKey = `nk_${RUN}`
  await prisma.apiKey.create({ data: { orgId, nazev: 'Web', klic: apiKey } })
})

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/public/website-leads', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.1.${Math.floor(Math.random() * 250)}`,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/public/website-leads', () => {
  it('bez klíče → 401', async () => {
    const res = await leadsPost(req({}))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('se špatným klíčem → 401', async () => {
    const res = await leadsPost(req({}, { 'x-api-key': 'wrong' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('minimální validní payload → 200', async () => {
    const res = await leadsPost(
      req(
        {
          source: 'contact_form',
          submittedAt: '2026-07-22T12:00:00.000Z',
          contact: { name: 'Test Test', email: 'test@example.cz' },
        },
        { 'x-api-key': apiKey }
      )
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(typeof data.id).toBe('string')

    const lead = await prisma.lead.findUnique({ where: { id: data.id } })
    expect(lead?.jmeno).toBe('Test Test')
    expect(lead?.email).toBe('test@example.cz')
    expect(lead?.zdroj).toBe('WEB_FORMULAR')
  })

  it('chybějící povinné pole → 422 s details', async () => {
    const res = await leadsPost(
      req({ source: 'contact_form', submittedAt: '2026-07-22T12:00:00.000Z' }, { 'x-api-key': apiKey })
    )
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe('validation')
    expect(data.details.name).toBe('required')
    expect(data.details.email).toBe('required')
  })

  it('nevalidní JSON → 400', async () => {
    const badReq = new NextRequest('http://localhost/api/public/website-leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'x-forwarded-for': '10.0.2.1' },
      body: '{not json',
    })
    const res = await leadsPost(badReq)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, error: 'invalid_json' })
  })

  it('duplicitní request do 5 min → 200 se stejným id (idempotence)', async () => {
    const payload = {
      source: 'contact_form',
      submittedAt: '2026-07-22T12:10:00.000Z',
      contact: { name: 'Jana Nováková', email: 'jana@example.cz' },
    }
    const res1 = await leadsPost(req(payload, { 'x-api-key': apiKey }))
    const id1 = (await res1.json()).id

    const res2 = await leadsPost(req(payload, { 'x-api-key': apiKey }))
    expect(res2.status).toBe(200)
    const data2 = await res2.json()
    expect(data2.id).toBe(id1)

    const count = await prisma.lead.count({ where: { orgId, email: 'jana@example.cz' } })
    expect(count).toBe(1)
  })

  it('stejný e-mail, ale jiný submittedAt do 5 min → NENÍ duplicita, vytvoří se nový lead', async () => {
    const email = 'petr@example.cz'
    const res1 = await leadsPost(
      req(
        { source: 'contact_form', submittedAt: '2026-07-22T13:00:00.000Z', contact: { name: 'Petr První', email } },
        { 'x-api-key': apiKey }
      )
    )
    const id1 = (await res1.json()).id

    const res2 = await leadsPost(
      req(
        { source: 'order', submittedAt: '2026-07-22T13:02:00.000Z', contact: { name: 'Petr Druhý', email }, order: { price: 1000, serviceSlug: 'x' } },
        { 'x-api-key': apiKey }
      )
    )
    expect(res2.status).toBe(200)
    const id2 = (await res2.json()).id
    expect(id2).not.toBe(id1)

    const count = await prisma.lead.count({ where: { orgId, email } })
    expect(count).toBe(2)
  })

  it('plný payload s order a hasAttachments → 200, metadata ve vlastních sloupcích', async () => {
    const res = await leadsPost(
      req(
        {
          source: 'order',
          submittedAt: '2026-07-22T12:05:00.000Z',
          contact: { name: 'Jan Novák', email: 'jan@x.cz', phone: '+420 777 111 222' },
          service: 'klimatizace',
          message: 'Chci klimu do 3+1',
          order: { price: 42000, serviceSlug: 'klimatizace-1-1' },
          hasAttachments: true,
          attachmentsInfo: { count: 2, note: 'Přílohy byly zaslány e-mailem na info@nanto.cz' },
        },
        { 'x-api-key': apiKey }
      )
    )
    expect(res.status).toBe(200)
    const data = await res.json()

    const lead = await prisma.lead.findUnique({ where: { id: data.id } })
    expect(lead?.telefon).toBe('+420 777 111 222')
    expect(lead?.sluzba).toBe('klimatizace')
    expect(lead?.zdrojFormulare).toBe('order')
    expect(lead?.objednavka).toBe('klimatizace-1-1')
    expect(Number(lead?.odhadovanaHodnota)).toBe(42000)
    expect(lead?.prilohy).toContain('2')
    // Zpráva obsahuje jen text od klienta — žádnou hlavičku formuláře
    expect(lead?.zprava).toBe('Chci klimu do 3+1')
    expect(lead?.zprava).not.toContain('Zdroj formuláře')
  })

  it('předmět OP se skládá ze služby, ne z hlavičky formuláře', async () => {
    const res = await leadsPost(
      req(
        {
          source: 'contact_page',
          submittedAt: '2026-07-22T12:07:00.000Z',
          contact: { name: 'Eva Předmětová', email: 'eva@x.cz' },
          service: 'tepelne-cerpadlo',
          message: 'Dobrý den, poptávám tepelné čerpadlo pro rodinný dům v Ostravě, děkuji.',
        },
        { 'x-api-key': apiKey }
      )
    )
    const lead = await prisma.lead.findUnique({ where: { id: (await res.json()).id } })
    expect(leadPredmet(lead!)).toBe('Tepelné čerpadlo')
    expect(sluzbaToTechnologie(lead!.sluzba)).toBe('TEPELNE_CERPADLO')
  })

  it('bez služby se předmět vezme ze zprávy a zkrátí na hranici slova', async () => {
    const lead = {
      jmeno: 'Karel Dlouhý',
      sluzba: null,
      zprava: 'Dobrý den, chtěl bych nacenit klimatizaci do bytu 3+1 v Ostravě-Porubě včetně montáže a revize.',
    }
    const predmet = leadPredmet(lead)
    expect(predmet.length).toBeLessThanOrEqual(81)
    expect(predmet).not.toContain('Zdroj formuláře')
    expect(predmet.endsWith('…')).toBe(true)
    // řez padne na hranici slova — za useknutou částí následuje v originálu mezera
    const bezVypustky = predmet.slice(0, -1)
    expect(lead.zprava.startsWith(bezVypustky)).toBe(true)
    expect(lead.zprava[bezVypustky.length]).toBe(' ')
  })

  it('STARTER plán nemá přístup → 403', async () => {
    const starterOrg = await prisma.organization.create({
      data: { nazev: 'Starter Org', slug: `${RUN}-starter`, plan: 'STARTER' },
    })
    const starterKey = `nk_${RUN}-starter`
    await prisma.apiKey.create({ data: { orgId: starterOrg.id, nazev: 'Web', klic: starterKey } })

    const res = await leadsPost(
      req(
        { source: 'contact_form', submittedAt: '2026-07-22T12:00:00.000Z', contact: { name: 'X', email: 'x@y.cz' } },
        { 'x-api-key': starterKey }
      )
    )
    expect(res.status).toBe(403)
  })
})
