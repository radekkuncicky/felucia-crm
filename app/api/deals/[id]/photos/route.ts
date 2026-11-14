import { NextRequest, NextResponse } from 'next/server'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { ulozFotkuOp } from '@/lib/fotoUloziste'
import { nactiFotkyOp } from '@/lib/fotkyOp'
import { nazevStitku, fotoStitkyOrg } from '@/lib/fotoStitky'
import { getOrgSettings } from '@/lib/orgSettings'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // galerie OP = fotky k OP + fotky ze zaměření (appka Sales)
  const [fotky, settings] = await Promise.all([nactiFotkyOp(db, params.id), getOrgSettings(orgId)])
  const stitky = fotoStitkyOrg(settings.fotoStitky)
  return NextResponse.json(fotky.map(f => ({
    id: f.id,
    nazev: nazevStitku(f.tag, stitky) ?? (f.zdroj === 'ZAMERENI' ? 'Zaměření' : 'Fotka'),
    cesta: f.url,
    vytvoreno: f.vytvoreno,
    zdroj: f.zdroj,
    tag: f.tag,
    tagNazev: nazevStitku(f.tag, stitky),
    popis: f.popis,
    autor: f.autor,
    gpsLat: f.gpsLat,
    gpsLng: f.gpsLng,
  })))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Nepodporovaný formát. Povoleny jsou: JPG, PNG, WEBP, GIF, HEIC.' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Soubor je příliš velký. Maximum je 10 MB.' }, { status: 400 })
  }

  const ulozeni = await ulozFotkuOp(orgId, params.id, Buffer.from(await file.arrayBuffer()))
  if (!ulozeni.ok) return NextResponse.json({ error: ulozeni.error }, { status: ulozeni.status })

  const photo = await db.photo.create({
    data: { orgId, dealId: params.id, nazev: file.name, cesta: ulozeni.cesta, autorId: session.user.id },
  })
  return NextResponse.json({ ...photo, zdroj: 'PRIPAD', tagNazev: null, autor: session.user.name ?? null })
}
