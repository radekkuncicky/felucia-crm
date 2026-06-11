import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { buildDokumentChrome } from '@/lib/dokumentyChrome'

/**
 * Test záhlaví/patičky PDF dokumentů nad nanto_crm_test.
 */

const RUN = `chrome-${Date.now()}`

let org: { id: string }

beforeAll(async () => {
  org = await prisma.organization.create({
    data: { nazev: 'Chrome Test s.r.o.', slug: RUN, ico: '11223344', sidlo: 'Testovní 1, Brno', email: 'info@chrome.cz' },
  })
})

afterAll(async () => {
  await prisma.orgSettings.deleteMany({ where: { orgId: org.id } })
  await prisma.organization.delete({ where: { id: org.id } })
})

describe('buildDokumentChrome', () => {
  it('výchozí styl LINKA obsahuje název firmy, patičku z údajů a číslování', async () => {
    const chrome = await buildDokumentChrome(org.id, 'STARTER')
    expect(chrome).not.toBeNull()
    expect(chrome!.headerTemplate).toContain('Chrome Test s.r.o.')
    expect(chrome!.footerTemplate).toContain('IČ 11223344')
    expect(chrome!.footerTemplate).toContain('pageNumber')
  })

  it('ZADNY vrací null (žádné záhlaví)', async () => {
    expect(await buildDokumentChrome(org.id, 'STARTER', { dokumentyStyl: 'ZADNY' })).toBeNull()
  })

  it('vlastní patička a vypnuté číslování se projeví', async () => {
    const chrome = await buildDokumentChrome(org.id, 'STARTER', {
      dokumentyPaticka: 'Moje vlastní patička', dokumentyCislovani: false,
    })
    expect(chrome!.footerTemplate).toContain('Moje vlastní patička')
    expect(chrome!.footerTemplate).not.toContain('pageNumber')
  })

  it('VLASTNI bez white-label plánu spadne na LINKA', async () => {
    const chrome = await buildDokumentChrome(org.id, 'STANDARD', {
      dokumentyStyl: 'VLASTNI', dokumentyHeaderHtml: '<b>{{organizace}}</b>',
    })
    expect(chrome!.headerTemplate).not.toContain('<b>')
    expect(chrome!.headerTemplate).toContain('Chrome Test s.r.o.')
  })

  it('VLASTNI s PROFESSIONAL nahradí placeholdery', async () => {
    const chrome = await buildDokumentChrome(org.id, 'PROFESSIONAL', {
      dokumentyStyl: 'VLASTNI',
      dokumentyHeaderHtml: '<b>{{organizace}}</b> IČ {{org_ico}}',
      dokumentyFooterHtml: 'Strana {{strana}} z {{stran_celkem}}',
    })
    expect(chrome!.headerTemplate).toContain('<b>Chrome Test s.r.o.</b> IČ 11223344')
    expect(chrome!.footerTemplate).toContain('<span class="pageNumber"></span>')
    expect(chrome!.footerTemplate).toContain('<span class="totalPages"></span>')
    expect(chrome!.footerTemplate).not.toContain('{{')
  })

  it('XSS v názvu organizace se escapuje', async () => {
    const evil = await prisma.organization.create({
      data: { nazev: '<script>alert(1)</script>', slug: `${RUN}-evil` },
    })
    const chrome = await buildDokumentChrome(evil.id, 'STARTER')
    expect(chrome!.headerTemplate).not.toContain('<script>')
    await prisma.orgSettings.deleteMany({ where: { orgId: evil.id } })
    await prisma.organization.delete({ where: { id: evil.id } })
  })
})
