import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMobileOrWebSession, requireTechnikOrAdmin } from '@/lib/mobile-helpers'

export async function PATCH(req: Request, { params }: { params: { id: string; komentarId: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const komentar = await prisma.zakazkaKomentar.findFirst({
    where: { id: params.komentarId, zakazkaId: params.id },
  })
  if (!komentar) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (komentar.userId !== session!.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Text je povinný' }, { status: 400 })

  const updated = await prisma.zakazkaKomentar.update({
    where: { id: params.komentarId },
    data: { text: text.trim() },
    include: { user: { select: { id: true, jmeno: true, role: true } } },
  })

  return NextResponse.json({
    id: updated.id,
    text: updated.text,
    vytvoreno: updated.vytvoreno,
    autor: { id: updated.user.id, jmeno: updated.user.jmeno, role: updated.user.role },
  })
}

export async function DELETE(req: Request, { params }: { params: { id: string; komentarId: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  const komentar = await prisma.zakazkaKomentar.findFirst({
    where: { id: params.komentarId, zakazkaId: params.id },
  })
  if (!komentar) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (komentar.userId !== session!.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.zakazkaKomentar.delete({ where: { id: params.komentarId } })
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
