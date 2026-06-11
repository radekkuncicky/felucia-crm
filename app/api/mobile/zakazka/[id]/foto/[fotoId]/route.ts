import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireTechnikOrAdmin, canAccessZakazka } from '@/lib/mobile-helpers'
import { unlink } from 'fs/promises'
import { join } from 'path'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; fotoId: string } }
) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireTechnikOrAdmin(session)
  if (authErr) return authErr

  if (!(await canAccessZakazka(session!, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const foto = await orgPrisma(session!.user.orgId).zakazkaFoto.findFirst({
    where: { id: params.fotoId, zakazkaId: params.id },
  })

  if (!foto) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete physical file
  try {
    const filePath = join(process.cwd(), 'public', foto.url)
    await unlink(filePath)
  } catch {
    // File missing on disk is not a fatal error
  }

  await orgPrisma(session!.user.orgId).zakazkaFoto.delete({ where: { id: params.fotoId } })

  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
