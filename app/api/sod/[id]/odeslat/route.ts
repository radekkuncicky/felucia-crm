import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPodpisyAccess, PODPISY_MESICNI_LIMIT } from '@/lib/modulPodpisy'
import { isSmsConfigured, normalizeTelefon } from '@/lib/sms'
import { isOrgEmailConfigured, sendOrgEmail, emailPodpisVyzadan } from '@/lib/email'
import { getOrgSettings } from '@/lib/orgSettings'
import { sha256, logSodUdalost } from '@/lib/sodPodpis'
import { buildSodBaseHtml } from '@/lib/sodHtml'
import { odeslatSodKlientovi } from '@/lib/sodOdeslani'
import { createNotification } from '@/lib/createNotification'

// Odeslání smlouvy k podpisu. Smlouvu musí nejdřív podepsat zmocněnec
// (User.podepisujeSmlouvy) za zhotovitele, teprve pak jde klientovi:
//   1. platný interní podpis → rovnou klientovi
//   2. odesílá zmocněnec → podepíše v jednom kroku (podpisSvg v body) a odešle
//   3. odesílá kdokoli jiný → žádost o interní podpis (bell + e-mail zmocněncům),
//      po podpisu se smlouva odešle klientovi automaticky
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const pristup = await getPodpisyAccess(session.user.orgId, session.user.plan)
  if (!pristup.allowed) {
    if (pristup.zdroj === 'MODUL') {
      return NextResponse.json(
        { error: `Měsíční limit modulu (${PODPISY_MESICNI_LIMIT} odeslaných smluv) je vyčerpán — obnoví se 1. den dalšího měsíce` },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: pristup.muzeAktivovatModul
          ? 'Aktivujte si modul Online podpis ve Fakturaci, nebo přejděte na plán PROFESSIONAL'
          : 'Online podpis smluv je dostupný v plánu PROFESSIONAL a vyšším' },
      { status: 403 }
    )
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

  // Za zhotovitele musí smlouvu podepsat zmocněnec — bez něj se neodesílá
  const zmocnenci = await db.user.findMany({
    where: { orgId, aktivni: true, podepisujeSmlouvy: true },
    select: { id: true, jmeno: true, email: true },
  })
  if (zmocnenci.length === 0) {
    return NextResponse.json(
      { error: 'Nejprve v Nastavení → Uživatelé určete, kdo za firmu podepisuje smlouvy' },
      { status: 422 }
    )
  }

  const baseHash = sha256(buildSodBaseHtml(sod))
  const maPlatnyPodpis = !!sod.zhotovitelPodepsano && sod.zhotovitelTextHash === baseHash
  const jeZmocnenec = zmocnenci.some(z => z.id === session.user.id)

  // 2) odesílá zmocněnec bez platného podpisu → podepíše v jednom kroku
  if (!maPlatnyPodpis && jeZmocnenec) {
    const podpisSvg = typeof body.podpisSvg === 'string' ? body.podpisSvg : ''
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(podpisSvg) || podpisSvg.length > 500_000) {
      return NextResponse.json({ error: 'Chybí podpis — podepište smlouvu v podpisovém poli' }, { status: 422 })
    }
    const ja = zmocnenci.find(z => z.id === session.user.id)!
    await db.sod.update({
      where: { id: sod.id },
      data: {
        zhotovitelPodpisSvg: podpisSvg,
        zhotovitelPodepsano: new Date(),
        zhotovitelPodepsalJmeno: ja.jmeno,
        zhotovitelPodepsalId: ja.id,
        zhotovitelTextHash: baseHash,
      },
    })
    sod.zhotovitelPodpisSvg = podpisSvg
    sod.zhotovitelPodepsano = new Date()
    sod.zhotovitelPodepsalJmeno = ja.jmeno
    sod.zhotovitelPodepsalId = ja.id
    sod.zhotovitelTextHash = baseHash
    await logSodUdalost({
      orgId, sodId: sod.id, typ: 'PODEPSANO_ZHOTOVITELEM',
      userId: ja.id, meta: { jmeno: ja.jmeno, textHash: baseHash }, req,
    })
  }

  // 1+2) interní podpis existuje → rovnou klientovi
  if (maPlatnyPodpis || jeZmocnenec) {
    const vysledek = await odeslatSodKlientovi({
      sod, orgId, email, telefon, odeslalId: session.user.id, req,
    })
    if (!vysledek.ok) return NextResponse.json({ error: vysledek.error }, { status: 422 })
    return NextResponse.json({ ok: true, email, telefon, expirace: vysledek.expirace })
  }

  // 3) odesílá ne-zmocněnec → žádost o interní podpis, klientovi až po něm
  const zadatel = await db.user.findFirst({
    where: { id: session.user.id, orgId },
    select: { jmeno: true },
  })
  const zadatelJmeno = zadatel?.jmeno ?? 'Kolega'

  await db.sod.update({
    where: { id: sod.id },
    data: {
      stav: 'K_INTERNIMU_PODPISU',
      podpisZadost: { email, telefon, userId: session.user.id, jmeno: zadatelJmeno },
    },
  })
  await logSodUdalost({
    orgId, sodId: sod.id, typ: 'PODPIS_VYZADAN',
    userId: session.user.id,
    meta: { email, telefon, zmocnenci: zmocnenci.map(z => z.jmeno) }, req,
  })

  const settings = await getOrgSettings(orgId)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const url = `https://${sod.organization.slug}.${rootDomain}/sod/${sod.id}`
  for (const z of zmocnenci) {
    await createNotification({
      orgId,
      userId: z.id,
      typ: 'SOD_PODPIS_VYZADAN',
      zprava: `${zadatelJmeno} žádá o podpis smlouvy ${sod.cislo} za zhotovitele`,
      dealId: sod.dealId,
      url: `/sod/${sod.id}`,
    })
    await sendOrgEmail(
      orgId, z.email,
      `Smlouva č. ${sod.cislo} čeká na váš podpis`,
      emailPodpisVyzadan({
        orgNazev: sod.organization.nazev,
        primaryColor: settings.primaryColor,
        zmocnenecJmeno: z.jmeno,
        zadatelJmeno,
        cisloSmlouvy: sod.cislo,
        klientJmeno: sod.klientJmeno,
        url,
      })
    ).catch(() => { /* bell notifikace stačí, e-mail je bonus */ })
  }

  return NextResponse.json({
    ok: true,
    cekaNaPodpis: true,
    zmocnenci: zmocnenci.map(z => z.jmeno),
  })
}
