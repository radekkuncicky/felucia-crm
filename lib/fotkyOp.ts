import type { OrgPrismaClient } from './orgPrisma'
import { TITULNI_STITEK } from './fotoStitky'
import { toAbsoluteUrl } from './mobile-helpers'

/**
 * Galerie OP = fotky k OP (Photo) + fotky ze zaměření (ZamereniFoto).
 * ZamereniFoto zůstává samostatně (anotace, pořadí, povinné tagy pro
 * uzavření zaměření), v galerii OP se jen čte sjednoceně — bez migrace dat.
 */
export interface FotkaOp {
  id: string
  /** relativní `/uploads/…` (nebo data: URI u starých webových fotek) */
  url: string
  zdroj: 'PRIPAD' | 'ZAMERENI'
  zamereniId: string | null
  tag: string | null
  popis: string | null
  gpsLat: number | null
  gpsLng: number | null
  autor: string | null
  vytvoreno: Date
}

export async function nactiFotkyOp(db: OrgPrismaClient, dealId: string): Promise<FotkaOp[]> {
  const [fotky, zamereniFotky] = await Promise.all([
    db.photo.findMany({ where: { dealId }, orderBy: { vytvoreno: 'desc' } }),
    db.zamereniFoto.findMany({
      where: { zamereni: { dealId } },
      orderBy: [{ vytvoreno: 'desc' }],
      include: { zamereni: { select: { autor: { select: { jmeno: true } } } } },
    }),
  ])
  const autorIds = Array.from(new Set(fotky.map(f => f.autorId).filter((x): x is string => !!x)))
  const autori = autorIds.length
    ? await db.user.findMany({ where: { id: { in: autorIds } }, select: { id: true, jmeno: true } })
    : []
  const jmeno = new Map(autori.map(a => [a.id, a.jmeno]))

  const out: FotkaOp[] = [
    ...fotky.map(f => ({
      id: f.id,
      url: f.cesta,
      zdroj: 'PRIPAD' as const,
      zamereniId: null,
      tag: f.tag,
      popis: f.popis,
      gpsLat: f.gpsLat,
      gpsLng: f.gpsLng,
      autor: f.autorId ? jmeno.get(f.autorId) ?? null : null,
      vytvoreno: f.vytvoreno,
    })),
    ...zamereniFotky.map(f => ({
      id: f.id,
      url: f.url,
      zdroj: 'ZAMERENI' as const,
      zamereniId: f.zamereniId,
      tag: f.tag,
      popis: f.popis,
      gpsLat: f.gpsLat,
      gpsLng: f.gpsLng,
      autor: f.zamereni.autor?.jmeno ?? null,
      vytvoreno: f.vytvoreno,
    })),
  ]
  return out.sort((a, b) => b.vytvoreno.getTime() - a.vytvoreno.getTime())
}

/** Titulní fotka: nejnovější „Dům zvenku“, jinak nejnovější fotka k OP, jinak cokoli */
export function vyberTitulniFoto(fotky: FotkaOp[]): FotkaOp | null {
  return fotky.find(f => f.tag === TITULNI_STITEK)
    ?? fotky.find(f => f.zdroj === 'PRIPAD')
    ?? fotky[0]
    ?? null
}

/** Origin požadavku (za nginxem host + x-forwarded-proto) */
export function originZ(req: Request): string {
  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : new URL(req.url).origin
}

/** Fotka pro appku — podepsaná absolutní URL (RN Image nemá cookie) */
export function fotkaProAppku(f: FotkaOp, origin: string) {
  return {
    id: f.id,
    url: toAbsoluteUrl(f.url, origin),
    zdroj: f.zdroj,
    zamereniId: f.zamereniId,
    tag: f.tag,
    popis: f.popis,
    gpsLat: f.gpsLat,
    gpsLng: f.gpsLng,
    autor: f.autor,
    vytvoreno: f.vytvoreno,
  }
}

