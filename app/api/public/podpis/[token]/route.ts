import { NextRequest, NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getOrgSettings } from '@/lib/orgSettings'
import { orgLogoDataUrl } from '@/lib/quoteRenderer'
import { maskTelefon } from '@/lib/sms'
import {
  loadRelaceByToken, verifyPodpisCookie, podpisCookieName, logSodUdalost,
} from '@/lib/sodPodpis'
import { checkRateLimit } from '@/lib/rateLimit'

// Veřejná stránka podpisu — GET vrací fázi flow podle stavu relace a OTP
// cookie. Obsah smlouvy se vydá až po ověření SMS kódem (dvoukanálově).
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (checkRateLimit(`podpis-get:${ip}`, 60, 60_000).limited) {
    return NextResponse.json({ error: 'Příliš mnoho požadavků' }, { status: 429 })
  }

  const relace = await loadRelaceByToken(params.token)
  if (!relace) return NextResponse.json({ faze: 'NEPLATNY' }, { status: 404 })

  const { sod } = relace
  const settings = await getOrgSettings(relace.orgId)
  const org = {
    nazev: sod.organization.nazev,
    logo: orgLogoDataUrl(sod.organization.logo),
    primaryColor: settings.primaryColor,
    kontaktJmeno: settings.obchodnikJmeno || null,
    kontaktTelefon: settings.obchodnikTelefon || sod.organization.telefon || null,
    kontaktEmail: sod.organization.email || null,
  }
  const zaklad = { org, cislo: sod.cislo, klientJmeno: sod.klientJmeno }

  if (sod.stav === 'PODEPSANO') {
    return NextResponse.json({ faze: 'PODEPSANO', ...zaklad, podepsano: sod.podepsano })
  }
  if (relace.stav !== 'AKTIVNI') {
    return NextResponse.json({ faze: 'NEPLATNY', org })
  }

  const cookie = req.cookies.get(podpisCookieName(relace.id))?.value
  if (!verifyPodpisCookie(relace.id, cookie)) {
    return NextResponse.json({
      faze: 'OVERENI',
      ...zaklad,
      maskTelefon: maskTelefon(relace.telefon),
      otpZamceno: relace.otpPokusy >= 5,
    })
  }

  const verze = relace.verzeId
    ? await orgPrisma(relace.orgId).sodVerze.findFirst({ where: { id: relace.verzeId, orgId: relace.orgId } })
    : null
  if (!verze) return NextResponse.json({ faze: 'NEPLATNY', org })

  // první zobrazení po ověření → audit (jen jednou na relaci)
  const uzZobrazil = await orgPrisma(relace.orgId).sodUdalost.count({
    where: { relaceId: relace.id, typ: 'ZOBRAZENO' },
  })
  if (uzZobrazil === 0) {
    await logSodUdalost({ orgId: relace.orgId, sodId: relace.sodId, typ: 'ZOBRAZENO', relaceId: relace.id, req })
  }

  return NextResponse.json({
    faze: 'SMLOUVA',
    ...zaklad,
    contractHtml: verze.textSmlouvy,
  })
}
