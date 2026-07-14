import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPlanLimits } from '@/lib/planLimits'
import { isSmsConfigured, normalizeTelefon } from '@/lib/sms'
import { isOrgEmailConfigured, sendOrgEmail, emailPodpisSmlouvy } from '@/lib/email'
import { getOrgSettings } from '@/lib/orgSettings'
import {
  generateToken, sha256, logSodUdalost, PODPIS_RELACE_DNI,
} from '@/lib/sodPodpis'
import { buildSodContentHtml } from '@/lib/sodPdf'

// Odeslání smlouvy klientovi k online podpisu: snapshot verze, podpisová
// relace (token e-mailem, OTP později SMS) a e-mail s odkazem.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!getPlanLimits(session.user.plan).hasOnlinePodpis) {
    return NextResponse.json({ error: 'Online podpis smluv je dostupný v plánu PROFESSIONAL a vyšším' }, { status: 403 })
  }
  if (!isSmsConfigured()) {
    return NextResponse.json({ error: 'SMS brána není nakonfigurována — online podpis zatím nelze použít' }, { status: 422 })
  }
  const orgId = session.user.orgId
  if (!(await isOrgEmailConfigured(orgId))) {
    return NextResponse.json({ error: 'Nejprve nastavte odesílání e-mailů v Nastavení → Odesílání e-mailů' }, { status: 422 })
  }

  const db = orgPrisma(orgId)
  const sod = await db.sod.findFirst({
    where: { id: params.id, orgId },
    include: {
      organization: {
        select: {
          nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true,
          plan: true, slug: true,
          prilohaVopPath: true, prilohaVzspPath: true, prilohaCenikPath: true,
        },
      },
    },
  })
  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (sod.stav === 'PODEPSANO') {
    return NextResponse.json({ error: 'Smlouva už je podepsaná' }, { status: 422 })
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? sod.klientEmail ?? '').trim()
  const telefonRaw = String(body.telefon ?? sod.klientTelefon ?? '').trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Neplatný e-mail klienta' }, { status: 422 })
  }
  const telefon = normalizeTelefon(telefonRaw)
  if (!telefon) {
    return NextResponse.json({ error: 'Neplatné české mobilní číslo — na něj přijde ověřovací kód' }, { status: 422 })
  }

  // Snapshot přesně toho, co klient uvidí a podepíše
  const contentHtml = buildSodContentHtml(sod)

  const token = generateToken()
  const puvodniStav = sod.stav
  const expirace = new Date(Date.now() + PODPIS_RELACE_DNI * 24 * 3600_000)

  const relace = await db.$transaction(async tx => {
    // starý odkaz přestává platit — vždy je aktivní max. jedna relace
    await tx.sodPodpisRelace.updateMany({
      where: { sodId: sod.id, stav: 'AKTIVNI' },
      data: { stav: 'ZNEPLATNENA' },
    })
    const posledni = await tx.sodVerze.findFirst({
      where: { sodId: sod.id },
      orderBy: { cislo: 'desc' },
      select: { cislo: true },
    })
    const verze = await tx.sodVerze.create({
      data: {
        orgId,
        sodId: sod.id,
        cislo: (posledni?.cislo ?? 0) + 1,
        textSmlouvy: contentHtml,
        vytvorilId: session.user.id,
      },
    })
    const relace = await tx.sodPodpisRelace.create({
      data: {
        orgId,
        sodId: sod.id,
        verzeId: verze.id,
        tokenHash: sha256(token),
        email,
        telefon,
        expirace,
        odeslalId: session.user.id,
      },
    })
    await tx.sod.update({ where: { id: sod.id }, data: { stav: 'ODESLANO' } })
    return relace
  })

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const url = `https://${sod.organization.slug}.${rootDomain}/podpis/${token}`
  const settings = await getOrgSettings(orgId)

  try {
    await sendOrgEmail(
      orgId,
      email,
      `Smlouva č. ${sod.cislo} k podpisu — ${sod.organization.nazev}`,
      emailPodpisSmlouvy({
        orgNazev: sod.organization.nazev,
        primaryColor: settings.primaryColor,
        klientJmeno: sod.klientJmeno,
        cisloSmlouvy: sod.cislo,
        url,
        platnostDni: PODPIS_RELACE_DNI,
      })
    )
  } catch (e) {
    // e-mail nedorazil → relaci zrušit a vrátit původní stav, ať UI nelže
    await db.sodPodpisRelace.update({ where: { id: relace.id }, data: { stav: 'ZNEPLATNENA' } })
    await db.sod.update({ where: { id: sod.id }, data: { stav: puvodniStav } })
    const msg = e instanceof Error ? e.message : 'neznámá chyba'
    return NextResponse.json({ error: `E-mail se nepodařilo odeslat: ${msg}` }, { status: 422 })
  }

  await logSodUdalost({
    orgId, sodId: sod.id, typ: 'ODESLANO', relaceId: relace.id,
    userId: session.user.id, meta: { email, telefon }, req,
  })

  return NextResponse.json({ ok: true, email, telefon, expirace })
}
