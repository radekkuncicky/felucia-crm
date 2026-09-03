import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { buildSodPdf } from '@/lib/sodPdf'
import { getPerms, forbidden } from '@/lib/permissions'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const result = await buildSodPdf(params.id, session.user.orgId)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(result.pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.cislo}.pdf"`,
    },
  })
}
