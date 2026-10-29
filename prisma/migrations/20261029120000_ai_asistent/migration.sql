-- AI asistentka: audit volání nástrojů, zápisy čekající na potvrzení, actor v historii, firemní kontext
-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actorType" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "aiSource" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "aiContext" TEXT;

-- CreateTable
CREATE TABLE "ai_audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zdroj" TEXT NOT NULL DEFAULT 'web',
    "nastroj" TEXT NOT NULL,
    "vstup" JSONB NOT NULL DEFAULT '{}',
    "vysledek" TEXT,
    "stav" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_cekajici_akce" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "zpravy" JSONB NOT NULL,
    "hotove" JSONB NOT NULL DEFAULT '[]',
    "akce" JSONB NOT NULL,
    "stav" TEXT NOT NULL DEFAULT 'CEKA',
    "expiruje" TIMESTAMP(3) NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_cekajici_akce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_audit_logs_orgId_vytvoreno_idx" ON "ai_audit_logs"("orgId", "vytvoreno");

-- CreateIndex
CREATE INDEX "ai_cekajici_akce_orgId_userId_idx" ON "ai_cekajici_akce"("orgId", "userId");

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_cekajici_akce" ADD CONSTRAINT "ai_cekajici_akce_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_cekajici_akce" ADD CONSTRAINT "ai_cekajici_akce_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

