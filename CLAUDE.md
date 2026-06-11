# NANTO CRM - Claude Code Guide

## Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- Prisma ORM + PostgreSQL (nanto_crm DB)
- NextAuth.js (JWT sessions)
- PM2 + Nginx na Hetzner VPS

## Architektura
- Multi-tenant: každý model má `orgId` FK na `Organization`
- Session obsahuje: `userId`, `orgId`, `orgSlug`, `role`, `plan`, `isSuperAdmin`
- Vždy filtruj podle `orgId` v DB dotazech

## Důležité soubory
- `lib/auth.ts` — NextAuth konfigurace
- `lib/prisma.ts` — Prisma client
- `lib/orgSettings.ts` — OrgSettings type + getOrgSettings()
- `lib/planLimits.ts` — STARTER/STANDARD/PROFESSIONAL/ENTERPRISE limity
- `middleware.ts` — auth + tenant routing
- `context/OrgSettingsContext.tsx` — OrgSettings context (stateful, useOrgSettings + useUpdateOrgSettings)

## Plány
- **STARTER**: 1 user, 20 OP, 100 produktů, 1 šablona (bez AI, bez editace footeru)
- **STANDARD**: 5 users, neomezené OP/produkty, 10 šablon, AI 500 tokenů/měsíc
- **PROFESSIONAL**: 20 users, neomezené vše, custom doména, white-label, servisní modul
- **ENTERPRISE**: neomezené vše, SLA 1h support

## Branding
- Felucia: Cyan `#00D4C8`, Purple `#7B2FBE`, Dark `#0A0F1E`
- NANTO interní: Yellow `#FFC93C`, Gray `#4A4A4A`

## Feature Flags (OrgSettings)
- Modul toggling via `/settings/features` page
- Uloženo v DB tabulce `OrgSettings` per org
- Context: `useOrgSettings()` vrací settings, `useUpdateOrgSettings()` vrací update fn
- Toggles se okamžitě aplikují v UI přes context bez reloadu

## Deploy
```
./scripts/deploy.sh   # typecheck + testy + build + restart + health check
```

## Testy
- `npm test` (vitest, integrační nad DB `nanto_crm_test`)
- Tenant izolace: `lib/orgPrisma.ts` — v API routes používej `orgPrisma(session.user.orgId)`,
  nikdy holý `prisma` (ten jen pro auth/superadmin/webhooky před resolvnutím org)
- Nový model s `orgId` → přidej do `TENANT_MODELS` v lib/orgPrisma.ts (hlídá test)

## DB
```
postgresql://nanto:***@localhost:5432/nanto_crm
```
Migrace: `npx prisma migrate dev --name název`
Zálohy: cron 3:00 → `/root/scripts/backup-db.sh` → `/root/backups/*.dump` (14 dní, marker LAST_OK)
Offsite: cron 3:30 → `/root/scripts/offsite-sync.sh` → rclone copy na B2 remote `b2` (marker LAST_OK_OFFSITE; bez nakonfigurovaného remote se přeskakuje)
Alert: cron 8:00 → `/root/scripts/check-backup.sh` — markery starší 26 h ⇒ bell notifikace superadminovi (typ SYSTEM, bez SMTP)
Obnova: `pg_restore --dbname=<URL> --no-owner <soubor.dump>`

## Worker / fronty (pg-boss)
- PM2 proces `nanto-crm-worker` (`worker/index.ts`, tsx) — samostatný od Next.js
- pg-boss nad stejnou DB, schéma `pgboss`; fronty: `reminders-sweep` (cron 1 min), `activity-reminder`
- Připomínky aktivit: bell notifikace vždy, email jen s nakonfigurovaným SMTP
- `deploy.sh` restartuje web i worker (`pm2 startOrRestart ecosystem.config.js`)

## Email
- `lib/email.ts` (nodemailer) — bez `SMTP_HOST` v `.env` je odesílání vypnuté (`isEmailConfigured()`)

## Sentry
- Aktivace: nastav `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` v `.env` (bez nich vypnuto)

## Doména
- `felucia.io` → landing page (nepřihlášení)
- `{slug}.felucia.io` → CRM (přihlášení)
- `crm.workspace-nanto.cz` → NANTO interní (zachovat)

## Superadmin
- Email: `admin@nanto.cz`
- Route: `/superadmin` (vyžaduje `isSuperAdmin: true`)
- Impersonace org: nastaví cookie `sa_impersonate`
