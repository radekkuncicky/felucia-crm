import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { isSmsConfigured } from '@/lib/sms'
import { isOrgEmailConfigured } from '@/lib/email'
import { sha256, logSodUdalost } from '@/lib/sodPodpis'
import { buildSodBaseHtml } from '@/lib/sodHtml'
import { odeslatSodKlientovi } from '@/lib/sodOdeslani'
import { createNotification } from '@/lib/createNotification'

// Interní podpis smlouvy za zhotovitele. Jen zmocněnec (User.podepisujeSmlouvy).
// Čeká-li žádost od kolegy (podpisZadost), smlouva se po podpisu automaticky
// odešle klientovi; selhání odeslání podpis neruší.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const ja = await db.user.findFirst({
    where: { id: session.user.id, orgId, aktivni: true, podepisujeSmlouvy: true },
    select: { id: true, jmeno: true },
  })
  if (!ja) {
    return NextResponse.json({ error: 'Podpis smluv za zhotovitele vám nebyl svěřen — nastavuje ho admin v Nastavení → Uživatelé' }, { status: 403 })
  }

  const sod = await db.sod.findFirst({
    where: { id: params.id, orgId },
    include: {
      organization: {
        select: {
          nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true, slug: true,
        },
      },
    },
  })
  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (sod.stav !== 'NAVRH' && sod.stav !== 'K_INTERNIMU_PODPISU') {
    return NextResponse.json({ error: 'Smlouvu v tomto stavu nelze interně podepsat' }, { status: 422 })
  }

  const body = await req.json().catch(() => ({}))
  const podpisSvg = typeof body.podpisSvg === 'string' ? body.podpisSvg : ''
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(podpisSvg) || podpisSvg.length > 500_000) {
    return NextResponse.json({ error: 'Podpis se nepodařilo načíst, zkuste to znovu' }, { status: 422 })
  }

  const baseHash = sha256(buildSodBaseHtml(sod))
  const podepsano = new Date()
  await db.sod.update({
    where: { id: sod.id },
    data: {
      zhotovitelPodpisSvg: podpisSvg,
      zhotovitelPodepsano: podepsano,
      zhotovitelPodepsalJmeno: ja.jmeno,
      zhotovitelPodepsalId: ja.id,
      zhotovitelTextHash: baseHash,
    },
  })
  sod.zhotovitelPodpisSvg = podpisSvg
  sod.zhotovitelPodepsano = podepsano
  sod.zhotovitelPodepsalJmeno = ja.jmeno
  sod.zhotovitelPodepsalId = ja.id
  sod.zhotovitelTextHash = baseHash
  await logSodUdalost({
    orgId, sodId: sod.id, typ: 'PODEPSANO_ZHOTOVITELEM',
    userId: ja.id, meta: { jmeno: ja.jmeno, textHash: baseHash }, req,
  })

  // Bez čekající žádosti jen uložit podpis — odeslání klientovi je na obchodníkovi
  const zadost = sod.podpisZadost as { email?: string; telefon?: string; userId?: string; jmeno?: string } | null
  if (!zadost?.email || !zadost?.telefon) {
    return NextResponse.json({ ok: true, odeslano: false })
  }

  // Auto-odeslání klientovi na kontakt z žádosti
  if (!isSmsConfigured() || !(await isOrgEmailConfigured(orgId))) {
    return NextResponse.json({
      ok: true, odeslano: false,
      chybaOdeslani: 'Podpis je uložen, ale odeslání klientovi selhalo — chybí konfigurace SMS/e-mailu',
    })
  }

  const vysledek = await odeslatSodKlientovi({
    sod, orgId,
    email: zadost.email,
    telefon: zadost.telefon,
    odeslalId: zadost.userId ?? ja.id,
    req,
  })
  if (!vysledek.ok) {
    return NextResponse.json({
      ok: true, odeslano: false,
      chybaOdeslani: `Podpis je uložen, ale odeslání klientovi selhalo: ${vysledek.error}`,
    })
  }

  // Žadateli dát vědět, že jeho smlouva odešla
  if (zadost.userId && zadost.userId !== ja.id) {
    await createNotification({
      orgId,
      userId: zadost.userId,
      typ: 'SOD_PODEPSANA_ZHOTOVITELEM',
      zprava: `${ja.jmeno} podepsal(a) smlouvu ${sod.cislo} — odeslána klientovi na ${zadost.email}`,
      dealId: sod.dealId,
      url: `/sod/${sod.id}`,
    })
  }

  return NextResponse.json({ ok: true, odeslano: true, email: zadost.email, expirace: vysledek.expirace })
}
