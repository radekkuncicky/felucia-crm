import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { text?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const text = body.text?.trim()
  if (!text) return NextResponse.json({ error: 'Text je povinný' }, { status: 400 })
  if (text.length > 5000) return NextResponse.json({ error: 'Text je příliš dlouhý' }, { status: 400 })

  const komentar = await prisma.zakazkaKomentar.create({
    data: { zakazkaId: params.id, userId: session!.user.id, text },
    include: { user: { select: { id: true, jmeno: true, role: true } } },
  })

  return NextResponse.json({
    id: komentar.id,
    text: komentar.text,
    vytvoreno: komentar.vytvoreno,
    autor: { id: komentar.user.id, jmeno: komentar.user.jmeno, role: komentar.user.role },
  }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
