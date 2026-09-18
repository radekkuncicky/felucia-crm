import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { OBJEDNAVKA_INCLUDE, serializeObjednavka } from '@/lib/objednavky'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'

async function loadObjednavka(session: { user: { id: string; orgId: string } & Record<string, unknown> }, id: string) {
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const o = await db.objednavka.findFirst({ where: { id, orgId }, include: OBJEDNAVKA_INCLUDE })
  if (!o) return { o: null, db }
  if (o.zakazkaId && !(await canAccessZakazka(session.user, getPerms(session.user as never), o.zakazkaId))) return { o: null, db }
  return { o, db }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') return forbidden()
  const { o } = await loadObjednavka(session, params.id)
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(serializeObjednavka(o, perms.financeNakupky))
}

/**
 * Úpravy: v NAVRH položky/množství/termín/poznámka/zobrazitCeny;
 * stav → ODESLANA (ručně „označit jako odeslanou") nebo ZRUSENA (položky zakázky bez dodávky zpět na CEKA).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad !== 'PLNY') return forbidden()
  const { o, db } = await loadObjednavka(session, params.id)
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const orgId = session.user.orgId
  const body = await req.json().catch(() => ({}))

  if (body.stav === 'ZRUSENA') {
    if (o.stav === 'DORUCENA' || o.stav === 'CASTECNE_DORUCENA') {
      return NextResponse.json({ error: 'Objednávku s přijatou dodávkou nelze zrušit' }, { status: 422 })
    }
    await db.$transaction(async tx => {
      await tx.objednavka.update({ where: { id: o.id }, data: { stav: 'ZRUSENA' } })
      const ids = o.polozky.map(p => p.zakazkaPolozkaId).filter((x): x is string => !!x)
      if (ids.length) {
        // Zpět na Čeká jen ty, které nejsou v jiné otevřené objednávce
        const jinde = await tx.objednavkaPolozka.findMany({
          where: { zakazkaPolozkaId: { in: ids }, objednavkaId: { not: o.id }, objednavka: { stav: { in: ['NAVRH', 'ODESLANA', 'CASTECNE_DORUCENA'] } } },
          select: { zakazkaPolozkaId: true },
        })
        const drz = new Set(jinde.map(j => j.zakazkaPolozkaId))
        await tx.zakazkaPolozka.updateMany({
          where: { id: { in: ids.filter(id => !drz.has(id)) }, stav: 'OBJEDNANO' },
          data: { stav: 'CEKA' },
        })
      }
      await tx.auditLog.create({
        data: { orgId, userId: session.user.id, typAkce: 'UPDATE', typZaznamu: 'Objednavka', zaznamId: o.id, zaznamNazev: o.cislo, zmeny: { stav: 'ZRUSENA', duvod: body.duvod ?? null } },
      })
    })
  } else if (body.stav === 'ODESLANA') {
    if (o.stav !== 'NAVRH') return NextResponse.json({ error: 'Jen návrh lze označit jako odeslaný' }, { status: 422 })
    await db.objednavka.update({ where: { id: o.id }, data: { stav: 'ODESLANA', odeslano: new Date() } })
  } else if (body.stav !== undefined) {
    return NextResponse.json({ error: 'Nepodporovaná změna stavu' }, { status: 400 })
  }

  // Ostatní úpravy jen v návrhu (po odeslání dodavateli se obsah nemění)
  const data: Record<string, unknown> = {}
  if ('zobrazitCeny' in body) data.zobrazitCeny = !!body.zobrazitCeny
  if ('poznamka' in body) data.poznamka = typeof body.poznamka === 'string' && body.poznamka.trim() ? body.poznamka.trim() : null
  if ('pozadovanyTermin' in body) data.pozadovanyTermin = body.pozadovanyTermin ? new Date(body.pozadovanyTermin) : null
  const meniObsah = Array.isArray(body.polozky)
  if ((Object.keys(data).length || meniObsah) && o.stav !== 'NAVRH' && !(body.stav === 'ODESLANA')) {
    if (meniObsah || 'pozadovanyTermin' in data) return NextResponse.json({ error: 'Obsah lze měnit jen u návrhu' }, { status: 422 })
  }
  if (Object.keys(data).length || meniObsah) {
    await db.$transaction(async tx => {
      if (Object.keys(data).length) await tx.objednavka.update({ where: { id: o.id }, data })
      if (meniObsah) {
        for (const p of body.polozky as { id: string; mnozstvi?: number; objednaciKod?: string | null; nakupniCena?: number | null; smazat?: boolean }[]) {
          const existing = o.polozky.find(x => x.id === p.id)
          if (!existing) continue
          if (p.smazat) { await tx.objednavkaPolozka.delete({ where: { id: p.id } }); continue }
          await tx.objednavkaPolozka.update({
            where: { id: p.id },
            data: {
              ...(p.mnozstvi !== undefined && Number(p.mnozstvi) > 0 ? { mnozstvi: Number(p.mnozstvi) } : {}),
              ...(p.objednaciKod !== undefined ? { objednaciKod: p.objednaciKod?.trim() || null } : {}),
              ...(p.nakupniCena !== undefined && perms.financeNakupkyEdit ? { nakupniCena: p.nakupniCena === null ? null : Number(p.nakupniCena) } : {}),
            },
          })
        }
      }
    })
  }

  const fresh = await db.objednavka.findFirst({ where: { id: o.id, orgId }, include: OBJEDNAVKA_INCLUDE })
  return NextResponse.json(serializeObjednavka(fresh!, perms.financeNakupky))
}

/** Smazání jen návrhu bez dodávky; položky zakázky zpět na Čeká. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getPerms(session.user).sklad !== 'PLNY') return forbidden()
  const { o, db } = await loadObjednavka(session, params.id)
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (o.stav !== 'NAVRH') return NextResponse.json({ error: 'Smazat lze jen návrh — jinak objednávku zrušte' }, { status: 422 })
  await db.$transaction(async tx => {
    const ids = o.polozky.map(p => p.zakazkaPolozkaId).filter((x): x is string => !!x)
    await tx.objednavka.delete({ where: { id: o.id } })
    if (ids.length) await tx.zakazkaPolozka.updateMany({ where: { id: { in: ids }, stav: 'OBJEDNANO' }, data: { stav: 'CEKA' } })
  })
  return NextResponse.json({ ok: true })
}
