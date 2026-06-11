import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { generatePdf } from '@/lib/pdf'
import { buildDokumentChrome, DokumentChromeOverrides } from '@/lib/dokumentyChrome'
import { getPlanLimits } from '@/lib/planLimits'

// Náhled vzhledu dokumentů: vygeneruje ukázkovou stránku smlouvy
// s aktuálním (i neuloženým) nastavením záhlaví/patičky.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as DokumentChromeOverrides
  const overrides: DokumentChromeOverrides = {}
  if (typeof body.dokumentyStyl === 'string') overrides.dokumentyStyl = body.dokumentyStyl
  if ('dokumentyPaticka' in body) overrides.dokumentyPaticka = body.dokumentyPaticka ?? null
  if (typeof body.dokumentyCislovani === 'boolean') overrides.dokumentyCislovani = body.dokumentyCislovani
  if ('dokumentyHeaderHtml' in body) overrides.dokumentyHeaderHtml = body.dokumentyHeaderHtml ?? null
  if ('dokumentyFooterHtml' in body) overrides.dokumentyFooterHtml = body.dokumentyFooterHtml ?? null

  if ((overrides.dokumentyStyl === 'VLASTNI' || overrides.dokumentyHeaderHtml != null || overrides.dokumentyFooterHtml != null)
      && !getPlanLimits(session.user.plan).hasWhiteLabel) {
    return NextResponse.json({ error: 'Vlastní HTML šablona vyžaduje plán PROFESSIONAL' }, { status: 403 })
  }

  const chrome = await buildDokumentChrome(session.user.orgId, session.user.plan, overrides)

  const sample = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.7; color: #000; }
    h1 { font-size: 14pt; font-weight: bold; text-align: center; margin: 1.2em 0 0.8em; }
    h2 { font-size: 12pt; font-weight: bold; margin: 1em 0 0.5em; }
    p { margin: 0 0 0.7em; }
  </style></head><body>
    <h1>Smlouva o dílo č. SOD-26-001</h1>
    <p><em>dle §2586 a násl. zákona č. 89/2012 Sb., občanský zákoník</em></p>
    <h2>I. Předmět Smlouvy</h2>
    <p>Toto je ukázková stránka pro náhled záhlaví a patičky dokumentů.
    Předmětem této Smlouvy je závazek Zhotovitele provést pro Objednatele dílo
    na svůj náklad a nebezpečí a dále závazek Objednatele provedené dílo převzít
    a zaplatit za něj sjednanou cenu.</p>
    <h2>II. Cena Díla</h2>
    <p>Smluvní strany sjednaly cenu Díla ve výši 60 500 Kč vč. DPH.</p>
    ${'<p>Výplňový odstavec pro zobrazení více stránek a číslování. </p>'.repeat(30)}
  </body></html>`

  const pdf = await generatePdf(sample, chrome)
  return new Response(pdf as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="nahled-dokumentu.pdf"' },
  })
}
