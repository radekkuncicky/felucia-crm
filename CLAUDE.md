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
npm run build && pm2 restart nanto-crm --update-env
```

## DB
```
postgresql://nanto:***@localhost:5432/nanto_crm
```
Migrace: `npx prisma migrate dev --name název`

## Doména
- `felucia.io` → landing page (nepřihlášení)
- `{slug}.felucia.io` → CRM (přihlášení)
- `crm.workspace-nanto.cz` → NANTO interní (zachovat)

## Superadmin
- Email: `admin@nanto.cz`
- Route: `/superadmin` (vyžaduje `isSuperAdmin: true`)
- Impersonace org: nastaví cookie `sa_impersonate`
