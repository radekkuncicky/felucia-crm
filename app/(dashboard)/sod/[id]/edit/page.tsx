import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import SodEditClient from './SodEditClient'

export default async function SodEditPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'TECHNIK') notFound()

  const orgId = session.user.orgId

  const [sod, org] = await Promise.all([
    prisma.sod.findFirst({
      where: { id: params.id, orgId },
      select: {
        id: true, cislo: true, templateId: true, textSmlouvy: true, dealId: true,
        klientJmeno: true, klientAdresa: true, klientEmail: true,
        klientTelefon: true, klientIco: true, klientDic: true,
        kontaktniOsoba: true, kontaktniTelefon: true,
        predmetDila: true, adresaDila: true,
        terminPrevzeti: true, pocetDniRealizace: true, zmenaTerm: true,
        cenaBezDph: true, cenaSDph: true, dphSazba: true,
        zalohaKc: true, zalohaSplatnost: true,
        poznamky: true,
        prilohaVop: true, prilohaVzsp: true, prilohaCenik: true, prilohaNabidka: true,
      },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { prilohaVopPath: true, prilohaVzspPath: true, prilohaCenikPath: true },
    }),
  ])

  if (!sod) notFound()

  // Aktivní CN — cena díla se bere vždy z ní
  let cnInfo: { bezDph: number; sDph: number; dphSazba: number } | null = null
  if (sod.dealId) {
    const activeQuote = await prisma.quote.findFirst({
      where: { dealId: sod.dealId, orgId, aktivni: true },
      select: { dphSazba: true, items: { select: { cenaZaKus: true, mnozstvi: true, sleva: true } } },
    })
    if (activeQuote) {
      const bezDph = activeQuote.items.reduce((sum, it) => {
        return sum + Number(it.cenaZaKus) * Number(it.mnozstvi) * (1 - Number(it.sleva) / 100)
      }, 0)
      const dph = activeQuote.dphSazba
      cnInfo = { bezDph: Math.round(bezDph), sDph: Math.round(bezDph * (1 + dph / 100)), dphSazba: dph }
    }
  }

  return (
    <SodEditClient
      sodId={sod.id}
      cislo={sod.cislo}
      hasTemplate={!!sod.templateId}
      initialText={sod.textSmlouvy ?? ''}
      cnInfo={cnInfo}
      initialForm={{
        klientJmeno: sod.klientJmeno ?? '',
        klientAdresa: sod.klientAdresa ?? '',
        klientEmail: sod.klientEmail ?? '',
        klientTelefon: sod.klientTelefon ?? '',
        klientIco: sod.klientIco ?? '',
        klientDic: sod.klientDic ?? '',
        kontaktniOsoba: sod.kontaktniOsoba ?? '',
        kontaktniTelefon: sod.kontaktniTelefon ?? '',
        predmetDila: sod.predmetDila ?? '',
        adresaDila: sod.adresaDila ?? '',
        terminPrevzeti: sod.terminPrevzeti ?? '',
        pocetDniRealizace: sod.pocetDniRealizace != null ? String(sod.pocetDniRealizace) : '',
        zmenaTerm: sod.zmenaTerm ?? '',
        // cena se bere z CN, ne ze SOD záznamu
        cenaBezDph: cnInfo ? String(cnInfo.bezDph) : (sod.cenaBezDph != null ? String(Number(sod.cenaBezDph)) : ''),
        cenaSDph: cnInfo ? String(cnInfo.sDph) : (sod.cenaSDph != null ? String(Number(sod.cenaSDph)) : ''),
        dphSazba: cnInfo ? String(cnInfo.dphSazba) : (sod.dphSazba != null ? String(Number(sod.dphSazba)) : ''),
        zalohaKc: sod.zalohaKc != null ? String(Number(sod.zalohaKc)) : '',
        zalohaSplatnost: sod.zalohaSplatnost != null ? String(sod.zalohaSplatnost) : '',
        poznamky: sod.poznamky ?? '',
      }}
      initialAttach={{
        prilohaVop: sod.prilohaVop,
        prilohaVzsp: sod.prilohaVzsp,
        prilohaCenik: sod.prilohaCenik,
        prilohaNabidka: sod.prilohaNabidka,
        hasVop: !!org?.prilohaVopPath,
        hasVzsp: !!org?.prilohaVzspPath,
        hasCenik: !!org?.prilohaCenikPath,
      }}
    />
  )
}
