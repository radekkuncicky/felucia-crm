-- AlterTable
ALTER TABLE "zakazka_polozky" ADD COLUMN IF NOT EXISTS "hotovo" BOOLEAN NOT NULL DEFAULT false;
