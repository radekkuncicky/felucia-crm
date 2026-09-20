import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getToken } from 'next-auth/jwt'
import { logAction } from '@/lib/auditLog'
import { IMPERSONATE_COOKIE, type ImpersonateCookie, signCookieValue, verifyCookieValue } from '@/lib/impersonate'

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
  const payload: ImpersonateCookie = {
    superAdminId: session.user.id,
    superAdminJmeno: session.user.jmeno,
    orgId: org.id,
    orgNazev: org.nazev,
    impersonatingUserId: adminUser.id,
  }
  // Podepsaná — obsah cookie rozhoduje o orgId celé session
  cookieStore.set('sa_impersonate', signCookieValue(payload, IMPERSONATE_COOKIE), {
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

export async function DELETE(req: NextRequest) {
  // Session callback během impersonace nastaví isSuperAdmin=false, proto se
  // ověřuje přímo JWT (getToken) + podpis cookie: ukončit smí jen ten
  // superadmin, který impersonaci spustil.
  const cookieStore = cookies()
  const impCookie = cookieStore.get('sa_impersonate')

  if (!impCookie?.value) {
    return NextResponse.json({ error: 'Žádná aktivní impersonace' }, { status: 400 })
  }

  const imp = verifyCookieValue<ImpersonateCookie>(impCookie.value, IMPERSONATE_COOKIE)
  if (!imp) {
    cookieStore.delete('sa_impersonate')
    return NextResponse.json({ error: 'Neplatná impersonační cookie' }, { status: 400 })
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.isSuperAdmin || token.id !== imp.superAdminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
