import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/auditLog'
import { hashAuthToken } from '@/lib/authTokens'
import { invalidatePermsCache } from '@/lib/permsSnapshot'
import { passwordError } from '@/lib/authInput'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

const isTechnikRole = (role: string) => role === 'TECHNIK' || role === 'HLAVNI_TECHNIK'

type Stav = 'ok' | 'neplatny' | 'pouzity' | 'vyprsel' | 'neaktivni'

async function nactiToken(raw: unknown) {
  if (typeof raw !== 'string' || !raw) return { stav: 'neplatny' as Stav, record: null }
  // V DB je jen hash tokenu
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: hashAuthToken(raw) },
    include: { user: { include: { organization: { select: { nazev: true, aktivni: true } } } } },
  })
  if (!record) return { stav: 'neplatny' as Stav, record: null }
  if (record.used) return { stav: 'pouzity' as Stav, record }
  if (record.expiresAt < new Date()) return { stav: 'vyprsel' as Stav, record }
  if (!record.user.aktivni || !record.user.organization.aktivni) return { stav: 'neaktivni' as Stav, record }
  return { stav: 'ok' as Stav, record }
}

const HLASKY: Record<Exclude<Stav, 'ok'>, string> = {
  neplatny: 'Odkaz je neplatný. Zkontrolujte, že jste ho zkopírovali celý.',
  pouzity: 'Tento odkaz už byl použit. Heslo je nastavené — přihlaste se, nebo si pošlete nový odkaz.',
  vyprsel: 'Platnost odkazu vypršela. Pošlete si nový, nebo požádejte správce firmy.',
  neaktivni: 'Účet je deaktivovaný. Kontaktujte správce firmy.',
}

/** GET ?token= — stránka ověří odkaz hned při otevření (ne až po vyplnění hesla) */
export async function GET(req: Request) {
  const ip = getClientIp(req)
  if (checkRateLimit(`reset-check:${ip}`, 30, 15 * 60_000).limited) {
    return NextResponse.json({ stav: 'neplatny', error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' }, { status: 429 })
  }
  const token = new URL(req.url).searchParams.get('token')
  const { stav, record } = await nactiToken(token)
  if (stav !== 'ok' || !record) return NextResponse.json({ stav, error: HLASKY[stav as Exclude<Stav, 'ok'>] })
  return NextResponse.json({
    stav,
    email: record.user.email,
    jmeno: record.user.jmeno,
    orgNazev: record.user.organization.nazev,
    // Ještě se nikdy nepřihlásil → stránka mluví o pozvánce, ne o resetu
    prvniPrihlaseni: !record.user.lastLoginAt,
    technik: isTechnikRole(record.user.role),
    appUrl: isTechnikRole(record.user.role) ? (process.env.FELUCIA_TECH_APP_URL || null) : null,
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { token, newPassword } = body ?? {}

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Chybí token nebo heslo' }, { status: 400 })
  }
  const chyba = passwordError(newPassword)
  if (chyba) return NextResponse.json({ error: chyba }, { status: 400 })

  const { stav, record } = await nactiToken(token)
  if (stav !== 'ok' || !record) {
    return NextResponse.json({ error: HLASKY[stav as Exclude<Stav, 'ok'>], stav }, { status: 400 })
  }

  const hesloHash = await bcrypt.hash(newPassword, 12)

  // Atomicky „spotřebovat“ token — dvojklik / dvě souběžná odeslání nesmí projít oba
  const spotrebovano = await prisma.$transaction(async tx => {
    const r = await tx.passwordResetToken.updateMany({ where: { id: record.id, used: false }, data: { used: true } })
    if (r.count !== 1) return false
    await tx.user.update({ where: { id: record.userId }, data: { hesloHash, sessionVersion: { increment: 1 } } })
    return true
  })
  if (!spotrebovano) return NextResponse.json({ error: HLASKY.pouzity, stav: 'pouzity' }, { status: 400 })

  invalidatePermsCache(record.userId)
  await logAction({
    orgId: record.user.orgId, userId: record.userId, typAkce: 'UPDATE', typZaznamu: 'User',
    zaznamId: record.userId, zaznamNazev: `${record.user.jmeno} (${record.user.email})`,
    zmeny: { akce: record.user.lastLoginAt ? 'reset-hesla' : 'nastaveni-hesla-z-pozvanky' },
  })

  // E-mail pro automatické přihlášení hned po nastavení hesla (uživatel heslo právě zadal)
  return NextResponse.json({ ok: true, email: record.user.email, technik: isTechnikRole(record.user.role) })
}
