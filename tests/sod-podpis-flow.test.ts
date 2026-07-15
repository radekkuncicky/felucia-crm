import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sha256, otpHash, generateToken, podpisCookieName } from '@/lib/sodPodpis'
import { sweepExpirovanePodpisy } from '@/worker/podpisy'

// PDF build spouští Puppeteer — v testu flow ho vynecháváme (podpis ho má
// v try/catch, selhání PDF podpis neruší)
vi.mock('@/lib/sodPdf', () => ({
  buildSodPdf: vi.fn().mockResolvedValue(null),
  buildSodContentHtml: vi.fn().mockReturnValue('<html><body>mock</body></html>'),
}))

// e-maily v testech neodcházejí; mock umožní otestovat připomínkový sweep
vi.mock('@/lib/email', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/email')>()
  return {
    ...orig,
    isOrgEmailConfigured: vi.fn().mockResolvedValue(true),
    sendOrgEmail: vi.fn().mockResolvedValue(undefined),
  }
})

// interní podpis: CRM routy vyžadují session a SMS bránu
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/sms', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/sms')>()
  return { ...orig, isSmsConfigured: vi.fn().mockReturnValue(true) }
})

import { GET as publicGet } from '@/app/api/public/podpis/[token]/route'
import { POST as overitPost } from '@/app/api/public/podpis/[token]/overit/route'
import { POST as podepsatPost } from '@/app/api/public/podpis/[token]/podepsat/route'
import { POST as odeslatPost } from '@/app/api/sod/[id]/odeslat/route'
import { POST as podepsatInternePost } from '@/app/api/sod/[id]/podepsat-interne/route'
import { getServerSession } from 'next-auth'
import { sweepPripominkyPodpisu } from '@/worker/podpisy'
import { sendOrgEmail } from '@/lib/email'
import { encryptSecret } from '@/lib/secretCrypto'
import { getPodpisyAccess, PODPISY_MESICNI_LIMIT } from '@/lib/modulPodpisy'

const RUN = `podpis-${Date.now()}`
const PNG = `data:image/png;base64,${Buffer.from('fake-png').toString('base64')}`

let orgId: string
let dealId: string
let zmocnenecId: string
let obchodnikId: string

beforeAll(async () => {
  if (!process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = crypto.randomBytes(32).toString('hex')
  }
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
    process.env.CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
  }
  const org = await prisma.organization.create({ data: { nazev: 'Test Podpis', slug: RUN } })
  orgId = org.id
  const client = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const deal = await prisma.deal.create({
    data: { orgId, clientId: client.id, predmet: 'TČ', kod: `${RUN}-op`, technologie: 'TEPELNE_CERPADLO' },
  })
  dealId = deal.id
  // podepisujeSmlouvy se zapíná až v testech interního podpisu
  const zmocnenec = await prisma.user.create({
    data: { orgId, jmeno: 'Zdena Zmocněná', email: `${RUN}-zmocnenec@example.com`, hesloHash: 'x' },
  })
  zmocnenecId = zmocnenec.id
  const obchodnik = await prisma.user.create({
    data: { orgId, jmeno: 'Oto Obchodník', email: `${RUN}-obchodnik@example.com`, hesloHash: 'x' },
  })
  obchodnikId = obchodnik.id
})

