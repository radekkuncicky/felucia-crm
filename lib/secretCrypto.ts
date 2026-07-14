import crypto from 'crypto'

/**
 * Šifrování citlivých údajů ukládaných do DB (SMTP hesla org, později SMS
 * credentials). AES-256-GCM s klíčem CREDENTIALS_ENCRYPTION_KEY v .env
 * (32 bytů hex). Formát: `v1:<iv b64>:<authTag b64>:<ciphertext b64>`.
 */

function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!hex) throw new Error('CREDENTIALS_ENCRYPTION_KEY není nastaven v .env')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY musí být 32 bytů (64 hex znaků)')
  return key
}

export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export function decryptSecret(encrypted: string): string {
  const [version, ivB64, tagB64, ctB64] = encrypted.split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Neplatný formát šifrovaného údaje')
  }
  const key = getKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
