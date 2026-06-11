-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "dokumentyCislovani" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dokumentyFooterHtml" TEXT,
ADD COLUMN     "dokumentyHeaderHtml" TEXT,
ADD COLUMN     "dokumentyPaticka" TEXT,
ADD COLUMN     "dokumentyStyl" TEXT NOT NULL DEFAULT 'LINKA';
