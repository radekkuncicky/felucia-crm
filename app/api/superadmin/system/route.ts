import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let settings = await prisma.systemSettings.findFirst()
  if (!settings) settings = await prisma.systemSettings.create({ data: {} })
  return NextResponse.json(settings)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['maintenanceMode', 'maintenanceMessage', 'announcementText', 'announcementActive', 'announcementColor']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  let settings = await prisma.systemSettings.findFirst()
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: { ...data } })
  } else {
    settings = await prisma.systemSettings.update({ where: { id: settings.id }, data })
  }

  return NextResponse.json(settings)
}
