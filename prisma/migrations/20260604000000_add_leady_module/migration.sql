-- CreateEnum
CREATE TYPE "LeadZdroj" AS ENUM ('WEB_FORMULAR', 'RUCNE', 'IMPORT');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NOVY', 'KONTAKTOVAN', 'KVALIFIKOVAN', 'PREVEDEN', 'ZRUSEN');

-- AlterTable OrgSettings - add leady settings
ALTER TABLE "org_settings" ADD COLUMN "modulLeady" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "org_settings" ADD COLUMN "notifNovyLead" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable lead_notes
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable leady
CREATE TABLE "leady" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jmeno" TEXT NOT NULL,
    "email" TEXT,
    "telefon" TEXT,
    "firma" TEXT,
    "zdroj" "LeadZdroj" NOT NULL DEFAULT 'RUCNE',
    "status" "LeadStatus" NOT NULL DEFAULT 'NOVY',
    "zprava" TEXT,
    "assignedToId" TEXT,
    "odhadovanaHodnota" DECIMAL(12,2),
    "tagy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duvodZruseni" TEXT,
    "prevedenNaOpId" TEXT,
    "prevedenNaKlientId" TEXT,
    "apiKeyId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leady_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_notes_leadId_idx" ON "lead_notes"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "leady_prevedenNaOpId_key" ON "leady"("prevedenNaOpId");

-- CreateIndex
CREATE INDEX "leady_orgId_status_idx" ON "leady"("orgId", "status");

-- CreateIndex
CREATE INDEX "leady_orgId_vytvoreno_idx" ON "leady"("orgId", "vytvoreno");

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leady"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leady" ADD CONSTRAINT "leady_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leady" ADD CONSTRAINT "leady_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leady" ADD CONSTRAINT "leady_prevedenNaOpId_fkey" FOREIGN KEY ("prevedenNaOpId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
