import { describe, it, expect } from 'vitest'
import { parseDataUri, sanitizeNazevSouboru } from '@/lib/zakazkaPodklady'

describe('sanitizeNazevSouboru', () => {
  it('odstraní diakritiku a nebezpečné znaky, zachová příponu', () => {
    expect(sanitizeNazevSouboru('Půdorys přízemí (v2).pdf')).toBe('Pudorys_prizemi_v2_.pdf')
    expect(sanitizeNazevSouboru('../../etc/passwd')).toBe('etc_passwd')
    expect(sanitizeNazevSouboru('')).toBe('soubor')
  })

  it('zkrátí dlouhý název a nechá příponu', () => {
    const out = sanitizeNazevSouboru('a'.repeat(200) + '.jpeg')
    expect(out.length).toBe(80)
    expect(out.endsWith('.jpeg')).toBe(true)
  })
})

describe('parseDataUri', () => {
  it('rozloží base64 data: URI na mime a buffer', () => {
    const parsed = parseDataUri('data:image/jpeg;base64,' + Buffer.from('ahoj').toString('base64'))
    expect(parsed?.mime).toBe('image/jpeg')
    expect(parsed?.buffer.toString()).toBe('ahoj')
  })

  it('vrátí null pro cestu nebo http URL', () => {
    expect(parseDataUri('/uploads/zakazky/x/dok_1_a.pdf')).toBeNull()
    expect(parseDataUri('https://felucia.io/x.pdf')).toBeNull()
  })
})
