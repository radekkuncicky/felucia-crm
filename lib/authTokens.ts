import crypto from 'crypto'

/**
 * Jednorázové tokeny (reset hesla, magic link / pozvánka): do DB se ukládá
 * jen SHA-256 hash — čtení DB nebo zálohy pak neumožní převzít účet. Do
 * e-mailu / UI jde surová hodnota. Při vydání nového tokenu se předchozí
 * nepoužité tokeny uživatele zneplatní.
 */
export function hashAuthToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function newAuthToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex')
  return { raw, hash: hashAuthToken(raw) }
}

// Strukturální typ, aby šel použít bare prisma i orgPrisma (rozšířený klient má jiný TS typ)
type TokenRow = { userId: string; token: string; expiresAt: Date }
type TokenDelegate = {
  deleteMany(args: { where: { userId: string; used: boolean } }): Promise<unknown>
  create(args: { data: TokenRow }): Promise<unknown>
}
type Db = { passwordResetToken: TokenDelegate; magicLinkToken: TokenDelegate }

export async function issuePasswordResetToken(db: Db, userId: string, ttlMs: number): Promise<string> {
  const { raw, hash } = newAuthToken()
  await db.passwordResetToken.deleteMany({ where: { userId, used: false } })
  await db.passwordResetToken.create({ data: { userId, token: hash, expiresAt: new Date(Date.now() + ttlMs) } })
  return raw
}

export async function issueMagicLinkToken(db: Db, userId: string, ttlMs: number): Promise<string> {
  const { raw, hash } = newAuthToken()
  await db.magicLinkToken.deleteMany({ where: { userId, used: false } })
  await db.magicLinkToken.create({ data: { userId, token: hash, expiresAt: new Date(Date.now() + ttlMs) } })
  return raw
}
