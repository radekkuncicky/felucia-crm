import { prisma } from '@/lib/prisma'

export async function generateQuoteKod(orgId: string): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(2)
  const prefix = `NAB-${yy}-`

  const lastQuote = await prisma.quote.findFirst({
    where: { orgId, kod: { startsWith: prefix } },
    orderBy: { kod: 'desc' },
    select: { kod: true },
  })

  let seq = 1
  if (lastQuote?.kod) {
    const lastSeq = parseInt(lastQuote.kod.split('-').pop() ?? '0', 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

const techFileLabels: Record<string, string> = {
  KLIMA: 'Klimatizace',
  TEPELNE_CERPADLO: 'Tepelne cerpadlo',
  REKUPERACE: 'Rekuperace',
  PODLAHOVE_TOPENI: 'Podlahove topeni',
  VZDUCHOTECHNIKA: 'Vzduchotechnika',
  JINE: 'Jine',
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function buildPdfFilename(params: {
  clientJmeno: string
  clientPrijmeni: string
  quoteKod: string | null
  dealKod: string | null
  technologie: string
}): string {
  const name = stripDiacritics(`${params.clientJmeno} ${params.clientPrijmeni}`.trim())
  const kod = params.quoteKod ?? params.dealKod ?? 'Nabidka'
  const tech = techFileLabels[params.technologie] ?? stripDiacritics(params.technologie)
  return `${name} - ${kod} - ${tech}.pdf`
}
