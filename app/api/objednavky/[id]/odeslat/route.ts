import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { isOrgEmailConfigured, sendOrgEmail, emailObjednavkaDodavateli } from '@/lib/email'
import { getOrgSettings } from '@/lib/orgSettings'
import { loadObjednavkaFull, renderObjednavkaPdf } from '@/lib/objednavkaDokument'
import { OBJEDNAVKA_INCLUDE, serializeObjednavka } from '@/lib/objednavky'
import { formatDate } from '@/lib/format'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * Odeslání objednávky dodavateli e-mailem s PDF v příloze: { to?, zprava? }.
 * Výchozí adresa = e-mail dodavatele. Po úspěchu stav ODESLANA.
 * PDF pro dodavatele nese ceny podle přepínače objednávky (odesílatel má sklad PLNY;
 * ceny do PDF jdou jen pokud je zároveň smí vidět).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const o = await loadObjednavkaFull(orgId, params.id)
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (o.zakazkaId && !(await canAccessZakazka(session.user, perms, o.zakazkaId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (o.stav === 'ZRUSENA' || o.stav === 'DORUCENA') return NextResponse.json({ error: 'Objednávka je uzavřená' }, { status: 422 })
  if (o.polozky.length === 0) return NextResponse.json({ error: 'Objednávka nemá položky' }, { status: 422 })

  if (!(await isOrgEmailConfigured(orgId))) {
    return NextResponse.json({ error: 'Odesílání e-mailů není nastaveno. Nastavte SMTP v Nastavení → E-mail.' }, { status: 422 })
  }

  const rl = checkRateLimit(`objednavka-email:${session.user.id}`, 20, 60 * 60 * 1000)
  if (rl.limited) return NextResponse.json({ error: 'Příliš mnoho odeslaných e-mailů, zkuste to později.' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const to = (typeof body.to === 'string' && body.to.trim()) || o.dodavatel.email
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'Dodavatel nemá e-mail — zadejte adresu ručně.' }, { status: 400 })
  }
  const zprava = typeof body.zprava === 'string' && body.zprava.trim() ? body.zprava.trim().slice(0, 2000) : null

  const [org, settings] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { nazev: true, email: true, plan: true } }),
    getOrgSettings(orgId),
  ])
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const pdf = await renderObjednavkaPdf(orgId, org.plan, o, perms.financeNakupky)
    const html = emailObjednavkaDodavateli({
      orgNazev: org.nazev,
      primaryColor: settings.primaryColor,
      cislo: o.cislo,
      dodavatelNazev: o.dodavatel.nazev,
      kontaktOsoba: o.dodavatel.kontaktOsoba,
      zprava,
      pozadovanyTermin: o.pozadovanyTermin ? formatDate(o.pozadovanyTermin) : null,
      odpovedEmail: org.email,
    })
    await sendOrgEmail(orgId, to, `Objednávka ${o.cislo} — ${org.nazev}`, html, [{ filename: `${o.cislo}.pdf`, content: pdf }])
  } catch (err) {
    console.error('[objednavka-odeslat] error:', err)
    return NextResponse.json({ error: 'E-mail se nepodařilo odeslat. Zkontrolujte SMTP nastavení.' }, { status: 502 })
  }

  const db = orgPrisma(orgId)
  await db.$transaction([
    db.objednavka.update({ where: { id: o.id }, data: { stav: o.stav === 'NAVRH' ? 'ODESLANA' : o.stav, odeslano: new Date() } }),
    db.auditLog.create({
      data: { orgId, userId: session.user.id, typAkce: 'UPDATE', typZaznamu: 'Objednavka', zaznamId: o.id, zaznamNazev: o.cislo, zmeny: { odeslano: to } },
    }),
  ])
  const fresh = await db.objednavka.findFirst({ where: { id: o.id, orgId }, include: OBJEDNAVKA_INCLUDE })
  return NextResponse.json({ ok: true, to, objednavka: serializeObjednavka(fresh!, perms.financeNakupky) })
}
