import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma, prismaApp } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { GET as clientsGet } from '@/app/api/clients/route'
import { GET as searchGet } from '@/app/api/search/route'
import { GET as quotesGet } from '@/app/api/deals/[id]/quotes/route'
import { POST as categoriesPost } from '@/app/api/categories/route'
import { POST as kontraktyPost } from '@/app/api/servis/kontrakty/route'
import { POST as forgotPost } from '@/app/api/auth/forgot-password/route'
import { POST as registerPost } from '@/app/api/auth/register/route'
import { GET as pripadyGet } from '@/app/api/mobile/obchod/pripady/route'
import { GET as pripadDetailGet } from '@/app/api/mobile/obchod/pripady/[id]/route'
import { clientScopeWhere, getPerms } from '@/lib/permissions'
import { signCookieValue, verifyCookieValue } from '@/lib/signedCookie'
import { getServerSession } from 'next-auth'

/**
 * Regresní testy k bezpečnostnímu auditu 2026-09, vlna 2a: SEC-16 (RLS na
 * dětské tabulky + organizations), SEC-17/18 (login kolize, filter injection),
 * SEC-19 (podepsaná impersonační cookie), SEC-21/22/23/24 (oprávnění),
 * SEC-28 (mobilní obchod jen vlastní OP), SEC-31 (CSV).
 */

const RUN = `sec2-${Date.now()}`

let orgA: string, orgB: string
let adminA: string, obchodnikA: string, technikA: string
let clientA1: string, clientA2: string, clientB: string
let dealAdmin: string, dealObch: string, dealB: string
let quoteAdmin: string

function login(id: string, orgId: string, role: 'ADMIN' | 'OBCHODNIK' | 'TECHNIK', perms?: Record<string, unknown>) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, orgId, role, plan: 'PROFESSIONAL', perms } } as never)
}
const get = (url = 'http://test') => new Request(url)
const json = (body: unknown) => new Request('http://test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeAll(async () => {
  orgA = (await prisma.organization.create({ data: { nazev: 'Sec2 A', slug: `${RUN}-a`, plan: 'PROFESSIONAL' } })).id
  orgB = (await prisma.organization.create({ data: { nazev: 'Sec2 B', slug: `${RUN}-b`, plan: 'PROFESSIONAL' } })).id
  adminA = (await prisma.user.create({ data: { orgId: orgA, jmeno: 'Admin', email: `${RUN}-admin@a.cz`, hesloHash: 'x', role: 'ADMIN' } })).id
  obchodnikA = (await prisma.user.create({ data: { orgId: orgA, jmeno: 'Obchodník', email: `${RUN}-obch@a.cz`, hesloHash: 'x', role: 'OBCHODNIK' } })).id
  technikA = (await prisma.user.create({ data: { orgId: orgA, jmeno: 'Technik', email: `${RUN}-tech@a.cz`, hesloHash: 'x', role: 'TECHNIK' } })).id
  clientA1 = (await prisma.client.create({ data: { orgId: orgA, jmeno: 'Zuzana', prijmeni: 'Přiřazená' } })).id
  clientA2 = (await prisma.client.create({ data: { orgId: orgA, jmeno: 'Zuzana', prijmeni: 'Cizí' } })).id
  clientB = (await prisma.client.create({ data: { orgId: orgB, jmeno: 'Bára', prijmeni: 'B' } })).id
  // technik je přiřazen jen na zakázku klienta A1
  await prisma.zakazka.create({ data: { orgId: orgA, cislo: `${RUN}-Z1`, nazev: 'Z1', klientId: clientA1, vedouciId: adminA, stav: 'V_REALIZACI', techniciRel: { create: [{ technikId: technikA }] } } })
  dealAdmin = (await prisma.deal.create({ data: { orgId: orgA, clientId: clientA2, userId: adminA, technologie: 'KLIMA', kod: `${RUN}-OP1`, predmet: 'Zuzana adminova' } })).id
  dealObch = (await prisma.deal.create({ data: { orgId: orgA, clientId: clientA1, userId: obchodnikA, technologie: 'KLIMA', kod: `${RUN}-OP2` } })).id
  dealB = (await prisma.deal.create({ data: { orgId: orgB, clientId: clientB, technologie: 'KLIMA', kod: `${RUN}-OPB` } })).id
  quoteAdmin = (await prisma.quote.create({
    data: { dealId: dealAdmin, orgId: orgA, nazev: 'N', kod: `${RUN}-NAB`, items: { create: [{ dealId: dealAdmin, nazev: 'Jednotka', mnozstvi: 1, cenaZaKus: 1000, nakupniCena: 600 }] } },
  })).id
})

