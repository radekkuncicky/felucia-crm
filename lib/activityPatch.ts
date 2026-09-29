import type { Activity } from '@prisma/client'
import type { OrgPrismaClient } from '@/lib/orgPrisma'
import { followUpData, parseFollowUp, parseTyp, typPovolen } from '@/lib/activities'

/**
 * Společná úprava aktivity pro PATCH /api/activities/[id] i /api/deals/[id]/activities/[actId].
 * Patch-style (nepřítomné pole = beze změny). Volitelné `followUp: { typ, datum, popis }`
 * při dokončení založí v téže transakci navazující aktivitu na stejném rodiči.
 * Vrací aktualizovanou aktivitu rozšířenou o `followUp` (nebo null).
 */
export async function patchActivity(
  db: OrgPrismaClient,
  orgId: string,
  userId: string,
  activity: Activity,
  body: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  // Backward compat: splneno=true → stav=DOKONCENA
  let stav = (body.stav as Activity['stav'] | undefined) ?? activity.stav
  if (body.splneno === true && !body.stav) stav = 'DOKONCENA'
  if (body.splneno === false && !body.stav) stav = 'PLANOVANA'
  const splneno = stav === 'DOKONCENA'

  let typ = activity.typ
  if (body.typ) {
    const t = parseTyp(body.typ)
    if (!t) return { status: 400, json: { error: 'Neplatný typ aktivity' } }
    if (!typPovolen(t, activity)) return { status: 400, json: { error: 'U leadu lze plánovat jen hovor nebo e-mail' } }
    typ = t
  }

  const followUp = parseFollowUp(body.followUp, activity)
  if (typeof followUp === 'string') return { status: 400, json: { error: followUp } }
  if (followUp && stav !== 'DOKONCENA') {
    return { status: 400, json: { error: 'Navazující aktivitu lze naplánovat jen při dokončení' } }
  }

  // Validate resitelId belongs to same org
  if (body.resitelId !== undefined && body.resitelId !== null) {
    const resitel = await db.user.findFirst({ where: { id: body.resitelId as string, orgId } })
    if (!resitel) return { status: 400, json: { error: 'Řešitel nebyl nalezen' } }
  }

  const s = (v: unknown) => (v as string) || null
  const [updated, created] = await db.$transaction(async (tx) => {
    const updated = await tx.activity.update({
      where: { id: activity.id },
      data: {
        stav,
        splneno,
        typ,
        datum: body.datum ? new Date(body.datum as string) : activity.datum,
        cas: body.cas !== undefined ? s(body.cas) : activity.cas,
        trvaniMin: body.trvaniMin !== undefined ? (body.trvaniMin != null ? Number(body.trvaniMin) : null) : activity.trvaniMin,
        popis: body.popis !== undefined ? s(body.popis) : activity.popis,
        cil: body.cil !== undefined ? s(body.cil) : activity.cil,
        vysledek: body.vysledek !== undefined ? s(body.vysledek) : activity.vysledek,
        misto: body.misto !== undefined ? s(body.misto) : activity.misto,
        resitelId: body.resitelId !== undefined ? s(body.resitelId) : activity.resitelId,
        reminderAt: body.reminderAt !== undefined ? (body.reminderAt ? new Date(body.reminderAt as string) : null) : activity.reminderAt,
      },
      include: { user: { select: { jmeno: true } }, resitel: { select: { jmeno: true } } },
    })
    const created = followUp
      ? await tx.activity.create({
          data: followUpData(activity, followUp, userId),
          include: { user: { select: { jmeno: true } }, resitel: { select: { jmeno: true } } },
        })
      : null
    return [updated, created] as const
  })

  return { status: 200, json: { ...updated, followUp: created } }
}
