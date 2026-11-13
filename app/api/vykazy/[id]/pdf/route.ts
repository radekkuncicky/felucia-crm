import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { generatePdf } from '@/lib/pdf'
import { nactiVykazHtml } from '@/lib/vykazPdf'

// GET /api/vykazy/[id]/pdf — PDF uzavřeného výkazu technika pro vedení (náklady = financeNakupky)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).financeNakupky) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const vykaz = await nactiVykazHtml(session.user.orgId, params.id)
  if (!vykaz) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const pdf = await generatePdf(vykaz.html)
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${vykaz.nazevSouboru}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
