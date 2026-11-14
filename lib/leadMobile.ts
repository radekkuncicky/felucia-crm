import type { Lead } from '@prisma/client'
import { leadPredmet, sluzbaToTechnologie } from '@/lib/leadService'

/** Tvar leadu pro Felucia Sales (seznam i hlavička detailu). */
export function leadProAppku(
  l: Lead & { assignedTo?: { id: string; jmeno: string } | null; zdrojPoptavky?: { nazev: string } | null },
) {
  return {
    id: l.id,
    jmeno: l.jmeno,
    firma: l.firma,
    telefon: l.telefon,
    email: l.email,
    status: l.status,
    zdroj: l.zdroj,
    zdrojPoptavky: l.zdrojPoptavky?.nazev ?? null,
    zprava: l.zprava,
    sluzba: l.sluzba,
    // návrh pro „Převést na OP“
    navrhPredmet: leadPredmet(l),
    navrhTechnologie: sluzbaToTechnologie(l.sluzba),
    odhadovanaHodnota: l.odhadovanaHodnota != null ? Number(l.odhadovanaHodnota) : null,
    prirazen: l.assignedTo ? { id: l.assignedTo.id, jmeno: l.assignedTo.jmeno } : null,
    duvodZruseni: l.duvodZruseni,
    prevedenNaOpId: l.prevedenNaOpId,
    vytvoreno: l.vytvoreno,
  }
}
