import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { listUsersWithPerm } from '@/lib/zakazkyHelpers'
import { getOrgSettings } from '@/lib/orgSettings'
import { getPlanLimits } from '@/lib/planLimits'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/auditLog'
import { createNotification } from '@/lib/createNotification'
import { createZakazkaFromDeal } from '@/lib/zakazkaWorkflow'
import { dealScopeWhere, forbidden, getPerms } from '@/lib/permissions'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const scope = dealScopeWhere(getPerms(session.user), session.user.id)
  if (!scope) return forbidden()

  const deal = await db.deal.findFirst({
    where: { id: params.id, orgId, ...scope },
    include: { activities: { select: { typ: true } } },
  })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Zneplatnit smí jen kdo má právo mazat v obchodu
  if (body.stav === 'ZNEPLATNENO' && !getPerms(session.user).obchodMazani) {
    return forbidden('Nemáte oprávnění zneplatnit OP')
  }

  // Ověř že přiřazovaný uživatel patří stejné org
  if (body.userId) {
    const assignedUser = await db.user.findFirst({ where: { id: body.userId, orgId } })
    if (!assignedUser) return NextResponse.json({ error: 'Uživatel nenalezen' }, { status: 400 })
  }

  // Check povinnaAktivitaUOP if transitioning to USPECH
  if (body.stav === 'USPECH' && deal.stav !== 'USPECH') {
    const orgSettings = await getOrgSettings(orgId)
    if (orgSettings.povinnaAktivitaUOP) {
      const hasValidActivity = deal.activities.some(a => a.typ === 'HOVOR' || a.typ === 'SCHUZKA')
      if (!hasValidActivity) {
        return NextResponse.json({ chybaPovinnaAktivita: true }, { status: 200 })
      }
    }
  }

  const updated = await db.deal.update({
    where: { id: params.id },
    data: {
      stav: body.stav ?? deal.stav,
      predmet: body.predmet !== undefined ? body.predmet : deal.predmet,
      hodnotaZalohy: body.hodnotaZalohy !== undefined ? (body.hodnotaZalohy === '' ? null : body.hodnotaZalohy) : deal.hodnotaZalohy,
      splatnostZalohy: body.splatnostZalohy !== undefined ? (body.splatnostZalohy ? new Date(body.splatnostZalohy) : null) : deal.splatnostZalohy,
      terminPrevzeti: body.terminPrevzeti !== undefined ? (body.terminPrevzeti ? new Date(body.terminPrevzeti) : null) : deal.terminPrevzeti,
      terminRealizace: body.terminRealizace !== undefined ? (body.terminRealizace ? new Date(body.terminRealizace) : null) : deal.terminRealizace,
      cisloSmlouvy: body.cisloSmlouvy !== undefined ? body.cisloSmlouvy : deal.cisloSmlouvy,
      adresaDila: body.adresaDila !== undefined ? body.adresaDila : deal.adresaDila,
      kontaktniOsoba: body.kontaktniOsoba !== undefined ? body.kontaktniOsoba : deal.kontaktniOsoba,
      kontaktniTelefon: body.kontaktniTelefon !== undefined ? body.kontaktniTelefon : deal.kontaktniTelefon,
      poznamky: body.poznamky !== undefined ? body.poznamky : deal.poznamky,
      duvodProhry: body.duvodProhry !== undefined ? body.duvodProhry : deal.duvodProhry,
      userId: body.userId !== undefined ? (body.userId || null) : deal.userId,
    },
  })

  const isNewUspech = body.stav === 'USPECH' && deal.stav !== 'USPECH'
  const suggestServiceContract = isNewUspech && getPlanLimits(session.user.plan).hasServiceModule

  // Auto-create Zakazka when deal moves to USPECH (skip if one already exists for this OP)
  if (isNewUspech) {
    await createZakazkaFromDeal(params.id, orgId, session.user.id)
  }

  // Auto-create Zarizeni when deal transitions to USPECH and automatickyServis is enabled
  let autoZarizeniId: string | null = null
  if (isNewUspech && getPlanLimits(session.user.plan).hasServiceModule) {
    const orgSettings = await getOrgSettings(orgId)
    if (orgSettings.automatickyServis) {
      const existingZarizeni = await db.zarizeni.findFirst({ where: { dealId: params.id, orgId } })
      if (!existingZarizeni) {
        const technologieNazev: Record<string, string> = {
          TEPELNE_CERPADLO: 'Tepelné čerpadlo',
          KLIMA: 'Klimatizace',
          REKUPERACE: 'Rekuperace',
          PODLAHOVE_TOPENI: 'Podlahové topení',
          VZDUCHOTECHNIKA: 'Vzduchotechnika',
          JINE: 'Zařízení',
        }
        const technologieTyp: Record<string, string> = {
          TEPELNE_CERPADLO: 'TEPELNE_CERPADLO',
          KLIMA: 'KLIMATIZACE',
          REKUPERACE: 'REKUPERACE',
          PODLAHOVE_TOPENI: 'PODLAHOVE_VYTAPENI',
          VZDUCHOTECHNIKA: 'VZDUCHOTECHNIKA',
          JINE: 'JINE',
        }
        const zarizeniNazev = deal.predmet || technologieNazev[deal.technologie] || 'Zařízení'
        const zarizeniTyp = technologieTyp[deal.technologie] || 'JINE'
        const zarizeni = await db.zarizeni.create({
          data: {
            orgId,
            klientId: deal.clientId,
            dealId: deal.id,
            nazev: zarizeniNazev,
            typ: zarizeniTyp as never,
            datumInstalace: deal.terminRealizace ?? null,
          },
        })
        autoZarizeniId = zarizeni.id
      }
    }
  }

  if (body.stav === 'USPECH' && deal.stav !== 'USPECH') {
    const admins = await listUsersWithPerm(orgId, 'zakazkySchvalovani')
    await Promise.all(admins.map(admin =>
      createNotification({
        orgId,
        userId: admin.id,
        typ: 'OP_USPECH',
        zprava: `OP ${updated.kod} označen jako Úspěch`,
        dealId: updated.id,
      })
    ))
  } else if (body.stav === 'PAS' && deal.stav !== 'PAS' && deal.userId) {
    await createNotification({
      orgId,
      userId: deal.userId,
      typ: 'OP_PAS',
      zprava: `OP ${updated.kod} propadl`,
      dealId: updated.id,
    })
  }

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'UPDATE',
    typZaznamu: 'Deal',
    zaznamId: params.id,
    zaznamNazev: `${updated.kod ?? ''} ${updated.predmet ?? 'Případ'}`.trim(),
    zmeny: body,
  })

  return NextResponse.json({ ...updated, suggestServiceContract, autoZarizeniId })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!getPerms(session.user).obchodMazani) return forbidden('Nemáte oprávnění mazat OP')

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await logAction({
    orgId,
    userId: session.user.id,
    typAkce: 'DELETE',
    typZaznamu: 'Deal',
    zaznamId: params.id,
    zaznamNazev: `${deal.kod ?? ''} ${deal.predmet ?? 'Případ'}`.trim(),
  })

  await db.$transaction(async (tx) => {
    // Smaz custom field values
    await tx.customFieldValue.deleteMany({ where: { entityId: params.id } })

    // Najdi zarizeni tohoto OP
    const zarizeniList = await tx.zarizeni.findMany({ where: { dealId: params.id }, select: { id: true } })
    const zarizeniIds = zarizeniList.map(z => z.id)

    if (zarizeniIds.length > 0) {
      // Smaz servisni navstevy linked na zarizeni (bez cascade z kontraktu)
      await tx.servisniZakazka.deleteMany({ where: { zarizeniId: { in: zarizeniIds } } })
    }

    // Smaz servisni kontrakty OP (cascade maze jejich navstevy — uz smazane, ok)
    await tx.servisniKontrakt.deleteMany({ where: { dealId: params.id } })

    if (zarizeniIds.length > 0) {
      // Smaz servisni kontrakty linked na zarizeni tohoto OP
      await tx.servisniKontrakt.deleteMany({ where: { zarizeniId: { in: zarizeniIds } } })
      // Smaz zarizeni
      await tx.zarizeni.deleteMany({ where: { dealId: params.id } })
    }

    // Smaz OP (cascade: Quote, QuoteItem, Activity, Photo)
    await tx.deal.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ ok: true })
}
