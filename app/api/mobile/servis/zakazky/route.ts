import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPlanLimits } from '@/lib/planLimits'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'

const AKTIVNI_STAVY = ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'CEKA'] as const

// GET /api/mobile/servis/zakazky - aktivní servisní zakázky technika
// (ADMIN vidí všechny v org, technik jen své). ?vse=1 vrátí i uzavřené.
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr
  if (!getPlanLimits(session!.user.plan).hasServiceModule) {
    return NextResponse.json({ error: 'Servisní modul není v plánu' }, { status: 403 })
  }

  const { orgId, id: userId, role } = session!.user
  const vse = new URL(req.url).searchParams.get('vse') === '1'

  const zakazky = await orgPrisma(orgId).servisniZakazka.findMany({
    where: {
      orgId,
      ...(role === 'TECHNIK' ? { technikId: userId } : {}),
      ...(vse ? {} : { stav: { in: [...AKTIVNI_STAVY] as never } }),
    },
    include: {
      kontrakt: { select: { nazev: true, klient: { select: { jmeno: true, prijmeni: true } } } },
      klient: { select: { jmeno: true, prijmeni: true } },
      zarizeni: { select: { nazev: true, typ: true } },
      technik: { select: { id: true, jmeno: true } },
    },
    orderBy: [{ planovanyTermin: 'asc' }, { vytvoreno: 'desc' }],
  })

  return NextResponse.json(
    zakazky.map(z => {
      const klient = z.kontrakt?.klient ?? z.klient
      return {
        id: z.id,
        cislo: z.cislo,
        typ: z.typ,
        stav: z.stav,
        planovanyTermin: z.planovanyTermin,
        klient: klient ? `${klient.jmeno} ${klient.prijmeni}` : null,
        zarizeni: z.zarizeni?.nazev ?? null,
        technik: z.technik ? { id: z.technik.id, jmeno: z.technik.jmeno } : null,
        protokolDokoncen: z.protokolDokoncen,
      }
    }),
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
