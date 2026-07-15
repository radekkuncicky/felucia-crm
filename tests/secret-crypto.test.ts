import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'
import { encryptSecret, decryptSecret } from '@/lib/secretCrypto'

beforeAll(() => {
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
    process.env.CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
  }
})

describe('secretCrypto', () => {
  it('šifrování a dešifrování vrátí původní hodnotu', () => {
    const secret = 'heslo-k-smtp-účtu-ěščřž'
    const enc = encryptSecret(secret)
    expect(enc).not.toContain(secret)
    expect(enc.startsWith('v1:')).toBe(true)
    expect(decryptSecret(enc)).toBe(secret)
  })

  it('každé šifrování má jiný výstup (náhodné IV)', () => {
    expect(encryptSecret('stejné heslo')).not.toBe(encryptSecret('stejné heslo'))
  })

  it('pozměněný ciphertext neprojde (GCM auth tag)', () => {
    const enc = encryptSecret('tajemství')
    const parts = enc.split(':')
    const ct = Buffer.from(parts[3], 'base64')
    ct[0] ^= 0xff
    parts[3] = ct.toString('base64')
    expect(() => decryptSecret(parts.join(':'))).toThrow()
  })

  it('neplatný formát vyhodí srozumitelnou chybu', () => {
    expect(() => decryptSecret('nesmysl')).toThrow('Neplatný formát')
  })
})
