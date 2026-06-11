import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logAction } from '@/lib/auditLog'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { orgId } = body

  // SECURITY FIX: Never accept orgId that equals the superadmin's own org — impersonation
  // should only be used to view OTHER organisations
  if (!orgId || orgId === session.user.orgId) {
    return NextResponse.json({ error: 'Neplatné orgId pro impersonaci' }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { users: { where: { role: 'ADMIN', aktivni: true }, take: 1 } },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organizace nenalezena' }, { status: 404 })
  }
  if (!org.users.length) {
    return NextResponse.json({ error: 'Organizace nemá žádného aktivního admina' }, { status: 400 })
  }

  const adminUser = org.users[0]

  // SECURITY FIX: Store the real superadmin's ID in the cookie so the session callback
  // can verify ownership and the DELETE handler can authenticate without isSuperAdmin flag
  const cookieStore = cookies()
  cookieStore.set('sa_impersonate', JSON.stringify({
    superAdminId: session.user.id,
    superAdminJmeno: session.user.jmeno,
    orgId: org.id,
    orgNazev: org.nazev,
    impersonatingUserId: adminUser.id,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
    path: '/',
  })

  // SECURITY FIX: Audit log every impersonation start — logged against the superadmin's own org
  await logAction({
    orgId: session.user.orgId,
    userId: session.user.id,
    typAkce: 'UPDATE',
    typZaznamu: 'SuperadminImpersonate',
    zaznamId: org.id,
    zaznamNazev: org.nazev,
    zmeny: {
      action: 'IMPERSONATE_START',
      targetOrgId: org.id,
      targetOrgSlug: org.slug,
      targetOrgNazev: org.nazev,
      impersonatingUserId: adminUser.id,
      superAdminId: session.user.id,
    },
  })

  return NextResponse.json({ ok: true, orgId: org.id })
}

export async function DELETE() {
  // SECURITY FIX: The session callback sets isSuperAdmin=false during impersonation,
  // so we cannot rely on session.user.isSuperAdmin here. Instead we verify directly
  // from the cookie that the caller is a legitimate superadmin.
  const cookieStore = cookies()
  const impCookie = cookieStore.get('sa_impersonate')

  if (!impCookie?.value) {
    return NextResponse.json({ error: 'Žádná aktivní impersonace' }, { status: 400 })
  }

  let imp: { superAdminId: string; orgId: string; orgNazev: string }
  try {
    imp = JSON.parse(impCookie.value)
  } catch {
    cookieStore.delete('sa_impersonate')
    return NextResponse.json({ error: 'Neplatná impersonační cookie' }, { status: 400 })
  }

  // Verify the superAdminId from the cookie is actually a superadmin in the DB
  const superAdmin = await prisma.user.findFirst({
    where: { id: imp.superAdminId, isSuperAdmin: true, aktivni: true },
    select: { id: true, jmeno: true, orgId: true },
  })

  if (!superAdmin) {
    // Cookie tampered — clear it and reject
    cookieStore.delete('sa_impersonate')
    return NextResponse.json({ error: 'Neplatná impersonační cookie' }, { status: 403 })
  }

  // Audit log impersonation end
  await logAction({
    orgId: superAdmin.orgId,
    userId: superAdmin.id,
    typAkce: 'UPDATE',
    typZaznamu: 'SuperadminImpersonate',
    zaznamId: imp.orgId,
    zaznamNazev: imp.orgNazev,
    zmeny: {
      action: 'IMPERSONATE_END',
      targetOrgId: imp.orgId,
      targetOrgNazev: imp.orgNazev,
      superAdminId: superAdmin.id,
    },
  })

  cookieStore.delete('sa_impersonate')
  return NextResponse.json({ ok: true })
}
