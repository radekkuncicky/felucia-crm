import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { Predavak, ZakazkaStav } from '@prisma/client'
import { vratZakazkuZPredane } from '@/lib/zakazkaStavFlow'

type Db = ReturnType<typeof orgPrisma>

async function canAccess(userId: string, role: string, predavakId: string, orgId: string) {
  if (role === 'ADMIN') return true
  const p = await orgPrisma(orgId).predavak.findFirst({ where: { id: predavakId } })
  if (!p) return false
  if (role === 'TECHNIK') return p.technikId === userId
  return true // OBCHODNIK (ADMIN handled above)
}

/**
 * Vrátí protokol do stavu Rozpracován a odčiní všechno, co schválení způsobilo:
 * skladové výdeje protipohybem STORNO, automaticky vzniklé vyúčtování a posun zakázky.
 * Vyúčtování, které už postoupilo dál než do návrhu, reopen blokuje — nejdřív ho musí
 * manažer vrátit k úpravám, ať se nemažou čísla, se kterými se už někde pracovalo.
 */
async function reopenPredavak(db: Db, orgId: string, userId: string, predavak: Predavak) {
  const bylSchvalen = predavak.stav === 'SCHVALEN'

  const vyuctovani = bylSchvalen
    ? await db.vyuctovani.findUnique({
        where: { predavakId: predavak.id },
        select: { id: true, cislo: true, stav: true },
      })
    : null

  if (vyuctovani && vyuctovani.stav !== 'NAVRH') {
    return NextResponse.json({
      error: `Protokol nelze vrátit — vyúčtování ${vyuctovani.cislo} už čeká na schválení nebo je schválené. Nejdřív ho vraťte k úpravám.`,
    }, { status: 422 })
  }

  let zakazkaNovyStav: ZakazkaStav | null = null

  await db.$transaction(async tx => {
    await tx.predavak.update({
      where: { id: predavak.id },
      data: {
        stav: 'ROZPRACOVAN',
        schvaleno: null,
        schvalenoId: null,
        podpisano: null,
        upravenoPodpisano: false,
      },
    })

    if (bylSchvalen) {
      // Schválení vydalo položky ze skladu — vrať je protipohybem, aby zůstala stopa v pohybech
      const polozky = await tx.predavakPolozka.findMany({
        where: { predavakId: predavak.id, zahrnuto: true, zakazkaPolozkaId: { not: null } },
        include: { zakazkaPolozka: true },
      })
      for (const p of polozky) {
        if (!p.zakazkaPolozkaId || p.zakazkaPolozka?.stav !== 'VYDANO') continue
        await tx.zakazkaPolozka.update({
          where: { id: p.zakazkaPolozkaId },
          data: { stav: 'NASKLADNENO' },
        })
        await tx.skladPohyb.create({
          data: {
            orgId,
            zakazkaId: predavak.zakazkaId,
            polozkaId: p.zakazkaPolozkaId,
            typ: 'STORNO',
            nazev: p.nazev,
            mnozstvi: p.mnozstviPouzito,
            nakupniCena: p.zakazkaPolozka?.nakupniCena ?? undefined,
            duvod: `Vrácení protokolu ${predavak.cislo} k úpravám`,
            vytvorilId: userId,
          },
        })
      }

      // Návrh vyúčtování vznikl schválením — po znovuschválení se založí s aktuálními položkami
      if (vyuctovani) {
        await tx.vyuctovani.delete({ where: { id: vyuctovani.id } })
      }
    }

    zakazkaNovyStav = await vratZakazkuZPredane(tx, predavak.zakazkaId, predavak.id)

    await tx.auditLog.create({
      data: {
        orgId,
        userId,
        typAkce: 'UPDATE',
        typZaznamu: 'Predavak',
        zaznamId: predavak.id,
        zaznamNazev: predavak.cislo,
        zmeny: {
          stavPred: predavak.stav,
          stavPo: 'ROZPRACOVAN',
          smazanoVyuctovani: vyuctovani?.cislo ?? null,
          zakazkaNovyStav,
        },
      },
    })
  })

  const updated = await db.predavak.findFirst({ where: { id: predavak.id } })
  return NextResponse.json({ ...updated, zakazkaNovyStav })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!(await canAccess(session.user.id, session.user.role, params.id, orgId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const predavak = await db.predavak.findFirst({
    where: { id: params.id, orgId },
    include: {
      technik: { select: { id: true, jmeno: true, email: true, telefon: true } },
      schvalil: { select: { id: true, jmeno: true } },
      zakazka: {
        include: {
          klient: { select: { id: true, jmeno: true, prijmeni: true, telefon: true } },
          vedouci: { select: { id: true, jmeno: true } },
        },
      },
      polozky: { orderBy: { id: 'asc' } },
      fotky: { orderBy: { vytvoreno: 'asc' } },
    },
  })

  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(predavak)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const isManager = session.user.role === 'ADMIN' || session.user.role === 'OBCHODNIK'

  const predavak = await db.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role === 'TECHNIK' && predavak.technikId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Vrácení protokolu k úpravám (manažer) — kompletní rollback schválení, ne jen přepnutí stavu
  if (body.reopen) {
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return reopenPredavak(db, orgId, session.user.id, predavak)
  }

  // Přiřazení k etapě — čistě organizační přeřazení, nemění položky ani sklad,
  // proto ho lze udělat i na už schváleném protokolu (na rozdíl od úprav níže).
  if ('etapaId' in body) {
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { etapaId } = body
    if (etapaId !== null && typeof etapaId !== 'string') {
      return NextResponse.json({ error: 'Neplatná etapa' }, { status: 400 })
    }
    if (etapaId) {
      const etapa = await db.zakazkaEtapa.findFirst({ where: { id: etapaId, zakazkaId: predavak.zakazkaId, orgId } })
      if (!etapa) return NextResponse.json({ error: 'Etapa nenalezena' }, { status: 404 })
    }
    const updated = await db.predavak.update({
      where: { id: params.id },
      data: { etapaId },
      include: { polozky: { orderBy: { id: 'asc' } }, fotky: true },
    })
    return NextResponse.json(updated)
  }

  if (predavak.stav === 'SCHVALEN') {
    return NextResponse.json({ error: 'Nelze editovat schválený protokol' }, { status: 422 })
  }

  const { poznamka, klientPritomen, podpisSvg, polozky } = body

  const editingSubmitted = predavak.stav === 'PODPISAN'

  await db.$transaction(async tx => {
    await tx.predavak.update({
      where: { id: params.id },
      data: {
        poznamka: poznamka ?? undefined,
        klientPritomen: klientPritomen ?? undefined,
        podpisSvg: podpisSvg ?? undefined,
        ...(editingSubmitted ? { upravenoPodpisano: true } : {}),
      },
    })

    if (polozky && Array.isArray(polozky)) {
      for (const p of polozky) {
        await tx.predavakPolozka.update({
          where: { id: p.id, predavakId: params.id },
          data: {
            mnozstviPouzito: p.mnozstviPouzito ?? 0,
            zahrnuto: p.zahrnuto ?? true,
            poznamka: p.poznamka ?? null,
          },
        })
      }
    }
  })

  const updated = await db.predavak.findFirst({
    where: { id: params.id },
    include: { polozky: { orderBy: { id: 'asc' } }, fotky: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = session.user.role === 'ADMIN' || session.user.role === 'OBCHODNIK'
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const predavak = await db.predavak.findFirst({ where: { id: params.id, orgId } })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Schválený protokol drží skladové výdeje a vyúčtování — smazáním by po nich zůstaly sirotci
  if (predavak.stav === 'SCHVALEN') {
    return NextResponse.json({
      error: 'Schválený protokol nelze smazat. Nejdřív ho vraťte k úpravám.',
    }, { status: 422 })
  }

  await db.$transaction(async tx => {
    await tx.predavak.delete({ where: { id: params.id } })

    // Podpis mohl zakázku posunout na PREDANA — po smazání ji nemá co držet
    const zakazkaNovyStav = await vratZakazkuZPredane(tx, predavak.zakazkaId, predavak.id)

    await tx.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'DELETE',
        typZaznamu: 'Predavak',
        zaznamId: params.id,
        zaznamNazev: predavak.cislo,
        zmeny: { stavPred: predavak.stav, zakazkaNovyStav },
      },
    })
  })

  return NextResponse.json({ ok: true })
}
