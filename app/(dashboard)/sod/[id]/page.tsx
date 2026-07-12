import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SodTyp } from '@prisma/client'
import SodDeleteButton from './SodDeleteButton'
import { formatDate, formatKcPresne } from '@/lib/format'

const TYP_LABELS: Record<SodTyp, string> = {
  DPH_12_BEZ_ZALOHY: '12% bez zálohy',
  DPH_12_SE_ZALOHOU: '12% se zálohou',
  DPH_21_BEZ_ZALOHY: '21% bez zálohy',
  DPH_21_SE_ZALOHOU: '21% se zálohou',
  PDP_BEZ_ZALOHY: 'PDP bez zálohy',
  PDP_SE_ZALOHOU: 'PDP se zálohou',
}

const TYP_COLORS: Record<SodTyp, string> = {
  DPH_12_BEZ_ZALOHY: 'bg-blue-50 text-blue-700',
  DPH_12_SE_ZALOHOU: 'bg-blue-100 text-blue-800',
  DPH_21_BEZ_ZALOHY: 'bg-purple-50 text-purple-700',
  DPH_21_SE_ZALOHOU: 'bg-purple-100 text-purple-800',
  PDP_BEZ_ZALOHY: 'bg-amber-50 text-amber-700',
  PDP_SE_ZALOHOU: 'bg-amber-100 text-amber-800',
}

function fmt(d: Date | null | undefined) {
  if (!d) return '—'
  return formatDate(d)
}

function fmtKc(n: unknown) {
  if (n == null) return '—'
  return formatKcPresne(Number(n))
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
      <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide w-44 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white">{value || '—'}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default async function SodDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  if (session.user.role === 'TECHNIK') notFound()

  const orgId = session.user.orgId

  const sod = await prisma.sod.findFirst({
    where: { id: params.id, orgId },
    include: {
      deal: {
        select: { id: true, kod: true, predmet: true },
      },
    },
  })

  if (!sod) notFound()

  const seZalohou = ['DPH_12_SE_ZALOHOU', 'DPH_21_SE_ZALOHOU', 'PDP_SE_ZALOHOU'].includes(sod.typ)
  const isAdmin = session.user.role === 'ADMIN'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <Link
              href={`/deals/${sod.deal.id}?tab=smlouvy`}
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {sod.deal.kod ?? 'OP'} — {sod.deal.predmet ?? 'Obchodní případ'}
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-2xl font-bold text-gray-900 dark:text-white">{sod.cislo}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYP_COLORS[sod.typ]}`}>
                {TYP_LABELS[sod.typ]}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500">Vytvořeno: {fmt(sod.vytvoreno)}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/sod/${sod.id}/edit`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Upravit
            </Link>
            <a
              href={`/api/sod/${sod.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Stáhnout PDF
            </a>
            <a
              href={`/api/sod/${sod.id}/docx`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Stáhnout DOCX
            </a>
            {isAdmin && (
              <SodDeleteButton sodId={sod.id} dealId={sod.deal.id} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Section title="Klient">
          <Row label="Jméno" value={sod.klientJmeno} />
          <Row label="Adresa" value={sod.klientAdresa} />
          <Row label="E-mail" value={sod.klientEmail} />
          <Row label="Telefon" value={sod.klientTelefon} />
          <Row label="IČO" value={sod.klientIco} />
          <Row label="DIČ" value={sod.klientDic} />
        </Section>

        <Section title="Kontaktní osoba">
          <Row label="Jméno" value={sod.kontaktniOsoba} />
          <Row label="Telefon" value={sod.kontaktniTelefon} />
        </Section>

        <Section title="Dílo">
          <Row label="Předmět díla" value={sod.predmetDila} />
          <Row label="Adresa díla" value={sod.adresaDila} />
        </Section>

        <Section title="Termíny">
          <Row label="Převzetí staveniště" value={sod.terminPrevzeti ?? '—'} />
          <Row label="Počet dní realizace" value={sod.pocetDniRealizace != null ? `${sod.pocetDniRealizace} dní` : '—'} />
          <Row label="Nejzazší změna" value={sod.zmenaTerm ?? '—'} />
        </Section>

        <Section title="Cena">
          <Row label="Cena bez DPH" value={fmtKc(sod.cenaBezDph)} />
          <Row label="DPH sazba" value={sod.dphSazba != null ? `${Number(sod.dphSazba)} %` : '—'} />
          <Row label="Cena s DPH" value={fmtKc(sod.cenaSDph)} />
        </Section>

        {seZalohou && (
          <Section title="Záloha">
            <Row label="Výše zálohy" value={fmtKc(sod.zalohaKc)} />
            <Row label="Splatnost" value={sod.zalohaSplatnost != null ? `${sod.zalohaSplatnost} dní` : '—'} />
            <Row label="Kategorie" value={sod.zalohaKategorie} />
          </Section>
        )}

        {sod.poznamky && (
          <Section title="Poznámky">
            <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{sod.poznamky}</p>
          </Section>
        )}
      </div>
    </div>
  )
}
