import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { TENANT_MODELS } from '@/lib/orgPrisma'

/**
 * Hlídá, že TENANT_MODELS v lib/orgPrisma.ts odpovídá schema.prisma.
 * Když přidáš model s orgId a zapomeneš ho zaregistrovat, tenhle test
 * spadne — to je celý jeho smysl.
 */
describe('TENANT_MODELS je v sync se schema.prisma', () => {
  const schema = fs.readFileSync(
    path.resolve(__dirname, '../prisma/schema.prisma'),
    'utf8'
  )

  const modelsWithOrgId = new Set<string>()
  let current: string | null = null
  for (const line of schema.split('\n')) {
    const m = line.match(/^model\s+(\S+)\s*\{/)
    if (m) current = m[1]
    if (line.match(/^\s*}/)) current = null
    if (current && line.match(/^\s+orgId\s+String/)) {
      modelsWithOrgId.add(current)
    }
  }

  it('každý model s orgId je v TENANT_MODELS', () => {
    const missing = Array.from(modelsWithOrgId).filter(
      (m) => !TENANT_MODELS.has(m)
    )
    expect(missing, `Chybí v TENANT_MODELS: ${missing.join(', ')}`).toEqual([])
  })

  it('TENANT_MODELS neobsahuje modely bez orgId', () => {
    const extra = Array.from(TENANT_MODELS).filter(
      (m) => !modelsWithOrgId.has(m)
    )
    expect(extra, `Navíc v TENANT_MODELS: ${extra.join(', ')}`).toEqual([])
  })
})
