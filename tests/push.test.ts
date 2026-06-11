import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { sendPushToUsers } from '@/lib/push'

/**
 * Test push notifikací nad nanto_crm_test. Expo API je mockované přes
 * global fetch — nikam se reálně neposílá.
 */

const RUN = `push-${Date.now()}`
const TOKEN_OK = 'ExponentPushToken[test-ok]'
const TOKEN_DEAD = 'ExponentPushToken[test-dead]'

let org: { id: string }
let orgB: { id: string }
let userOk: { id: string }
let userDead: { id: string }
let userNoToken: { id: string }
let userCizi: { id: string }

const fetchMock = vi.fn()

function okTickets(count: number) {
  return {
    ok: true,
    json: async () => ({ data: Array.from({ length: count }, () => ({ status: 'ok' })) }),
  }
}

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  org = await prisma.organization.create({ data: { nazev: 'Test Push', slug: RUN } })
  orgB = await prisma.organization.create({ data: { nazev: 'Test Push B', slug: `${RUN}-b` } })
  userOk = await prisma.user.create({
    data: { orgId: org.id, jmeno: 'Tonda Token', email: `${RUN}-ok@test.cz`, hesloHash: 'x', pushToken: TOKEN_OK },
  })
  userDead = await prisma.user.create({
    data: { orgId: org.id, jmeno: 'Mira Mrtvy', email: `${RUN}-dead@test.cz`, hesloHash: 'x', pushToken: TOKEN_DEAD },
  })
  userNoToken = await prisma.user.create({
    data: { orgId: org.id, jmeno: 'Bara BezTokenu', email: `${RUN}-no@test.cz`, hesloHash: 'x' },
  })
  userCizi = await prisma.user.create({
    data: { orgId: orgB.id, jmeno: 'Cyril Cizi', email: `${RUN}-cizi@test.cz`, hesloHash: 'x', pushToken: 'ExponentPushToken[cizi]' },
  })
})

beforeEach(() => { fetchMock.mockReset() })

afterAll(async () => {
  vi.unstubAllGlobals()
  await prisma.user.deleteMany({ where: { orgId: { in: [org.id, orgB.id] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [org.id, orgB.id] } } })
})

describe('sendPushToUsers', () => {
  it('pošle zprávu na Expo API se správným payloadem', async () => {
    fetchMock.mockResolvedValue(okTickets(1))
    await sendPushToUsers(org.id, [userOk.id], {
      title: 'Nová zakázka',
      body: 'Z-001 — Klima sklad',
      data: { type: 'zakazka', zakazkaId: 'zak1' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://exp.host/--/api/v2/push/send')
    const messages = JSON.parse(init.body)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      to: TOKEN_OK,
      title: 'Nová zakázka',
      body: 'Z-001 — Klima sklad',
      data: { type: 'zakazka', zakazkaId: 'zak1' },
    })
  })

  it('uživatele bez tokenu přeskočí (žádný request)', async () => {
    await sendPushToUsers(org.id, [userNoToken.id], { title: 'x', body: 'y' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('neposílá uživateli z jiné organizace (tenant izolace)', async () => {
    await sendPushToUsers(org.id, [userCizi.id], { title: 'x', body: 'y' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('DeviceNotRegistered → smaže token z DB', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    })
    await sendPushToUsers(org.id, [userDead.id], { title: 'x', body: 'y' })

    const user = await prisma.user.findUnique({ where: { id: userDead.id } })
    expect(user?.pushToken).toBeNull()
  })

  it('chyba sítě nevyhazuje (fire-and-forget)', async () => {
    fetchMock.mockImplementation(() => { throw new Error('ECONNREFUSED') })
    await expect(
      sendPushToUsers(org.id, [userOk.id], { title: 'x', body: 'y' })
    ).resolves.toBeUndefined()
  })
})
