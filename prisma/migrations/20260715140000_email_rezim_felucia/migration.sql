-- Režim odesílání e-mailů: FELUCIA (centrální brána, jen identita) vs. VLASTNI_SMTP.
-- Stávající řádky mají vyplněné SMTP → dostávají VLASTNI_SMTP, default pro nové je FELUCIA.
ALTER TABLE "org_email_settings" ADD COLUMN IF NOT EXISTS "rezim" TEXT NOT NULL DEFAULT 'FELUCIA';
UPDATE "org_email_settings" SET "rezim" = 'VLASTNI_SMTP' WHERE "smtpHost" IS NOT NULL;
ALTER TABLE "org_email_settings" ALTER COLUMN "smtpHost" DROP NOT NULL;
ALTER TABLE "org_email_settings" ALTER COLUMN "smtpUser" DROP NOT NULL;
ALTER TABLE "org_email_settings" ALTER COLUMN "smtpPassEnc" DROP NOT NULL;
