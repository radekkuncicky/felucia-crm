import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const navsteva = await db.servisniNavsteva.findFirst({ where: { id: params.id, orgId } })
  if (!navsteva) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = (navsteva.fotky as string[]) ?? []
  if (existing.length >= 10) {
    return NextResponse.json({ error: 'Maximum 10 fotek na návštěvu' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Soubor chybí' }, { status: 400 })

  const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Soubor je příliš velký (max 5 MB)' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const dataUrl = `data:${file.type};base64,${base64}`

  const updated = await db.servisniNavsteva.update({
    where: { id: params.id },
    data: { fotky: [...existing, dataUrl] },
  })

  return NextResponse.json({ fotky: updated.fotky })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const navsteva = await db.servisniNavsteva.findFirst({ where: { id: params.id, orgId } })
  if (!navsteva) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { index } = await req.json()
  const existing = (navsteva.fotky as string[]) ?? []
  const updated = existing.filter((_: string, i: number) => i !== index)

  await db.servisniNavsteva.update({ where: { id: params.id }, data: { fotky: updated } })
  return NextResponse.json({ fotky: updated })
}
