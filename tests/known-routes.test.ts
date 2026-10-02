import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { KNOWN_TOP_SEGMENTS, isKnownRoute } from '@/lib/knownRoutes'

const APP = path.resolve(__dirname, '../app')
// Matcher middlewaru je vynechává (vlastní route handlery), v seznamu být nemusí.
const MATCHER_EXCLUDED = new Set(['llms.txt', 'robots.txt'])

function hasRouteFile(dir: string): boolean {
  return fs.readdirSync(dir, { withFileTypes: true }).some(e =>
    e.isDirectory() ? hasRouteFile(path.join(dir, e.name)) : /^(page|route)\.(tsx?|jsx?)$/.test(e.name))
}

// První segmenty URL ze stromu app/ — route groups „(x)“ se rozbalí.
function appSegments(dir = APP): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).flatMap(e => {
    const full = path.join(dir, e.name)
    if (e.name.startsWith('(')) return appSegments(full)
    return hasRouteFile(full) ? [e.name] : []
  })
}

describe('KNOWN_TOP_SEGMENTS (404 vs. přihlášení v middlewaru)', () => {
  it('obsahuje každou routu z app/', () => {
    const missing = appSegments().filter(s => !MATCHER_EXCLUDED.has(s) && !KNOWN_TOP_SEGMENTS.has(s))
    expect(missing).toEqual([])
  })

  it('obsahuje adresáře z public/', () => {
    const pub = fs.readdirSync(path.resolve(__dirname, '../public'), { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name)
    expect(pub.filter(s => !KNOWN_TOP_SEGMENTS.has(s))).toEqual([])
  })

  it('neobsahuje nic, co neexistuje', () => {
    const real = new Set(appSegments().concat(fs.readdirSync(path.resolve(__dirname, '../public'))))
    expect(Array.from(KNOWN_TOP_SEGMENTS).filter(s => !real.has(s))).toEqual([])
  })

  it('isKnownRoute', () => {
    expect(isKnownRoute('/')).toBe(true)
    expect(isKnownRoute('/zakazky/123')).toBe(true)
    expect(isKnownRoute('/blog')).toBe(false)
    expect(isKnownRoute('/llms-full.txt')).toBe(false)
  })
})
