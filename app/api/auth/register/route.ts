import { NextResponse } from 'next/server'
import { FORBIDDEN_SLUGS } from '@/lib/slug'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendEmail, emailWelcome } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { seedOrgDefaults } from '@/lib/orgDefaults'


function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)
}

export async function POST(req: Request) {
  // SECURITY FIX: Rate limit registration — max 5 per hour per IP to prevent spam account creation
  const ip = getClientIp(req)
  const { limited } = checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
  if (limited) {
    return NextResponse.json({ error: 'Příliš mnoho pokusů o registraci. Zkuste to za hodinu.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { nazevFirmy, ico, jmeno, prijmeni, email, heslo, slug: rawSlug } = body

    // ── Validace vstupů ────────────────────────────────────────────────────
    if (!nazevFirmy || !jmeno || !prijmeni || !email || !heslo) {
      return NextResponse.json({ error: 'Vyplňte všechna povinná pole.' }, { status: 400 })
    }
    if ([nazevFirmy, jmeno, prijmeni, email, heslo].some(v => typeof v !== 'string')) {
      return NextResponse.json({ error: 'Neplatný formát údajů.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Neplatný e-mail.' }, { status: 400 })
    }
    if (heslo.length < 10) {
      return NextResponse.json({ error: 'Heslo musí mít alespoň 10 znaků.' }, { status: 400 })
    }

    // Slug z klienta prochází stejnou normalizací jako v check-slug — jde do hostname
    const slug = generateSlug(typeof rawSlug === 'string' && rawSlug ? rawSlug : nazevFirmy)
    if (slug.length < 3) {
      return NextResponse.json({ error: 'Název firmy je příliš krátký pro adresu.' }, { status: 400 })
    }

    if (FORBIDDEN_SLUGS.includes(slug)) {
      return NextResponse.json({ error: 'Tento název firmy není povolen.' }, { status: 400 })
    }

    // ── Kontrola unikátnosti ───────────────────────────────────────────────
    const [existingSlug, existingEmail] = await Promise.all([
      prisma.organization.findUnique({ where: { slug } }),
      prisma.user.findFirst({ where: { email } }),
    ])

    if (existingSlug) {
      return NextResponse.json({ error: 'Tato subdoména je již obsazena.' }, { status: 409 })
    }
    if (existingEmail) {
      return NextResponse.json({ error: 'Tento email je již registrován.' }, { status: 409 })
    }

    // ── Transakce: org + user + kategorie ─────────────────────────────────
    const hesloHash = await bcrypt.hash(heslo, 12)

    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const org = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          nazev: nazevFirmy,
          slug,
          ico: ico || null,
          plan: 'STARTER',
          planActiveTo: null,
          trialStartedAt: now,
          trialEndsAt,
          onboardingDone: false,
          onboardingStep: 0,
        },
      })

      await tx.user.create({
        data: {
          orgId: newOrg.id,
          jmeno: `${jmeno} ${prijmeni}`.trim(),
          email,
          hesloHash,
          role: 'ADMIN',
        },
      })

      await tx.category.create({
        data: {
          orgId: newOrg.id,
          nazev: 'Obecné',
          barva: '#6B7280',
          poradi: 0,
        },
      })

      await seedOrgDefaults(tx, newOrg.id)

      return newOrg
    })

    // ── Uvítací email (volitelně) ──────────────────────────────────────────
    if (process.env.SMTP_HOST) {
      try {
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
        const loginUrl = `https://${slug}.${rootDomain}/auth/signin`
        await sendEmail(
          email,
          `Vítejte v FELUCIA CRM — ${jmeno}`,
          emailWelcome(jmeno, slug, loginUrl)
        )
      } catch {
        // email selhání není kritické
      }
    }

    return NextResponse.json({ success: true, slug, orgId: org.id }, { status: 201 })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Registrace se nezdařila. Zkuste to znovu.' }, { status: 500 })
  }
}
