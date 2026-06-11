import { NextResponse } from 'next/server'

const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty'
const TIMEOUT_MS = 5000

export interface AresFirma {
  ico: string
  nazev: string
  dic: string | null
  ulice: string
  mesto: string
  psc: string
  pravniForma: string
}

function formatPsc(raw: string | number | null | undefined): string {
  if (!raw) return ''
  const s = String(raw).replace(/\s/g, '')
  return s.length === 5 ? `${s.slice(0, 3)} ${s.slice(3)}` : s
}

function buildUlice(sidlo: Record<string, unknown>): string {
  const ulice = sidlo.nazevUlice as string | undefined
  const domovni = sidlo.cisloDomovni as string | number | undefined
  const orientacni = sidlo.cisloOrientacni as string | number | undefined
  if (!ulice && !domovni) return ''
  const cislo = orientacni ? `${domovni}/${orientacni}` : domovni ? String(domovni) : ''
  return [ulice, cislo].filter(Boolean).join(' ')
}

function mapSubjekt(data: Record<string, unknown>): AresFirma {
  const sidlo = (data.sidlo as Record<string, unknown>) ?? {}
  return {
    ico: String(data.ico ?? ''),
    nazev: String(data.obchodniJmeno ?? ''),
    dic: (data.dic as string | null) ?? null,
    ulice: buildUlice(sidlo),
    mesto: String(sidlo.nazevObce ?? ''),
    psc: formatPsc(sidlo.psc as string | number | null | undefined),
    pravniForma: String(data.pravniForma ?? ''),
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()

  if (q.length < 2) {
    return NextResponse.json([])
  }

  const isIco = /^\d+$/.test(q)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let firmy: AresFirma[] = []

    if (isIco) {
      const res = await fetch(`${ARES_BASE}/${encodeURIComponent(q)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>
        firmy = [mapSubjekt(data)]
      }
    } else {
      const res = await fetch(`${ARES_BASE}/vyhledat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ obchodniJmeno: q, pocet: 10 }),
      })
      if (res.ok) {
        const data = await res.json() as { ekonomickeSubjekty?: Record<string, unknown>[] }
        firmy = (data.ekonomickeSubjekty ?? []).map(mapSubjekt)
      }
    }

    clearTimeout(timer)
    return NextResponse.json(firmy)
  } catch {
    return NextResponse.json([])
  }
}
