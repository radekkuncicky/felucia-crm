import { describe, it, expect } from 'vitest'
import { normalizePhone, normalizeEmail, jmenaJsouPodobna, najdiDuplicitnihoKlienta, type KlientKandidat } from '@/lib/clientDuplicate'

describe('normalizePhone', () => {
  it('sjednotí +420, 00420 i holé číslo na stejný tvar', () => {
    expect(normalizePhone('+420 777 123 456')).toBe('777123456')
    expect(normalizePhone('00420 777 123 456')).toBe('777123456')
    expect(normalizePhone('777 123 456')).toBe('777123456')
    expect(normalizePhone('777123456')).toBe('777123456')
  })

  it('prázdné/null vrátí prázdný string', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone('')).toBe('')
  })
})

describe('normalizeEmail', () => {
  it('trim + lowercase', () => {
    expect(normalizeEmail('  Jan@Novak.CZ  ')).toBe('jan@novak.cz')
  })
})

describe('jmenaJsouPodobna', () => {
  it('shoda case-insensitive bez diakritiky', () => {
    expect(jmenaJsouPodobna('Jan Novák', 'jan novak')).toBe(true)
  })

  it('malý překlep se toleruje', () => {
    expect(jmenaJsouPodobna('Karel Novák', 'Karel Novak')).toBe(true)
    expect(jmenaJsouPodobna('Alena Svobodová', 'Alena Svobodova')).toBe(true)
  })

  it('jiné jméno se nepovažuje za shodu', () => {
    expect(jmenaJsouPodobna('Jan Novák', 'Petr Svoboda')).toBe(false)
  })
})

describe('najdiDuplicitnihoKlienta', () => {
  const kandidati: KlientKandidat[] = [
    { id: '1', jmeno: 'Jan', prijmeni: 'Novák', telefon: '777123456', email: 'jan@novak.cz' },
    { id: '2', jmeno: 'Petr', prijmeni: 'Svoboda', telefon: null, email: null },
  ]

  it('shoda podle telefonu (i s +420 prefixem)', () => {
    const match = najdiDuplicitnihoKlienta(kandidati, { telefon: '+420 777 123 456' })
    expect(match?.id).toBe('1')
  })

  it('shoda podle emailu (case-insensitive)', () => {
    const match = najdiDuplicitnihoKlienta(kandidati, { email: 'JAN@NOVAK.CZ' })
    expect(match?.id).toBe('1')
  })

  it('bez kontaktu ale s podobným jménem', () => {
    const match = najdiDuplicitnihoKlienta(kandidati, { jmeno: 'Jan', prijmeni: 'Novak' })
    expect(match?.id).toBe('1')
  })

  it('telefon/email vyplněné, ale neshodují se s nikým -> žádná shoda i když je jméno jiné', () => {
    const match = najdiDuplicitnihoKlienta(kandidati, { jmeno: 'Karel', prijmeni: 'Dvořák', telefon: '600111222', email: 'karel@example.com' })
    expect(match).toBeNull()
  })

  it('žádná shoda -> null', () => {
    const match = najdiDuplicitnihoKlienta(kandidati, { jmeno: 'Karel', prijmeni: 'Dvořák' })
    expect(match).toBeNull()
  })

  it('prázdný vstup -> null', () => {
    expect(najdiDuplicitnihoKlienta(kandidati, {})).toBeNull()
  })
})
