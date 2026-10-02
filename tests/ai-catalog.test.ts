import { describe, it, expect } from 'vitest'
import schema from './fixtures/ai-catalog.schema.json'
import { aiCatalog } from '@/lib/aiCatalog'

// Schéma z github.com/ards-project/ard-spec (spec/schemas/ai-catalog.schema.json) -
// proti němu validuje Lighthouse audit ard-schema. Validátor pro draft 2020 v projektu
// nemáme, tak se pravidla schématu kontrolují ručně (čtou se přímo ze souboru schématu).
const isUri = (v: unknown) => typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v)

describe('/.well-known/ai-catalog.json', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generická kontrola tvaru proti schématu
  const c = aiCatalog() as Record<string, any>
  const entryDef = schema.$defs.catalogEntry

  it('kořen: povinná pole, specVersion z enumu, nic navíc', () => {
    for (const k of schema.required) expect(c).toHaveProperty(k)
    expect(schema.properties.specVersion.enum).toContain(c.specVersion)
    expect(Object.keys(c).filter(k => !(k in schema.properties))).toEqual([])
  })

  it('host: displayName, jen povolená pole, URI', () => {
    for (const k of schema.properties.host.required) expect(c.host).toHaveProperty(k)
    expect(Object.keys(c.host).filter(k => !(k in schema.properties.host.properties))).toEqual([])
    expect(isUri(c.host.documentationUrl)).toBe(true)
    expect(isUri(c.host.logoUrl)).toBe(true)
  })

  it('položky: povinná pole, URN, právě jedno z url/data, 2-5 dotazů', () => {
    expect(c.entries.length).toBeGreaterThan(0)
    for (const e of c.entries) {
      for (const k of entryDef.required) expect(typeof e[k]).toBe('string')
      expect(e.identifier).toMatch(new RegExp(entryDef.properties.identifier.pattern))
      expect(('url' in e) !== ('data' in e)).toBe(true)
      if (e.url) expect(isUri(e.url)).toBe(true)
      expect(e.representativeQueries.length).toBeGreaterThanOrEqual(entryDef.properties.representativeQueries.minItems)
      expect(e.representativeQueries.length).toBeLessThanOrEqual(entryDef.properties.representativeQueries.maxItems)
      expect(Number.isNaN(Date.parse(e.updatedAt))).toBe(false)
      expect(Object.keys(e).filter(k => !(k in entryDef.properties))).toEqual([])
    }
  })
})
