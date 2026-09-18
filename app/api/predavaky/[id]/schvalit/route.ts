import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateVyuctovaniCislo } from '@/lib/zakazkyHelpers'
import { getPerms, forbidden } from '@/lib/permissions'
import { zkontrolujMinimum } from '@/lib/sklad'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!getPerms(session.user).zakazkySchvalovani) return forbidden()

  const predavak = await db.predavak.findFirst({
    where: { id: params.id, orgId },
    include: {
      polozky: { include: { zakazkaPolozka: true } },
      zakazka: { include: { vedouci: true } },
    },
  })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Idempotent: už schválený protokol → úspěch bez no-op (poražený v souběhu dvou kliků sem spadne)
  if (predavak.stav === 'SCHVALEN') {
    const existujici = await db.vyuctovani.findUnique({
      where: { predavakId: predavak.id },
      select: { id: true, cislo: true },
    })
    return NextResponse.json({
      ok: true,
      alreadyApproved: true,
      vyuctovaniId: existujici?.id ?? null,
      vyuctovaniCislo: existujici?.cislo ?? null,
    })
  }
  if (predavak.stav !== 'PODPISAN') {
    return NextResponse.json({ error: 'Protokol musí být podepsán před schválením' }, { status: 422 })
  }

  const zahrnutePolozky = predavak.polozky.filter(p => p.zahrnuto)
  const noveCislo = await generateVyuctovaniCislo(orgId)

  let raced = false
  let vyuctovaniId: string | null = null
  let vyuctovaniCislo: string | null = null

  await db.$transaction(async tx => {
    // Concurrency guard: jen request, který skutečně překlopí PODPISAN→SCHVALEN, pokračuje.
    // Druhý souběžný request dostane count===0 a transakci přeskočí (žádné dvojí vyúčtování / dvojí výdej).
    const flip = await tx.predavak.updateMany({
      where: { id: params.id, stav: 'PODPISAN' },
      data: {
        stav: 'SCHVALEN',
        schvaleno: new Date(),
        schvalenoId: session.user.id,
      },
    })
    if (flip.count !== 1) {
      raced = true
      return
    }

    // Process warehouse movements for each included item
    for (const polozka of zahrnutePolozky) {
      if (polozka.zakazkaPolozkaId && polozka.zakazkaPolozka) {
        // Update mnozstviPouzito
        await tx.zakazkaPolozka.update({
          where: { id: polozka.zakazkaPolozkaId },
          data: {
            mnozstviPouzito: Number(polozka.mnozstviPouzito),
            stav: polozka.zakazkaPolozka.stav === 'NASKLADNENO' ? 'VYDANO' : undefined,
          },
        })

        // Create VYDEJ sklad pohyb if was naskladneno
        if (polozka.zakazkaPolozka.stav === 'NASKLADNENO') {
          await tx.skladPohyb.create({
            data: {
              orgId,
              zakazkaId: predavak.zakazkaId,
              polozkaId: polozka.zakazkaPolozkaId,
              productId: polozka.zakazkaPolozka.productId,
              typ: 'VYDEJ',
              nazev: polozka.nazev,
              mnozstvi: polozka.mnozstviPouzito,
              nakupniCena: polozka.zakazkaPolozka.nakupniCena ?? undefined,
              vytvorilId: session.user.id,
            },
          })
        }
      }
    }

    // Vyúčtování z tohoto protokolu už může existovat (schválení po „Vrátit k úpravám") — nezakládat duplicitu
    const existujici = await tx.vyuctovani.findUnique({
      where: { predavakId: predavak.id },
      select: { id: true, cislo: true },
    })
    const vyuctovani = existujici ?? await tx.vyuctovani.create({
      data: {
        orgId,
        zakazkaId: predavak.zakazkaId,
        cislo: noveCislo,
        stav: 'NAVRH',
        etapaId: predavak.etapaId ?? null,
        predavakId: predavak.id,
        polozky: {
          create: zahrnutePolozky.map((p, idx) => ({
            nazev: p.nazev,
            mnozstvi: p.mnozstviPouzito,
            jednotka: p.jednotka,
            prodejniCena: p.zakazkaPolozka?.prodejniCena ?? 0,
            nakupniCena: p.zakazkaPolozka?.nakupniCena ?? undefined,
            dphSazba: p.zakazkaPolozka?.dphSazba ?? 21,
            poradi: idx,
          })),
        },
      },
      select: { id: true, cislo: true },
    })

    vyuctovaniId = vyuctovani.id
    vyuctovaniCislo = vyuctovani.cislo

    // Audit log — záznam o akci, zůstává awaitovaný v transakci
    await tx.auditLog.create({
      data: {
        orgId,
        userId: session.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Predavak',
        zaznamId: params.id,
        zaznamNazev: predavak.cislo,
        zmeny: { stavPred: 'PODPISAN', stavPo: 'SCHVALEN', vyuctovaniId: vyuctovani.id },
      },
    })
  })

  // Souběh: jiný request už protokol schválil — vrať idempotentní úspěch, nic dalšího nedělej
  if (raced) {
    return NextResponse.json({ ok: true, alreadyApproved: true })
  }

  // Notifikace fire-and-forget — response se vrátí hned po commitu, ztráta notifikace neshodí schválení.
  // Aktérovi akce se notifikace neposílá (schvaluje-li vedoucí vlastní protokol, nemá si co oznamovat).
  void (async () => {
    const vedouciId = predavak.zakazka.vedouciId
    if (vedouciId && vedouciId !== session.user.id) {
      await db.notification.create({
        data: {
          orgId,
          userId: vedouciId,
          typ: 'VYUCTOVANI_PRIPRAVENO',
          zprava: `Vyúčtování ${vyuctovaniCislo} je připraveno ke kontrole`,
          url: `/zakazky/${predavak.zakazkaId}?tab=vyuctovani`,
        },
      })
    }
    if (predavak.technikId !== session.user.id) {
      await db.notification.create({
        data: {
          orgId,
          userId: predavak.technikId,
          typ: 'PREDAVAK_SCHVALEN',
          zprava: `Protokol ${predavak.cislo} byl schválen`,
          url: `/zakazky/${predavak.zakazkaId}/predavaky/${predavak.id}`,
        },
      })
    }
    // Sklad v2: výdej mohl srazit zásobu pod minimum produktu
    const vydaneProdukty = new Set(
      zahrnutePolozky.map(p => p.zakazkaPolozka?.productId).filter((id): id is string => !!id),
    )
    for (const productId of Array.from(vydaneProdukty)) await zkontrolujMinimum(orgId, productId)
  })().catch(() => {})

  return NextResponse.json({ ok: true, vyuctovaniId, vyuctovaniCislo })
}
