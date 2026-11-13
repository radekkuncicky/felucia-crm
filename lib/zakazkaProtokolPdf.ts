import { orgPrisma } from '@/lib/orgPrisma'
import { generatePdf } from '@/lib/pdf'
import { buildDokumentChrome } from '@/lib/dokumentyChrome'
import { orgLogoDataUrl } from '@/lib/quoteRenderer'
import { getOrgSettings } from '@/lib/orgSettings'
import { ulozitPodklad } from '@/lib/zakazkaPodklady'
import type { ProtokolKontext } from '@/lib/protokolPdfZaklad'

export const PROTOKOL_TYPY = ['TLAKOVA_ZKOUSKA', 'ZAREGULOVANI_VZT'] as const
export type ProtokolTyp = (typeof PROTOKOL_TYPY)[number]

/** etapaId z těla požadavku — prázdné = bez etapy; jiný typ než string = chyba */
export function parseEtapaId(body: unknown): string | null | false {
  const v = (body as { etapaId?: unknown } | null)?.etapaId
  if (v == null || v === '') return null
  return typeof v === 'string' && v.length <= 64 ? v : false
}

export function asciiSlug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Vygeneruje PDF protokolu ze zakázky, uloží ho jako ZakázkaDokument s protokolTyp
 * (zobrazuje se u karty protokolu / etapy, ne v Podkladech) a vrátí ke stažení.
 * Oprávnění řeší volající route. null = zakázka/org/etapa nenalezena.
 */
export async function vytvoritProtokolZakazky(
  orgId: string, plan: string, userId: string, zakazkaId: string,
  opts: {
    render: (ctx: ProtokolKontext) => string
    /** prefix souboru, např. „Tlakova-zkouska" → Tlakova-zkouska-<cislo>-<datum>.pdf */
    soubor: string
    datum: string
    /** název uloženého dokumentu */
    nazev: string
    typ: ProtokolTyp
    /** etapa zakázky, ke které protokol patří (null = celá zakázka) */
    etapaId: string | null
  },
) {
  const db = orgPrisma(orgId)
  const z = await db.zakazka.findFirst({
    where: { id: zakazkaId, orgId },
    select: {
      cislo: true, nazev: true, mistoStavby: true,
      klient: { select: { jmeno: true, prijmeni: true, ulice: true, mesto: true, psc: true, telefon: true } },
    },
  })
  if (!z) return null
  if (opts.etapaId && !(await db.zakazkaEtapa.findFirst({ where: { id: opts.etapaId, zakazkaId, orgId }, select: { id: true } }))) return null

  const [org, settings, chrome] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { nazev: true, sidlo: true, ico: true, dic: true, email: true, telefon: true, logo: true },
    }),
    getOrgSettings(orgId),
    buildDokumentChrome(orgId, plan),
  ])
  if (!org) return null

  const html = opts.render({
    zakazka: { cislo: z.cislo, nazev: z.nazev, mistoStavby: z.mistoStavby },
    klient: z.klient,
    org: { ...org, logo: orgLogoDataUrl(org.logo), primaryColor: settings.primaryColor },
  })
  const pdf = await generatePdf(html, chrome)

  const filename = `${opts.soubor}-${asciiSlug(z.cislo)}-${opts.datum}.pdf`
  const url = await ulozitPodklad(zakazkaId, pdf, filename)
  const dokument = await db.zakázkaDokument.create({
    data: { orgId, zakazkaId, url, mime: 'application/pdf', nahralId: userId, nazev: opts.nazev, protokolTyp: opts.typ, etapaId: opts.etapaId },
    select: { id: true, nazev: true, url: true },
  })
  return { pdf, filename, dokument }
}
