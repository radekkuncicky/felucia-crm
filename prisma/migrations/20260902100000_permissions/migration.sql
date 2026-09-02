-- Role: nové presety MANAZER a HLAVNI_TECHNIK
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAZER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HLAVNI_TECHNIK';

-- Per-user přepisy oprávnění nad presetem role (viz lib/permissions.ts)
ALTER TABLE "users" ADD COLUMN "permissions" JSONB;

-- serviceAccess technika → přepis servis = VLASTNI
UPDATE "users" SET "permissions" = '{"servis":"VLASTNI"}'::jsonb
WHERE "serviceAccess" = true AND "role" = 'TECHNIK' AND "permissions" IS NULL;
