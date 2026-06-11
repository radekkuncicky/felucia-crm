import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateVyuctovaniCislo } from '@/lib/zakazkyHelpers'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const role = session.user.role

  if (role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const predavak = await db.predavak.findFirst({
    where: { id: params.id, orgId },
    include: {
      polozky: { include: { zakazkaPolozka: true } },
      zakazka: { include: { vedouci: true } },
    },
  })
  if (!predavak) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (predavak.stav !== 'PODPISAN') {
    return NextResponse.json({ error: 'Protokol musí být podepsán před schválením' }, { status: 422 })
  }

  const zahrnutePolozky = predavak.polozky.filter(p => p.zahrnuto)
  const vyuctovaniCislo = await generateVyuctovaniCislo(orgId)

  await db.$transaction(async tx => {
    // Approve predavak
    await tx.predavak.update({
      where: { id: params.id },
      data: {
        stav: 'SCHVALEN',
        schvaleno: new Date(),
        schvalenoId: session.user.id,
      },
    })

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

    // Create Vyuctovani with items
    const vyuctovani = await tx.vyuctovani.create({
      data: {
        orgId,
        zakazkaId: predavak.zakazkaId,
        cislo: vyuctovaniCislo,
        stav: 'NAVRH',
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
    })

    // Notify vedouci about vyuctovani
    const vedouciId = predavak.zakazka.vedouciId
    if (vedouciId) {
      await tx.notification.create({
        data: {
          orgId,
          userId: vedouciId,
          typ: 'VYUCTOVANI_PRIPRAVENO',
          zprava: `Vyúčtování ${vyuctovaniCislo} je připraveno ke kontrole`,
          url: `/zakazky/${predavak.zakazkaId}?tab=vyuctovani`,
        },
      })
    }

    // Notify technik
    await tx.notification.create({
      data: {
        orgId,
        userId: predavak.technikId,
        typ: 'PREDAVAK_SCHVALEN',
        zprava: `Protokol ${predavak.cislo} byl schválen`,
        url: `/zakazky/${predavak.zakazkaId}/predavaky/${predavak.id}`,
      },
    })

    // Audit log
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

  return NextResponse.json({ ok: true })
}
