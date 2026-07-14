import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'

beforeAll(() => {
  if (!process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = crypto.randomBytes(32).toString('hex')
  }
})
import {
  generateToken, generateOtp, sha256, otpHash,
  makePodpisCookie, verifyPodpisCookie,
  appendPodpisBlock, sodPodpisBlockHtml,
} from '@/lib/sodPodpis'
import { normalizeTelefon, maskTelefon, isSmsConfigured } from '@/lib/sms'

describe('sodPodpis — tokeny a OTP', () => {
  it('token je dost dlouhý a unikátní', () => {
    const t1 = generateToken()
    expect(t1.length).toBeGreaterThanOrEqual(40)
    expect(t1).not.toBe(generateToken())
  })

  it('OTP je 6 číslic', () => {
    for (let i = 0; i < 20; i++) expect(generateOtp()).toMatch(/^\d{6}$/)
  })

  it('otpHash je vázaný na relaci — stejný kód pro jinou relaci má jiný hash', () => {
    expect(otpHash('123456', 'relace-a')).not.toBe(otpHash('123456', 'relace-b'))
    expect(otpHash('123456', 'relace-a')).toBe(otpHash('123456', 'relace-a'))
  })

  it('sha256 tokenu je deterministický', () => {
    const t = generateToken()
    expect(sha256(t)).toBe(sha256(t))
    expect(sha256(t)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('sodPodpis — ověřovací cookie', () => {
  it('platná cookie projde jen pro svou relaci', () => {
    const { value } = makePodpisCookie('relace-1')
    expect(verifyPodpisCookie('relace-1', value)).toBe(true)
    expect(verifyPodpisCookie('relace-2', value)).toBe(false)
    expect(verifyPodpisCookie('relace-1', undefined)).toBe(false)
    expect(verifyPodpisCookie('relace-1', 'nesmysl')).toBe(false)
  })

  it('pozměněný podpis cookie neprojde', () => {
    const { value } = makePodpisCookie('relace-1')
    const [rid, exp, sig] = value.split('.')
    const tampered = `${rid}.${Number(exp) + 9999999}.${sig}`
    expect(verifyPodpisCookie('relace-1', tampered)).toBe(false)
  })
})

describe('sms — normalizace čísel', () => {
  it('normalizuje běžné české formáty', () => {
    expect(normalizeTelefon('777 123 456')).toBe('420777123456')
    expect(normalizeTelefon('+420 777 123 456')).toBe('420777123456')
    expect(normalizeTelefon('00420777123456')).toBe('420777123456')
    expect(normalizeTelefon('777-123-456')).toBe('420777123456')
  })

  it('odmítne nevalidní čísla', () => {
    expect(normalizeTelefon('12345')).toBeNull()
    expect(normalizeTelefon('')).toBeNull()
    expect(normalizeTelefon('+49 170 1234567')).toBeNull()
  })

  it('maskování ukáže jen předvolbu a poslední trojčíslí', () => {
    expect(maskTelefon('420777123456')).toBe('+420 ••• ••• 456')
  })

  it('bez env konfigurace není SMS nakonfigurováno', () => {
    expect(isSmsConfigured()).toBe(false)
  })
})

describe('sodPodpis — podpisový blok', () => {
  const sod = {
    podpisSvg: 'data:image/png;base64,iVBORw0KGgo=',
    podepsano: new Date('2026-07-14'),
    podepsalJmeno: 'Jan Novák',
    podpisTextHash: 'abc123',
  }

  it('vloží blok před </body>', () => {
    const html = '<html><body><p>Smlouva</p></body></html>'
    const out = appendPodpisBlock(html, sodPodpisBlockHtml(sod))
    expect(out).toContain('Podepsáno elektronicky')
    expect(out.indexOf('Podepsáno elektronicky')).toBeLessThan(out.indexOf('</body>'))
    expect(out).toContain('Jan Novák')
    expect(out).toContain('abc123')
  })

  it('bez podpisu nevrací nic', () => {
    expect(sodPodpisBlockHtml({ ...sod, podpisSvg: null })).toBe('')
    expect(sodPodpisBlockHtml({ ...sod, podepsano: null })).toBe('')
  })

  it('odmítne podpis, který není data URL obrázku', () => {
    expect(sodPodpisBlockHtml({ ...sod, podpisSvg: '<script>alert(1)</script>' })).toBe('')
  })
})
