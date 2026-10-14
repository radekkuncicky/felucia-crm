// Montáže (zakázky a jejich etapy) v rozsahu dnů — pro „Obsazenost“ při výběru
// termínu montáže. Stejná pravidla jako kalendář (calendar/page.tsx): zakázka se
// dvěma a více naplánovanými etapami (nebo jedinou etapou bez hlavního termínu)
// se ukazuje po etapách, jinak hlavním termínem zakázky.

import type { OrgPrismaClient } from './orgPrisma'
import { klientJmeno, technologieLabel, utcDateStr } from './calendarEvents'

export interface TechnikMontaze { id: string; jmeno: string }

export interface MontazVRozsahu {
  id: string
  zakazkaId: string
  etapaId: string | null
  cislo: string
  klient: string
  technologie: string
  /** „2. etapa – název“ u etap */
  etapa: string | null
  od: string
  do: string
  hlavniTechnik: TechnikMontaze | null
  /** ostatní technici (bez hlavního) */
  technici: TechnikMontaze[]
  kdykoliv: boolean
  href: string
}

/** od/do = YYYY-MM-DD včetně; termíny jsou UTC půlnoc daného dne */
export async function montazeVRozsahu(
  db: OrgPrismaClient,
  opts: { orgId: string; scope: Record<string, unknown>; od: string; do: string; bezZakazkyId?: string | null },
): Promise<MontazVRozsahu[]> {
  const odD = new Date(`${opts.od}T00:00:00Z`)
  const doExcl = new Date(new Date(`${opts.do}T00:00:00Z`).getTime() + 86_400_000)
  const vRozsahu = {
    montazOd: { lt: doExcl },
    OR: [{ montazDo: { gte: odD } }, { montazDo: null, montazOd: { gte: odD } }],
  }

  const technikSel = { select: { id: true, jmeno: true } }
  const zakazky = await db.zakazka.findMany({
    where: {
      orgId: opts.orgId,
      ...(opts.bezZakazkyId ? { id: { not: opts.bezZakazkyId } } : {}),
      AND: [opts.scope, { OR: [vRozsahu, { etapy: { some: vRozsahu } }] }],
    },
    select: {
      id: true, cislo: true, nazev: true, technologie: true, kdykoliv: true,
      montazOd: true, montazDo: true, hlavniTechnikId: true,
      klient: { select: { jmeno: true, prijmeni: true, typKlienta: true } },
      techniciRel: { orderBy: { prirazeno: 'asc' }, select: { technik: technikSel } },
      etapy: {
        where: { montazOd: { not: null } },
        orderBy: { cislo: 'asc' },
        select: {
          id: true, cislo: true, nazev: true, montazOd: true, montazDo: true, hlavniTechnikId: true,
          technici: { orderBy: { prirazeno: 'asc' }, select: { technik: technikSel } },
        },
      },
    },
  })

  const prekryva = (od: Date, doo: Date | null) =>
    od < doExcl && (doo ? doo >= odD : od >= odD)

  const rozdelit = (technici: TechnikMontaze[], hlavniId: string | null) => {
    const hlavni = technici.find(t => t.id === hlavniId) ?? technici[0] ?? null
    return { hlavniTechnik: hlavni, technici: technici.filter(t => t.id !== hlavni?.id) }
  }

  const vysledek: MontazVRozsahu[] = []
  for (const z of zakazky) {
    const klient = klientJmeno(z.klient) || z.nazev
    const technologie = technologieLabel(z.technologie)
    const techniciZakazky = z.techniciRel.map(t => t.technik)
    const spolecne = { zakazkaId: z.id, cislo: z.cislo, klient, technologie, kdykoliv: z.kdykoliv, href: `/zakazky/${z.id}` }

    if (z.etapy.length >= 2 || (z.etapy.length === 1 && !z.montazOd)) {
      for (const e of z.etapy) {
        if (!prekryva(e.montazOd!, e.montazDo)) continue
        const vlastni = e.technici.map(t => t.technik)
        vysledek.push({
          ...spolecne,
          id: `${z.id}-${e.id}`,
          etapaId: e.id,
          etapa: e.nazev ? `${e.cislo}. etapa – ${e.nazev}` : `${e.cislo}. etapa`,
          od: utcDateStr(e.montazOd!),
          do: utcDateStr(e.montazDo ?? e.montazOd!),
          ...(vlastni.length > 0 ? rozdelit(vlastni, e.hlavniTechnikId) : rozdelit(techniciZakazky, z.hlavniTechnikId)),
        })
      }
      continue
    }
    if (!z.montazOd || !prekryva(z.montazOd, z.montazDo)) continue
    vysledek.push({
      ...spolecne,
      id: z.id,
      etapaId: null,
      etapa: null,
      od: utcDateStr(z.montazOd),
      do: utcDateStr(z.montazDo ?? z.montazOd),
      ...rozdelit(techniciZakazky, z.hlavniTechnikId),
    })
  }

  return vysledek.sort((a, b) => a.od.localeCompare(b.od) || a.klient.localeCompare(b.klient, 'cs'))
}
