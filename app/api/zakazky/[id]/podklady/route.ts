import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { PODKLAD_MAX_SIZE, PodkladTypeError, parseDataUri, ulozitPodklad } from '@/lib/zakazkaPodklady'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await db.zakazka.findFirst({
    where: { id: params.id, orgId },
    select: { pokyny: true },
  })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dokumenty = await db.zakázkaDokument.findMany({
    where: { zakazkaId: params.id },
    include: { nahral: { select: { id: true, jmeno: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json({ pokyny: zakazka.pokyny, dokumenty })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contentType = req.headers.get('content-type') ?? ''

  // Soubor jako multipart (pole "soubor") — ukládá se na disk, do DB jen cesta
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try { formData = await req.formData() } catch {
      return NextResponse.json({ error: 'Neplatná data formuláře' }, { status: 400 })
    }
    const file = formData.get('soubor') as File | null
    if (!file) return NextResponse.json({ error: 'Chybí pole soubor' }, { status: 400 })
    if (file.size > PODKLAD_MAX_SIZE) {
      return NextResponse.json({ error: 'Soubor je příliš velký (max 25 MB)' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let url: string
    try { url = await ulozitPodklad(params.id, buffer, file.name) } catch (e) {
      if (e instanceof PodkladTypeError) return NextResponse.json({ error: 'Nepodporovaný typ souboru (povoleno: PDF, obrázky, Office, txt/csv, zip, dwg/dxf)' }, { status: 415 })
      throw e
    }
    const dok = await db.zakázkaDokument.create({
      data: {
        orgId,
        zakazkaId: params.id,
        nazev: file.name,
        url,
        mime: file.type || 'application/octet-stream',
        nahralId: session.user.id,
      },
      include: { nahral: { select: { id: true, jmeno: true } } },
    })
    return NextResponse.json(dok, { status: 201 })
  }

  const body = await req.json()

  if (body.pokyny !== undefined) {
    await db.zakazka.update({
      where: { id: params.id },
      data: { pokyny: body.pokyny || null },
    })
    return NextResponse.json({ ok: true })
  }

  // Legacy JSON s data: URI (starší JS v cache prohlížeče) — dekódujeme a uložíme
  // na disk stejně jako multipart, aby v DB nikdy nevznikl base64 blob.
  if (body.url && body.nazev) {
    const parsed = parseDataUri(String(body.url))
    if (!parsed) return NextResponse.json({ error: 'Neplatný formát souboru' }, { status: 400 })
    if (parsed.buffer.length > PODKLAD_MAX_SIZE) {
      return NextResponse.json({ error: 'Soubor je příliš velký (max 25 MB)' }, { status: 413 })
    }
    let url: string
    try { url = await ulozitPodklad(params.id, parsed.buffer, String(body.nazev)) } catch (e) {
      if (e instanceof PodkladTypeError) return NextResponse.json({ error: 'Nepodporovaný typ souboru' }, { status: 415 })
      throw e
    }
    const dok = await db.zakázkaDokument.create({
      data: {
        orgId,
        zakazkaId: params.id,
        nazev: String(body.nazev),
        url,
        mime: body.mime ?? parsed.mime,
        nahralId: session.user.id,
      },
      include: { nahral: { select: { id: true, jmeno: true } } },
    })
    return NextResponse.json(dok, { status: 201 })
  }

  return NextResponse.json({ error: 'Chybí parametry' }, { status: 400 })
}
