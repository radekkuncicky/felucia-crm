import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PolozkyTab from './PolozkyTab'
import TechniciTab from './TechniciTab'
import PredavakyTab from './PredavakyTab'
import HistorieTab from './HistorieTab'
import FotoTab from './FotoTab'
import VyuctovaniTab from './VyuctovaniTab'
import PodkladyTab from './PodkladyTab'
import KontaktyTab from './KontaktyTab'

export default async function ZakazkaDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const orgId = session.user.orgId
  const role = session.user.role
  const isTechnik = role === 'TECHNIK'
  const canEdit = role === 'ADMIN' || role === 'OBCHODNIK'
  const tab = searchParams.tab ?? 'polozky'

  const [zakazka, vsichniTechnici, komentare, auditLogs] = await Promise.all([
    prisma.zakazka.findFirst({
      where: { id: params.id, orgId },
      include: {
        klient: true,
        vedouci: { select: { id: true, jmeno: true, email: true } },
        op: { select: { id: true, kod: true, predmet: true } },
        techniciRel: {
          include: { technik: { select: { id: true, jmeno: true, email: true, telefon: true } } },
          orderBy: { prirazeno: 'asc' },
        },
        polozky: { orderBy: { poradi: 'asc' } },
        predavaky: {
          orderBy: { vytvoreno: 'desc' },
          include: { technik: { select: { id: true, jmeno: true } } },
        },
        vyuctovani: { orderBy: { vytvoreno: 'desc' } },
        etapy: { orderBy: { cislo: 'asc' as const }, select: { id: true, cislo: true, nazev: true, stav: true } },
        fotky: {
          orderBy: { vytvoreno: 'desc' },
          include: { nahral: { select: { id: true, jmeno: true } } },
        },
        dokumenty: {
          orderBy: { vytvoreno: 'desc' },
          include: { nahral: { select: { id: true, jmeno: true } } },
        },
        kontakty: { orderBy: { vytvoreno: 'asc' } },
      },
    }),
    isTechnik
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { orgId, aktivni: true, role: 'TECHNIK' },
          select: { id: true, jmeno: true, email: true },
          orderBy: { jmeno: 'asc' },
        }),
    prisma.zakazkaKomentar.findMany({
      where: { zakazkaId: params.id },
      include: { user: { select: { id: true, jmeno: true, role: true } } },
      orderBy: { vytvoreno: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { zaznamId: params.id },
      include: { user: { select: { jmeno: true } } },
      orderBy: { vytvoreno: 'desc' },
      take: 50,
    }),
  ])

  if (!zakazka) notFound()

  // Fotky z obchodní fáze (OP) — zobrazí se technikům v Podkladech
  const opFotky = zakazka.opId
    ? await prisma.photo.findMany({
        where: { dealId: zakazka.opId, orgId },
        select: { id: true, nazev: true, cesta: true },
        orderBy: { vytvoreno: 'desc' },
      })
    : []

  return (
    <>
      {tab === 'polozky' && (
        <PolozkyTab
          zakazkaId={zakazka.id}
          polozky={zakazka.polozky.map(p => ({
            id: p.id,
            nazev: p.nazev,
            kod: p.kod,
            mnozstvi: Number(p.mnozstvi),
            jednotka: p.jednotka,
            prodejniCena: isTechnik ? null : (p.prodejniCena !== null ? Number(p.prodejniCena) : null),
            nakupniCena: isTechnik ? null : (p.nakupniCena !== null ? Number(p.nakupniCena) : null),
            dphSazba: Number(p.dphSazba),
            stav: p.stav,
            poznamka: p.poznamka,
          }))}
          isTechnik={isTechnik}
        />
      )}

      {tab === 'technici' && !isTechnik && (
        <TechniciTab
          zakazkaId={zakazka.id}
          technici={zakazka.techniciRel.map(t => ({
            id: t.technik.id,
            jmeno: t.technik.jmeno,
            email: t.technik.email,
            telefon: t.technik.telefon ?? null,
            prirazeno: t.prirazeno.toISOString(),
          }))}
          vsichniTechnici={vsichniTechnici}
          canEdit={canEdit}
        />
      )}

      {tab === 'predavaky' && (
        <PredavakyTab
          zakazkaId={zakazka.id}
          predavaky={zakazka.predavaky.map(p => ({
            id: p.id,
            cislo: p.cislo,
            stav: p.stav,
            technikJmeno: p.technik.jmeno,
            vytvoreno: p.vytvoreno.toISOString(),
            podpisano: p.podpisano?.toISOString() ?? null,
            upravenoPodpisano: p.upravenoPodpisano,
            etapaId: p.etapaId ?? null,
          }))}
          canCreate={true}
          canApprove={canEdit}
          etapy={zakazka.etapy ?? []}
        />
      )}

      {tab === 'vyuctovani' && !isTechnik && (
        <VyuctovaniTab
          zakazkaId={zakazka.id}
          vyuctovani={zakazka.vyuctovani.map(v => ({
            id: v.id,
            cislo: v.cislo,
            stav: v.stav,
            vytvoreno: v.vytvoreno.toISOString(),
            etapaId: v.etapaId ?? null,
          }))}
          canCreate={canEdit}
          etapy={zakazka.etapy ?? []}
        />
      )}

      {tab === 'podklady' && (
        <PodkladyTab
          zakazkaId={zakazka.id}
          pokyny={zakazka.pokyny ?? null}
          dokumenty={zakazka.dokumenty.map(d => ({
            id: d.id,
            nazev: d.nazev,
            mime: d.mime,
            url: d.url,
            vytvoreno: d.vytvoreno.toISOString(),
            nahral: d.nahral,
          }))}
          canEdit={canEdit}
          opFotky={opFotky}
          opId={zakazka.op?.id ?? null}
          opKod={zakazka.op?.kod ?? null}
        />
      )}

      {tab === 'kontakty' && (
        <KontaktyTab
          zakazkaId={zakazka.id}
          kontakty={zakazka.kontakty.map(k => ({
            id: k.id,
            profese: k.profese,
            jmeno: k.jmeno,
            telefon: k.telefon,
            email: k.email,
            poznamka: k.poznamka,
          }))}
          canEdit={canEdit || isTechnik}
        />
      )}

      {tab === 'foto' && (
        <FotoTab
          zakazkaId={zakazka.id}
          fotky={zakazka.fotky.map(f => ({
            id: f.id,
            url: f.url,
            popis: f.popis,
            vytvoreno: f.vytvoreno.toISOString(),
            nahral: f.nahral,
          }))}
        />
      )}

      {tab === 'historie' && (
        <HistorieTab
          zakazkaId={zakazka.id}
          komentare={komentare.map(k => ({
            id: k.id,
            text: k.text,
            vytvoreno: k.vytvoreno.toISOString(),
            user: { id: k.user.id, jmeno: k.user.jmeno, role: k.user.role },
          }))}
          currentUserId={session.user.id}
          aktivity={auditLogs.map(a => ({
            id: a.id,
            typAkce: a.typAkce,
            typZaznamu: a.typZaznamu,
            zaznamNazev: a.zaznamNazev,
            zmeny: a.zmeny as Record<string, unknown>,
            vytvoreno: a.vytvoreno.toISOString(),
            userJmeno: a.user?.jmeno ?? null,
          }))}
        />
      )}
    </>
  )
}
