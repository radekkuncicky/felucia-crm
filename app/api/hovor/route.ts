import { getServerSession } from 'next-auth'
import { Prisma, Technologie, TypAktivity } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { followUpData, leadUzavren, parseFollowUp } from '@/lib/activities'
import { checkDealLimit } from '@/lib/checkPlanLimit'
import { createWithUniqueKod } from '@/lib/uniqueKod'
import { generateDealKod } from '@/lib/dealKod'
import { logAction } from '@/lib/auditLog'
import { parseZdroj, type ZdrojVstup } from '@/lib/zdrojPoptavky'

const TECHNOLOGIE = new Set<string>(Object.values(Technologie))
const CILE = ['OP', 'LEAD', 'NOVY_OP'] as const
type Cil = typeof CILE[number]

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Zápis hovoru jedním krokem:
 * { cil: 'OP'|'LEAD'|'NOVY_OP', smer?: 'PRICHOZI'|'ODCHOZI', poznamka?, datum?,
 *   dealId? (OP), leadId? (LEAD stávající / NOVY_OP převod leadu), clientId? (NOVY_OP stávající klient),
 *   jmeno?, firma?, telefon?, email? (nový lead/klient), technologie?, predmet? (NOVY_OP),
 *   dalsiKrok?: { typ, datum, popis? } }
 * Hovor = hotová aktivita HOVOR s výsledkem, další krok = naplánovaná aktivita.
 * → { cil, dealId?, leadId?, aktivitaId }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (!perms.obchod) return forbidden('Nemáte oprávnění zapisovat hovory')

  const orgId = session.user.orgId
  const userId = session.user.id
  const db = orgPrisma(orgId)
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Neplatná data požadavku.' }, { status: 400 })

  const cil = CILE.includes(body.cil) ? (body.cil as Cil) : null
  if (!cil) return NextResponse.json({ error: 'Vyberte, kam hovor zapsat' }, { status: 400 })
  if (cil === 'LEAD' && session.user.plan === 'STARTER') {
    return NextResponse.json({ error: 'Leady jsou dostupné od plánu Standard.' }, { status: 403 })
  }

  const datum = body.datum ? new Date(body.datum) : new Date()
  if (isNaN(datum.getTime())) return NextResponse.json({ error: 'Neplatné datum hovoru' }, { status: 400 })
  const hovor = {
    typ: 'HOVOR' as TypAktivity,
    popis: body.smer === 'ODCHOZI' ? 'Odchozí hovor' : 'Příchozí hovor',
    vysledek: str(body.poznamka),
    datum,
    // eslint-disable-next-line no-restricted-syntax -- čas aktivity v pražském čase (server běží v UTC), ne formátování pro UI
    cas: datum.toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' }),
    stav: 'DOKONCENA' as const,
    splneno: true,
  }

  // Zdroj poptávky u nového leadu / nového OP (KPI 6)
  const zdroj = await parseZdroj(db, orgId, body)
  if (typeof zdroj === 'string') return NextResponse.json({ error: zdroj }, { status: 400 })

  const telefon = str(body.telefon)
  const jmeno = str(body.jmeno)
  const firma = str(body.firma)
  const email = str(body.email)

  // ── K existujícímu OP ────────────────────────────────────────────────
  if (cil === 'OP') {
    const dealId = str(body.dealId)
    if (!dealId || !(await canAccessDeal(session.user, perms, dealId))) {
      return NextResponse.json({ error: 'Obchodní případ nenalezen' }, { status: 404 })
    }
    const dalsi = parseFollowUp(body.dalsiKrok, { leadId: null })
    if (typeof dalsi === 'string') return NextResponse.json({ error: dalsi }, { status: 400 })
    const aktivita = await db.$transaction(async tx => {
      const a = await tx.activity.create({ data: { orgId, dealId, userId, resitelId: userId, ...hovor } })
      if (dalsi) await tx.activity.create({ data: followUpData({ orgId, dealId, leadId: null, resitelId: userId }, dalsi, userId) })
      return a
    })
    return NextResponse.json({ cil, dealId, aktivitaId: aktivita.id }, { status: 201 })
  }

  // ── Lead (stávající nebo nový) ───────────────────────────────────────
  if (cil === 'LEAD') {
    const dalsi = parseFollowUp(body.dalsiKrok, { leadId: 'lead' })
    if (typeof dalsi === 'string') return NextResponse.json({ error: dalsi }, { status: 400 })
    const leadId = str(body.leadId)
    if (leadId) {
      const lead = await db.lead.findFirst({ where: { id: leadId, orgId }, select: { status: true } })
      if (!lead) return NextResponse.json({ error: 'Lead nenalezen' }, { status: 404 })
      if (leadUzavren(lead.status)) return NextResponse.json({ error: 'Lead je uzavřený' }, { status: 400 })
    } else if (!jmeno && !firma) {
      return NextResponse.json({ error: 'Vyplňte jméno volajícího' }, { status: 400 })
    }

    const vysledek = await db.$transaction(async tx => {
      const lead = leadId
        ? await tx.lead.findUniqueOrThrow({ where: { id: leadId }, select: { id: true, status: true } })
        : await tx.lead.create({
            data: {
              orgId, jmeno: jmeno ?? firma!, firma, telefon, email,
              zdroj: 'RUCNE', status: 'KONTAKTOVAN', assignedToId: userId,
              zprava: hovor.vysledek, ...zdroj,
            },
            select: { id: true, status: true },
          })
      // Po hovoru je lead kontaktovaný (kvalifikovaný zůstává)
      if (lead.status === 'NOVY') await tx.lead.update({ where: { id: lead.id }, data: { status: 'KONTAKTOVAN' } })
      const a = await tx.activity.create({ data: { orgId, leadId: lead.id, userId, resitelId: userId, ...hovor } })
      if (dalsi) await tx.activity.create({ data: followUpData({ orgId, dealId: null, leadId: lead.id, resitelId: userId }, dalsi, userId) })
      return { leadId: lead.id, aktivitaId: a.id }
    })
    return NextResponse.json({ cil, ...vysledek }, { status: 201 })
  }

  // ── Rovnou nový OP (stávající nebo nový klient, případně převod leadu) ─
  const dalsi = parseFollowUp(body.dalsiKrok, { leadId: null })
  if (typeof dalsi === 'string') return NextResponse.json({ error: dalsi }, { status: 400 })
  const technologie = TECHNOLOGIE.has(body.technologie) ? (body.technologie as Technologie) : null
  if (!technologie) return NextResponse.json({ error: 'Vyberte technologii' }, { status: 400 })
  const clientIdVstup = str(body.clientId)
  if (clientIdVstup && !(await db.client.findFirst({ where: { id: clientIdVstup, orgId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Klient nenalezen' }, { status: 404 })
  }
  if (!clientIdVstup && !jmeno && !firma) return NextResponse.json({ error: 'Vyplňte jméno volajícího' }, { status: 400 })
  const leadId = str(body.leadId)
  let zdrojOp: Partial<ZdrojVstup> = zdroj
  if (leadId) {
    const lead = await db.lead.findFirst({
      where: { id: leadId, orgId },
      select: { status: true, zdrojPoptavkyId: true, doporucilKlientId: true, doporucilText: true },
    })
    if (!lead || leadUzavren(lead.status)) return NextResponse.json({ error: 'Lead nenalezen nebo je uzavřený' }, { status: 404 })
    // Převod leadu: OP převezme zdroj leadu, pokud ho dialog nezadal
    if (!zdroj.zdrojPoptavkyId) {
      zdrojOp = { zdrojPoptavkyId: lead.zdrojPoptavkyId, doporucilKlientId: lead.doporucilKlientId, doporucilText: lead.doporucilText }
    }
  }
  if (!(await checkDealLimit(orgId))) {
    return NextResponse.json({
      error: 'PLAN_LIMIT_REACHED',
      message: 'Dosáhli jste limitu obchodních případů pro váš plán. Vyšší plán má neomezený počet.',
      upgradeUrl: '/settings/billing',
    }, { status: 403 })
  }

  try {
    const vysledek = await createWithUniqueKod(
      () => generateDealKod(orgId),
      kod => db.$transaction(async tx => {
        // Firma: jmeno = název, prijmeni = kontaktní osoba (jako převod leadu)
        const clientId = clientIdVstup ?? (await tx.client.create({
          data: firma
            ? { orgId, typKlienta: 'FIRMA', jmeno: firma, prijmeni: jmeno ?? '', telefon, email }
            : { orgId, typKlienta: 'FYZICKA_OSOBA', jmeno: jmeno!.split(' ')[0], prijmeni: jmeno!.split(' ').slice(1).join(' '), telefon, email },
          select: { id: true },
        })).id
        const deal = await tx.deal.create({
          data: { orgId, clientId, userId, kod, technologie, stav: 'NOVY', predmet: str(body.predmet), ...zdrojOp },
          select: { id: true, kod: true, predmet: true },
        })
        if (leadId) {
          await tx.lead.update({ where: { id: leadId }, data: { status: 'PREVEDEN', prevedenNaOpId: deal.id, prevedenNaKlientId: clientId } })
          await tx.activity.updateMany({ where: { leadId }, data: { leadId: null, dealId: deal.id } })
        }
        const a = await tx.activity.create({ data: { orgId, dealId: deal.id, userId, resitelId: userId, ...hovor } })
        if (dalsi) await tx.activity.create({ data: followUpData({ orgId, dealId: deal.id, leadId: null, resitelId: userId }, dalsi, userId) })
        return { deal, clientId, aktivitaId: a.id }
      }),
    )
    await logAction({
      orgId, userId, typAkce: 'CREATE', typZaznamu: 'Deal', zaznamId: vysledek.deal.id,
      zaznamNazev: `${vysledek.deal.kod ?? ''} ${vysledek.deal.predmet ?? 'Nový případ'}`.trim(),
      zmeny: { zdroj: 'zapis-hovoru', technologie, leadId },
    })
    return NextResponse.json({ cil, dealId: vysledek.deal.id, clientId: vysledek.clientId, aktivitaId: vysledek.aktivitaId }, { status: 201 })
  } catch (e) {
    console.error(`[hovor] selhalo založení OP z hovoru (org ${orgId}):`, e)
    const message = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      ? 'Založení OP se nezdařilo kvůli kolizi čísla, zkuste to prosím znovu.'
      : 'Hovor se nepodařilo zapsat, zkuste to prosím znovu.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