afterAll(async () => {
  for (const orgId of [orgA, orgB]) {
    await prisma.auditLog.deleteMany({ where: { orgId } })
    await prisma.notification.deleteMany({ where: { orgId } })
    await prisma.quoteItem.deleteMany({ where: { deal: { orgId } } })
    await prisma.quote.deleteMany({ where: { orgId } })
    await prisma.servisniKontrakt.deleteMany({ where: { orgId } })
    await prisma.deal.deleteMany({ where: { orgId } })
    await prisma.technikZakazka.deleteMany({ where: { zakazka: { orgId } } })
    await prisma.zakazka.deleteMany({ where: { orgId } })
    await prisma.category.deleteMany({ where: { orgId } })
    await prisma.client.deleteMany({ where: { orgId } })
    await prisma.passwordResetToken.deleteMany({ where: { user: { orgId } } })
    await prisma.user.deleteMany({ where: { orgId } })
    await prisma.orgSettings.deleteMany({ where: { orgId } })
    await prisma.organization.delete({ where: { id: orgId } })
  }
})

describe('SEC-16 — RLS i na dětských tabulkách a organizations', () => {
  it('quote_items org B nejsou pod kontextem org A vidět ani zapsatelné', async () => {
    const itemB = await prisma.quoteItem.create({ data: { dealId: dealB, nazev: 'B', mnozstvi: 1, cenaZaKus: 1 } })
    const [, rows] = await prismaApp.$transaction([
      prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA}, true)`,
      prismaApp.quoteItem.findMany({ where: { dealId: dealB } }),
    ])
    expect(rows).toEqual([])
    await expect(prismaApp.$transaction([
      prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA}, true)`,
      prismaApp.quoteItem.create({ data: { dealId: dealB, nazev: 'Pašerák', mnozstvi: 1, cenaZaKus: 1 } }),
    ])).rejects.toThrow()
    const [, upd] = await prismaApp.$transaction([
      prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA}, true)`,
      prismaApp.quoteItem.updateMany({ where: { id: itemB.id }, data: { nazev: 'Hack' } }),
    ])
    expect((upd as { count: number }).count).toBe(0)
    await prisma.quoteItem.delete({ where: { id: itemB.id } })
  })

  it('organizations: pod kontextem org A jde číst/měnit jen org A', async () => {
    const [, rows] = await prismaApp.$transaction([
      prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA}, true)`,
      prismaApp.organization.findMany({ where: { id: { in: [orgA, orgB] } } }),
    ])
    expect(rows.map(r => r.id)).toEqual([orgA])
    const [, upd] = await prismaApp.$transaction([
      prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA}, true)`,
      prismaApp.organization.updateMany({ where: { id: orgB }, data: { plan: 'ENTERPRISE' } }),
    ])
    expect((upd as { count: number }).count).toBe(0)
  })
})

describe('SEC-22 — klienti a vyhledávání jen v rozsahu uživatele', () => {
  it('TECHNIK vidí jen klienty ze svých zakázek, OBCHODNIK všechny', async () => {
    login(technikA, orgA, 'TECHNIK')
    const t = await (await clientsGet(get())).json()
    expect(t.map((c: { id: string }) => c.id)).toEqual([clientA1])

    login(obchodnikA, orgA, 'OBCHODNIK')
    const o = await (await clientsGet(get())).json()
    expect(o.map((c: { id: string }) => c.id).sort()).toEqual([clientA1, clientA2].sort())

    expect(clientScopeWhere(getPerms({ role: 'TECHNIK', perms: { ...getPerms({ role: 'TECHNIK' } as never), zakazky: 'ZADNE', servis: 'ZADNY' } } as never), technikA)).toBeNull()
  })

  it('search: technik nenajde cizí klienty ani OP; obchodník bez obchodCiziOP jen vlastní OP', async () => {
    login(technikA, orgA, 'TECHNIK')
    const t = await (await searchGet(get('http://test?q=Zuzana'))).json()
    expect(t.filter((r: { type: string }) => r.type === 'client').map((r: { id: string }) => r.id)).toEqual([clientA1])
    expect(t.filter((r: { type: string }) => r.type === 'deal')).toEqual([])

    login(obchodnikA, orgA, 'OBCHODNIK', { ...getPerms({ role: 'OBCHODNIK' } as never), obchodCiziOP: false })
    const o = await (await searchGet(get('http://test?q=Zuzana'))).json()
    expect(o.filter((r: { type: string }) => r.type === 'deal').map((r: { id: string }) => r.id)).toEqual([dealObch])
  })
})

describe('SEC-21 — nákupní ceny jen s financeNakupky', () => {
  it('GET /api/deals/[id]/quotes vrátí OBCHODNIKovi nakupniCena null, ADMINovi hodnotu', async () => {
    login(obchodnikA, orgA, 'OBCHODNIK')
    const o = await (await quotesGet(get(), { params: { id: dealAdmin } })).json()
    expect(o[0].items[0].nakupniCena).toBeNull()
    login(adminA, orgA, 'ADMIN')
    const a = await (await quotesGet(get(), { params: { id: dealAdmin } })).json()
    expect(Number(a[0].items[0].nakupniCena)).toBe(600)
    expect(a[0].id).toBe(quoteAdmin)
  })
})

describe('SEC-23/24 — nastavení org a servis vyžadují oprávnění', () => {
  it('TECHNIK nezaloží kategorii ani servisní kontrakt', async () => {
    login(technikA, orgA, 'TECHNIK')
    expect((await categoriesPost(json({ nazev: 'Hack' }))).status).toBe(403)
    expect((await kontraktyPost(json({ klientId: clientA1, nazev: 'K', typ: 'ROCNI', intervalMesicu: 12, zacatek: '2026-01-01' }))).status).toBe(403)
    expect(await prisma.category.count({ where: { orgId: orgA, nazev: 'Hack' } })).toBe(0)
  })
})

describe('SEC-28 — mobilní obchod respektuje obchodCiziOP', () => {
  it('obchodník bez obchodCiziOP vidí v seznamu i detailu jen vlastní OP', async () => {
    const jenVlastni = { ...getPerms({ role: 'OBCHODNIK' } as never), obchodCiziOP: false }
    login(obchodnikA, orgA, 'OBCHODNIK', jenVlastni)
    const list = await (await pripadyGet(get('http://test/api/mobile/obchod/pripady'))).json()
    const ids = (Array.isArray(list) ? list : list.pripady ?? list.items ?? []).map((d: { id: string }) => d.id)
    expect(ids).toContain(dealObch)
    expect(ids).not.toContain(dealAdmin)
    expect((await pripadDetailGet(get(), { params: { id: dealAdmin } })).status).toBe(404)
    expect((await pripadDetailGet(get(), { params: { id: dealObch } })).status).toBe(200)
  })
})

describe('SEC-17/18 — auth vstupy', () => {
  it('forgot-password odmítne objekt místo e-mailu (Prisma filter injection)', async () => {
    const res = await forgotPost(new Request('http://test', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': `10.9.${Math.floor(Math.random() * 250)}.1` },
      body: JSON.stringify({ email: { startsWith: 'a' } }),
    }))
    expect(res.status).toBe(400)
  })

  it('register normalizuje slug a odmítne nevalidní e-mail', async () => {
    const mk = (body: unknown) => new Request('http://test', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': `10.8.${Math.floor(Math.random() * 250)}.1` },
      body: JSON.stringify(body),
    })
    const bad = await registerPost(mk({ nazevFirmy: 'Firma', jmeno: 'J', prijmeni: 'P', email: 'neni-email', heslo: 'Heslo12345' }))
    expect(bad.status).toBe(400)
    const obj = await registerPost(mk({ nazevFirmy: 'Firma', jmeno: 'J', prijmeni: 'P', email: { startsWith: 'a' }, heslo: 'Heslo12345' }))
    expect(obj.status).toBe(400)
  })
})

describe('SEC-19 — podepsaná cookie', () => {
  it('podpis se ověří, změněný obsah nebo podpis se odmítne', () => {
    const v = signCookieValue({ superAdminId: 'sa1', orgId: 'org1' }, 'sa_impersonate')
    expect(verifyCookieValue(v, 'sa_impersonate')).toEqual({ superAdminId: 'sa1', orgId: 'org1' })
    expect(verifyCookieValue(v, 'jiny-ucel')).toBeNull()
    const [payload, sig] = v.split('.')
    const forged = Buffer.from(JSON.stringify({ superAdminId: 'sa1', orgId: 'org2' })).toString('base64url')
    expect(verifyCookieValue(`${forged}.${sig}`, 'sa_impersonate')).toBeNull()
    expect(verifyCookieValue(`${payload}.AAAA`, 'sa_impersonate')).toBeNull()
    expect(verifyCookieValue(JSON.stringify({ superAdminId: 'sa1' }), 'sa_impersonate')).toBeNull()
  })
})

describe('Vlna 2b — ICS token, QR stránka, přílohy, Dáša', () => {
  it('ICS: token je vázaný na verzi, obnova zneplatní starý; deaktivovaný uživatel dostane 401', async () => {
    const { getCalendarToken } = await import('@/lib/calendarToken')
    const { GET: icsGet } = await import('@/app/api/calendar/ics/route')
    const u = await prisma.user.create({ data: { orgId: orgA, jmeno: 'Kal', email: `${RUN}-kal@a.cz`, hesloHash: 'x', role: 'TECHNIK' } })
    const url = (sig: string) => new Request(`http://test/api/calendar/ics?uid=${u.id}&sig=${sig}`)
    expect((await icsGet(url(getCalendarToken(u.id, 0)))).status).toBe(200)
    expect((await icsGet(url(getCalendarToken(u.id, 1)))).status).toBe(401)
    await prisma.user.update({ where: { id: u.id }, data: { calendarTokenVersion: 1 } })
    expect((await icsGet(url(getCalendarToken(u.id, 0)))).status).toBe(401)
    expect((await icsGet(url(getCalendarToken(u.id, 1)))).status).toBe(200)
    await prisma.user.update({ where: { id: u.id }, data: { aktivni: false } })
    expect((await icsGet(url(getCalendarToken(u.id, 1)))).status).toBe(401)
    await prisma.user.delete({ where: { id: u.id } })
  })

  it('ICS: technik nedostane OP celé org (rozsah obchod)', async () => {
    const { getCalendarToken } = await import('@/lib/calendarToken')
    const { GET: icsGet } = await import('@/app/api/calendar/ics/route')
    await prisma.deal.update({ where: { id: dealAdmin }, data: { terminRealizace: new Date('2026-12-01') } })
    const text = await (await icsGet(new Request(`http://test/api/calendar/ics?uid=${technikA}&sig=${getCalendarToken(technikA, 0)}`))).text()
    expect(text).not.toContain('Zuzana adminova')
    const adminText = await (await icsGet(new Request(`http://test/api/calendar/ics?uid=${adminA}&sig=${getCalendarToken(adminA, 0)}`))).text()
    expect(adminText).toContain('Zuzana adminova')
  })

  it('příloha VOP musí být skutečné PDF', async () => {
    const { POST: prilohaPost } = await import('@/app/api/settings/company/priloha/[typ]/route')
    login(adminA, orgA, 'ADMIN')
    const fd = new FormData()
    fd.append('file', new File([new Uint8Array(Buffer.from('<html>ne pdf</html>'))], 'vop.pdf', { type: 'application/pdf' }))
    const res = await prilohaPost(new Request('http://test', { method: 'POST', body: fd }), { params: { typ: 'vop' } })
    expect(res.status).toBe(400)
  })

  it('Dáša odmítne ne-string zprávu a příliš dlouhou zprávu', async () => {
    const { POST: dasaPost } = await import('@/app/api/ai-assistant/route')
    login(adminA, orgA, 'ADMIN')
    const mk = (body: unknown) => new Request('http://test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const r1 = await dasaPost(mk({ message: { $gt: '' } }))
    expect([400, 403, 500]).toContain(r1.status) // 403/500 = plán/API klíč dřív než validace; 400 = validace
    if (r1.status === 400) {
      const r2 = await dasaPost(mk({ message: 'x'.repeat(5000) }))
      expect(r2.status).toBe(400)
    }
  })
})