afterAll(async () => {
  await prisma.sodUdalost.deleteMany({ where: { orgId } })
  await prisma.sodPodpisRelace.deleteMany({ where: { orgId } })
  await prisma.sodVerze.deleteMany({ where: { orgId } })
  await prisma.sod.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

async function vytvorOdeslanouSmlouvu(opts: { expirace?: Date } = {}) {
  const token = generateToken()
  const sod = await prisma.sod.create({
    data: {
      orgId, dealId, cislo: `SOD-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
      typ: 'DPH_12_BEZ_ZALOHY', klientJmeno: 'Karel Klient', predmetDila: 'Tepelné čerpadlo',
      stav: 'ODESLANO',
    },
  })
  const verze = await prisma.sodVerze.create({
    data: { orgId, sodId: sod.id, cislo: 1, textSmlouvy: '<html><body><p>Text smlouvy</p></body></html>' },
  })
  const relace = await prisma.sodPodpisRelace.create({
    data: {
      orgId, sodId: sod.id, verzeId: verze.id,
      tokenHash: sha256(token),
      email: 'karel@example.com', telefon: '420777123456',
      expirace: opts.expirace ?? new Date(Date.now() + 7 * 24 * 3600_000),
    },
  })
  return { token, sod, verze, relace }
}

function req(token: string, path = '', init?: { method?: string; body?: unknown; cookie?: string }) {
  return new NextRequest(`http://localhost/api/public/podpis/${token}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(init?.cookie ? { cookie: init.cookie } : {}),
      'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}`,
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  })
}

async function ziskejCookie(token: string, relaceId: string): Promise<string> {
  // OTP nastavíme přímo v DB (SMS brána v testech neběží)
  await prisma.sodPodpisRelace.update({
    where: { id: relaceId },
    data: { otpHash: otpHash('123456', relaceId), otpExpirace: new Date(Date.now() + 600_000), otpPokusy: 0 },
  })
  const res = await overitPost(req(token, '/overit', { method: 'POST', body: { kod: '123456' } }), { params: { token } })
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('set-cookie')!
  expect(setCookie).toContain(podpisCookieName(relaceId))
  return setCookie.split(';')[0]
}

describe('veřejný podpisový flow', () => {
  it('neznámý token → NEPLATNY', async () => {
    const res = await publicGet(req('neexistujici-token-123456789'), { params: { token: 'neexistujici-token-123456789' } })
    expect(res.status).toBe(404)
    expect((await res.json()).faze).toBe('NEPLATNY')
  })

  it('bez ověření vrací jen fázi OVERENI s maskovaným číslem, bez obsahu smlouvy', async () => {
    const { token } = await vytvorOdeslanouSmlouvu()
    const res = await publicGet(req(token), { params: { token } })
    const data = await res.json()
    expect(data.faze).toBe('OVERENI')
    expect(data.maskTelefon).toBe('+420 ••• ••• 456')
    expect(data.contractHtml).toBeUndefined()
  })

  it('špatný kód počítá pokusy, po 5. se zamkne', async () => {
    const { token, relace } = await vytvorOdeslanouSmlouvu()
    await prisma.sodPodpisRelace.update({
      where: { id: relace.id },
      data: { otpHash: otpHash('123456', relace.id), otpExpirace: new Date(Date.now() + 600_000) },
    })
    for (let i = 1; i <= 4; i++) {
      const res = await overitPost(req(token, '/overit', { method: 'POST', body: { kod: '000000' } }), { params: { token } })
      expect(res.status).toBe(401)
    }
    const res5 = await overitPost(req(token, '/overit', { method: 'POST', body: { kod: '000000' } }), { params: { token } })
    expect(res5.status).toBe(423)
    // i správný kód už neprojde
    const res6 = await overitPost(req(token, '/overit', { method: 'POST', body: { kod: '123456' } }), { params: { token } })
    expect(res6.status).toBe(423)
  })

  it('správný kód → cookie → smlouva → podpis → PODEPSANO s auditem', async () => {
    const { token, sod, verze, relace } = await vytvorOdeslanouSmlouvu()
    const cookie = await ziskejCookie(token, relace.id)

    // s cookie vrátí obsah smlouvy
    const view = await publicGet(req(token, '', { cookie }), { params: { token } })
    const viewData = await view.json()
    expect(viewData.faze).toBe('SMLOUVA')
    expect(viewData.contractHtml).toContain('Text smlouvy')

    // podpis
    const sign = await podepsatPost(
      req(token, '/podepsat', { method: 'POST', cookie, body: { podpisSvg: PNG, jmeno: 'Karel Klient', souhlas: true } }),
      { params: { token } }
    )
    expect(sign.status).toBe(200)

    const po = await prisma.sod.findUnique({ where: { id: sod.id } })
    expect(po?.stav).toBe('PODEPSANO')
    expect(po?.podepsalJmeno).toBe('Karel Klient')
    expect(po?.podpisTextHash).toBe(sha256(verze.textSmlouvy))
    expect(po?.podpisIp).toBeTruthy()

    const r = await prisma.sodPodpisRelace.findUnique({ where: { id: relace.id } })
    expect(r?.stav).toBe('PODEPSANA')

    const udalosti = await prisma.sodUdalost.findMany({ where: { sodId: sod.id }, orderBy: { vytvoreno: 'asc' } })
    const typy = udalosti.map(u => u.typ)
    expect(typy).toContain('OTP_OVERENO')
    expect(typy).toContain('ZOBRAZENO')
    expect(typy).toContain('PODEPSANO')

    // druhý podpis neprojde
    const znovu = await podepsatPost(
      req(token, '/podepsat', { method: 'POST', cookie, body: { podpisSvg: PNG, jmeno: 'X Y', souhlas: true } }),
      { params: { token } }
    )
    expect(znovu.status).not.toBe(200)
  })

  it('podpis bez cookie neprojde (samotný odkaz nestačí)', async () => {
    const { token } = await vytvorOdeslanouSmlouvu()
    const res = await podepsatPost(
      req(token, '/podepsat', { method: 'POST', body: { podpisSvg: PNG, jmeno: 'Útočník', souhlas: true } }),
      { params: { token } }
    )
    expect(res.status).toBe(401)
  })

  it('prošlá relace → NEPLATNY a smlouva EXPIROVANO (lazy)', async () => {
    const { token, sod } = await vytvorOdeslanouSmlouvu({ expirace: new Date(Date.now() - 1000) })
    const res = await publicGet(req(token), { params: { token } })
    expect((await res.json()).faze).toBe('NEPLATNY')
    const po = await prisma.sod.findUnique({ where: { id: sod.id } })
    expect(po?.stav).toBe('EXPIROVANO')
  })

  it('worker sweep expiruje neotevřené relace', async () => {
    const { sod, relace } = await vytvorOdeslanouSmlouvu({ expirace: new Date(Date.now() - 1000) })
    const n = await sweepExpirovanePodpisy(prisma)
    expect(n).toBeGreaterThanOrEqual(1)
    expect((await prisma.sodPodpisRelace.findUnique({ where: { id: relace.id } }))?.stav).toBe('EXPIROVANA')
    expect((await prisma.sod.findUnique({ where: { id: sod.id } }))?.stav).toBe('EXPIROVANO')
  })

  it('worker pošle připomínku 3 dny po odeslání, ale jen jednou', async () => {
    const { token, relace } = await vytvorOdeslanouSmlouvu()
    await prisma.sodPodpisRelace.update({
      where: { id: relace.id },
      data: {
        tokenEnc: encryptSecret(token),
        vytvoreno: new Date(Date.now() - 4 * 24 * 3600_000),
      },
    })

    const n1 = await sweepPripominkyPodpisu(prisma)
    expect(n1).toBe(1)
    expect(sendOrgEmail).toHaveBeenCalledWith(
      orgId,
      'karel@example.com',
      expect.stringContaining('Připomínka'),
      expect.stringContaining(`/podpis/${token}`)
    )
    const events = await prisma.sodUdalost.count({ where: { relaceId: relace.id, typ: 'PRIPOMINKA' } })
    expect(events).toBe(1)

    // druhý běh už nic nepošle
    expect(await sweepPripominkyPodpisu(prisma)).toBe(0)
  })
})

describe('modul podpisy — přístup podle plánu', () => {
  it('PROFESSIONAL má podpisy v ceně bez limitu', async () => {
    const p = await getPodpisyAccess(orgId, 'PROFESSIONAL')
    expect(p).toMatchObject({ allowed: true, zdroj: 'PLAN', limit: null })
  })

  it('STARTER nemá přístup ani nabídku modulu', async () => {
    const p = await getPodpisyAccess(orgId, 'STARTER')
    expect(p).toMatchObject({ allowed: false, zdroj: null, muzeAktivovatModul: false })
  })

  it('STANDARD bez modulu → nabídka aktivace', async () => {
    const p = await getPodpisyAccess(orgId, 'STANDARD')
    expect(p).toMatchObject({ allowed: false, zdroj: null, muzeAktivovatModul: true })
  })

  it('STANDARD s modulem → povoleno s počítadlem, po limitu stop', async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { modulPodpisy: true } })

    const pred = await getPodpisyAccess(orgId, 'STANDARD')
    expect(pred.zdroj).toBe('MODUL')
    expect(pred.limit).toBe(PODPISY_MESICNI_LIMIT)
    expect(pred.allowed).toBe(true)
    expect(pred.vyuzito).toBeGreaterThan(0) // relace z předchozích testů

    // doplnit relace do limitu
    const sod = await prisma.sod.findFirst({ where: { orgId }, select: { id: true } })
    const chybi = PODPISY_MESICNI_LIMIT - pred.vyuzito
    await prisma.sodPodpisRelace.createMany({
      data: Array.from({ length: chybi }, (_, i) => ({
        orgId, sodId: sod!.id,
        tokenHash: `limit-test-${RUN}-${i}`,
        email: 'x@example.com', telefon: '420777000000',
        expirace: new Date(Date.now() + 24 * 3600_000),
      })),
    })

    const po = await getPodpisyAccess(orgId, 'STANDARD')
    expect(po.vyuzito).toBe(PODPISY_MESICNI_LIMIT)
    expect(po.allowed).toBe(false)

    await prisma.organization.update({ where: { id: orgId }, data: { modulPodpisy: false } })
  })
})

