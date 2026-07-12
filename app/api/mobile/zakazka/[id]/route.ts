import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka, klientAdresa, toAbsoluteUrl } from '@/lib/mobile-helpers'

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

  const zakazka = await orgPrisma(session!.user.orgId).zakazka.findFirst({
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
      kontakty: { orderBy: { vytvoreno: 'asc' } },
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
    titulniFotoUrl: toAbsoluteUrl(zakazka.titulniFotoUrl, origin),
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
      url: toAbsoluteUrl(f.url, origin) as string,
      popis: f.popis ?? null,
      vytvoreno: f.vytvoreno,
      nahral: f.nahral.jmeno,
    })),
    kontakty: zakazka.kontakty.map(k => ({
      id: k.id,
      profese: k.profese,
      jmeno: k.jmeno ?? null,
      telefon: k.telefon ?? null,
      email: k.email ?? null,
      poznamka: k.poznamka ?? null,
      vytvoreno: k.vytvoreno,
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

// PATCH - technik zahájí práci (jediný povolený přechod stavu z mobilu;
// předání řeší podpis předaváku, fakturační stavy zůstávají desktopu)
// a/nebo upraví adresu montáže.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const data: { stav?: 'V_REALIZACI'; mistoStavby?: string | null } = {}

  if (body.stav !== undefined) {
    if (body.stav !== 'V_REALIZACI') {
      return NextResponse.json({ error: 'Nepovolený přechod stavu' }, { status: 422 })
    }
    data.stav = 'V_REALIZACI'
  }

  if (body.mistoStavby !== undefined) {
    if (body.mistoStavby !== null && typeof body.mistoStavby !== 'string') {
      return NextResponse.json({ error: 'Neplatná adresa' }, { status: 422 })
    }
    const val = (body.mistoStavby ?? '').trim()
    if (val.length > 500) {
      return NextResponse.json({ error: 'Adresa je příliš dlouhá' }, { status: 422 })
    }
    data.mistoStavby = val || null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nic ke změně' }, { status: 422 })
  }

  const { orgId } = session!.user
  const db = orgPrisma(orgId)
  const zakazka = await db.zakazka.findFirst({
    where: { id: params.id, orgId },
    select: { id: true, cislo: true, stav: true, vedouciId: true },
  })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (data.stav && zakazka.stav !== 'NOVA' && zakazka.stav !== 'PRIRAZENA') {
    return NextResponse.json({ error: 'Zakázku nelze zahájit v tomto stavu' }, { status: 422 })
  }

  if (!data.stav) {
    // jen adresa — bez notifikace a auditu stavu
    await db.zakazka.update({ where: { id: zakazka.id }, data })
    return NextResponse.json({ ok: true })
  }

  await db.$transaction(async tx => {
    await tx.zakazka.update({
      where: { id: zakazka.id },
      data,
    })

    if (zakazka.vedouciId && zakazka.vedouciId !== session!.user.id) {
      await tx.notification.create({
        data: {
          orgId,
          userId: zakazka.vedouciId,
          typ: 'ZAKAZKA_ZAHAJENA',
          zprava: `Technik zahájil práci na zakázce ${zakazka.cislo}`,
          url: `/zakazky/${zakazka.id}`,
        },
      })
    }

    await tx.auditLog.create({
      data: {
        orgId,
        userId: session!.user.id,
        typAkce: 'UPDATE',
        typZaznamu: 'Zakazka',
        zaznamId: zakazka.id,
        zaznamNazev: zakazka.cislo,
        zmeny: { stavPred: zakazka.stav, stavPo: 'V_REALIZACI' },
      },
    })
  })

  return NextResponse.json({ ok: true, stav: 'V_REALIZACI' })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
