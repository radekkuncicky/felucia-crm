import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka, klientAdresa } from '@/lib/mobile-helpers'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await prisma.zakazka.findFirst({
    where: { id: params.id, orgId: session!.user.orgId },
    include: {
      klient: true,
      vedouci: { select: { id: true, jmeno: true, telefon: true } },
      techniciRel: { include: { technik: { select: { id: true, jmeno: true, telefon: true } } } },
      polozky: {
        select: {
          id: true,
          nazev: true,
          kod: true,
          mnozstvi: true,
          jednotka: true,
          stav: true,
          hotovo: true,
          poradi: true,
          poznamka: true,
          // ceny záměrně vynechány
        },
        orderBy: { poradi: 'asc' },
      },
      komentare: {
        include: { user: { select: { id: true, jmeno: true, role: true } } },
        orderBy: { vytvoreno: 'asc' },
      },
      fotky: {
        include: { nahral: { select: { id: true, jmeno: true } } },
        orderBy: { vytvoreno: 'desc' },
      },
      predavaky: {
        select: { id: true, cislo: true, stav: true, podpisano: true, vytvoreno: true },
        orderBy: { vytvoreno: 'desc' },
        take: 1,
      },
    },
  })

  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: zakazka.id,
    cislo: zakazka.cislo,
    nazev: zakazka.nazev,
    stav: zakazka.stav,
    typ: zakazka.typ,
    technologie: zakazka.technologie,
    mistoStavby: zakazka.mistoStavby ?? null,
    montazOd: zakazka.montazOd,
    montazDo: zakazka.montazDo,
    poznamka: zakazka.poznamka,
    vytvoreno: zakazka.vytvoreno,
    klient: {
      id: zakazka.klient.id,
      jmeno: zakazka.klient.jmeno,
      prijmeni: zakazka.klient.prijmeni,
      telefon: zakazka.klient.telefon ?? null,
      email: zakazka.klient.email ?? null,
      adresa: klientAdresa(zakazka.klient),
    },
    vedouci: zakazka.vedouci
      ? { id: zakazka.vedouci.id, jmeno: zakazka.vedouci.jmeno, telefon: zakazka.vedouci.telefon ?? null }
      : null,
    technici: zakazka.techniciRel.map(t => ({
      id: t.technik.id,
      jmeno: t.technik.jmeno,
      telefon: t.technik.telefon ?? null,
    })),
    polozky: zakazka.polozky.map(p => ({
      id: p.id,
      nazev: p.nazev,
      kod: p.kod ?? null,
      mnozstvi: Number(p.mnozstvi),
      jednotka: p.jednotka,
      stav: p.stav,
      hotovo: p.hotovo,
      poznamka: p.poznamka ?? null,
    })),
    komentare: zakazka.komentare.map(k => ({
      id: k.id,
      text: k.text,
      vytvoreno: k.vytvoreno,
      autor: { id: k.user.id, jmeno: k.user.jmeno, role: k.user.role },
    })),
    fotky: zakazka.fotky.map(f => ({
      id: f.id,
      url: f.url.startsWith('http') ? f.url : `${origin}${f.url}`,
      popis: f.popis ?? null,
      vytvoreno: f.vytvoreno,
      nahral: f.nahral.jmeno,
    })),
    predavak: zakazka.predavaky[0]
      ? {
          id: zakazka.predavaky[0].id,
          cislo: zakazka.predavaky[0].cislo,
          stav: zakazka.predavaky[0].stav,
          podpisan: !!zakazka.predavaky[0].podpisano,
          vytvoreno: zakazka.predavaky[0].vytvoreno,
        }
      : null,
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