describe('interní podpis za zhotovitele', () => {
  function mockSession(userId: string) {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: userId, orgId, role: 'OBCHODNIK', plan: 'PROFESSIONAL' },
    } as never)
  }

  function crmReq(body: Record<string, unknown>) {
    return new Request('http://localhost/api/sod/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function vytvorNavrh() {
    return prisma.sod.create({
      data: {
        orgId, dealId, cislo: `SOD-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
        typ: 'DPH_12_BEZ_ZALOHY', klientJmeno: 'Karel Klient', predmetDila: 'Tepelné čerpadlo',
        textSmlouvy: '<p>Text smlouvy k internímu podpisu</p>',
      },
    })
  }

  const KONTAKT = { email: 'karel@example.com', telefon: '777123456' }

  it('bez zmocněnce se smlouva neodešle', async () => {
    const sod = await vytvorNavrh()
    mockSession(obchodnikId)
    const res = await odeslatPost(crmReq(KONTAKT), { params: { id: sod.id } })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('kdo za firmu podepisuje')
  })

  it('ne-zmocněnec → žádost o podpis (bell + e-mail zmocněnci), klientovi nic', async () => {
    await prisma.user.update({ where: { id: zmocnenecId }, data: { podepisujeSmlouvy: true } })
    vi.mocked(sendOrgEmail).mockClear()

    const sod = await vytvorNavrh()
    mockSession(obchodnikId)
    const res = await odeslatPost(crmReq(KONTAKT), { params: { id: sod.id } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.cekaNaPodpis).toBe(true)
    expect(data.zmocnenci).toEqual(['Zdena Zmocněná'])

    const po = await prisma.sod.findUnique({ where: { id: sod.id } })
    expect(po?.stav).toBe('K_INTERNIMU_PODPISU')
    expect(po?.podpisZadost).toMatchObject({
      email: KONTAKT.email, telefon: '420777123456', userId: obchodnikId, jmeno: 'Oto Obchodník',
    })

    // klientovi neodešlo nic — žádná relace, e-mail šel jen zmocněnci
    expect(await prisma.sodPodpisRelace.count({ where: { sodId: sod.id } })).toBe(0)
    expect(sendOrgEmail).toHaveBeenCalledTimes(1)
    expect(sendOrgEmail).toHaveBeenCalledWith(
      orgId, `${RUN}-zmocnenec@example.com`,
      expect.stringContaining('čeká na váš podpis'),
      expect.stringContaining('Oto Obchodník')
    )
    const bell = await prisma.notification.findFirst({ where: { orgId, userId: zmocnenecId, typ: 'SOD_PODPIS_VYZADAN' } })
    expect(bell?.zprava).toContain(sod.cislo)

    const typy = (await prisma.sodUdalost.findMany({ where: { sodId: sod.id } })).map(u => u.typ)
    expect(typy).toContain('PODPIS_VYZADAN')
    expect(typy).not.toContain('ODESLANO')
  })

  it('podpis zmocněnce vyřídí žádost — smlouva odejde klientovi sama i s podpisovým blokem', async () => {
    const sod = await vytvorNavrh()
    mockSession(obchodnikId)
    await odeslatPost(crmReq(KONTAKT), { params: { id: sod.id } })
    vi.mocked(sendOrgEmail).mockClear()

    mockSession(zmocnenecId)
    const res = await podepsatInternePost(crmReq({ podpisSvg: PNG }), { params: { id: sod.id } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.odeslano).toBe(true)
    expect(data.email).toBe(KONTAKT.email)

    const po = await prisma.sod.findUnique({ where: { id: sod.id } })
    expect(po?.stav).toBe('ODESLANO')
    expect(po?.zhotovitelPodepsalJmeno).toBe('Zdena Zmocněná')
    expect(po?.zhotovitelPodepsalId).toBe(zmocnenecId)
    expect(po?.zhotovitelTextHash).toBeTruthy()
    expect(po?.podpisZadost).toBeNull()

    // snapshot pro klienta obsahuje interní podpisový blok
    const verze = await prisma.sodVerze.findFirst({ where: { sodId: sod.id }, orderBy: { cislo: 'desc' } })
    expect(verze?.textSmlouvy).toContain('za zhotovitele')

    // relace odeslaná jménem žadatele, žadatel dostal bell
    const relace = await prisma.sodPodpisRelace.findFirst({ where: { sodId: sod.id, stav: 'AKTIVNI' } })
    expect(relace?.odeslalId).toBe(obchodnikId)
    const bell = await prisma.notification.findFirst({ where: { orgId, userId: obchodnikId, typ: 'SOD_PODEPSANA_ZHOTOVITELEM' } })
    expect(bell?.zprava).toContain(sod.cislo)

    const typy = (await prisma.sodUdalost.findMany({ where: { sodId: sod.id } })).map(u => u.typ)
    expect(typy).toEqual(expect.arrayContaining(['PODPIS_VYZADAN', 'PODEPSANO_ZHOTOVITELEM', 'ODESLANO']))
  })

  it('ne-zmocněnec nemůže interně podepsat', async () => {
    const sod = await vytvorNavrh()
    mockSession(obchodnikId)
    const res = await podepsatInternePost(crmReq({ podpisSvg: PNG }), { params: { id: sod.id } })
    expect(res.status).toBe(403)
  })

  it('zmocněnec podepíše a odešle v jednom kroku; bez podpisu to nejde', async () => {
    const sod = await vytvorNavrh()
    mockSession(zmocnenecId)

    const bezPodpisu = await odeslatPost(crmReq(KONTAKT), { params: { id: sod.id } })
    expect(bezPodpisu.status).toBe(422)
    expect((await bezPodpisu.json()).error).toContain('Chybí podpis')

    const res = await odeslatPost(crmReq({ ...KONTAKT, podpisSvg: PNG }), { params: { id: sod.id } })
    expect(res.status).toBe(200)

    const po = await prisma.sod.findUnique({ where: { id: sod.id } })
    expect(po?.stav).toBe('ODESLANO')
    expect(po?.zhotovitelPodepsalId).toBe(zmocnenecId)
  })

  it('editace textu interní podpis zneplatní — nové odeslání chce nový podpis', async () => {
    const sod = await vytvorNavrh()
    mockSession(zmocnenecId)
    await odeslatPost(crmReq({ ...KONTAKT, podpisSvg: PNG }), { params: { id: sod.id } })

    await prisma.sod.update({ where: { id: sod.id }, data: { textSmlouvy: '<p>Upravený text</p>' } })

    const res = await odeslatPost(crmReq(KONTAKT), { params: { id: sod.id } })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('Chybí podpis')
  })
})
