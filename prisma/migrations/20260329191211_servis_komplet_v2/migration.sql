-- CreateEnum
CREATE TYPE "ZarizeniTyp" AS ENUM ('TEPELNE_CERPADLO', 'KLIMATIZACE', 'REKUPERACE', 'PODLAHOVE_VYTAPENI', 'VZDUCHOTECHNIKA', 'OHREV_TV', 'JINE');

-- CreateEnum
CREATE TYPE "NavstevaTyp" AS ENUM ('PLANOVANY_SERVIS', 'PORUCHA', 'ZARUCNI_OPRAVA', 'POZARUCNI_OPRAVA', 'UVEDENI_DO_PROVOZU', 'KONTROLA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServisStav" ADD VALUE 'POTVRZENA';
ALTER TYPE "ServisStav" ADD VALUE 'PROBIHA';

-- DropForeignKey
ALTER TABLE "servisni_kontrakty" DROP CONSTRAINT "servisni_kontrakty_dealId_fkey";

-- AlterTable
ALTER TABLE "servisni_kontrakty" ADD COLUMN     "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cisloKontraktu" TEXT,
ADD COLUMN     "zarizeniId" TEXT,
ALTER COLUMN "dealId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "servisni_navstevy" ADD COLUMN     "cisloNavstevy" TEXT,
ADD COLUMN     "doporuceni" TEXT,
ADD COLUMN     "fotky" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "klientId" TEXT,
ADD COLUMN     "nakladyCas" DECIMAL(10,2),
ADD COLUMN     "nakladyMaterial" DECIMAL(12,2),
ADD COLUMN     "nalezeneZavady" TEXT,
ADD COLUMN     "podpisKlienta" TEXT,
ADD COLUMN     "trvaniMinut" INTEGER,
ADD COLUMN     "typ" "NavstevaTyp" NOT NULL DEFAULT 'PLANOVANY_SERVIS',
ADD COLUMN     "zarizeniId" TEXT,
ALTER COLUMN "kontraktId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "zarizeni" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "klientId" TEXT NOT NULL,
    "dealId" TEXT,
    "nazev" TEXT NOT NULL,
    "typ" "ZarizeniTyp" NOT NULL DEFAULT 'JINE',
    "vyrobniCislo" TEXT,
    "datumInstalace" TIMESTAMP(3),
    "zarukaDo" TIMESTAMP(3),
    "poznamka" TEXT,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zarizeni_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "zarizeni" ADD CONSTRAINT "zarizeni_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zarizeni" ADD CONSTRAINT "zarizeni_klientId_fkey" FOREIGN KEY ("klientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zarizeni" ADD CONSTRAINT "zarizeni_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_kontrakty" ADD CONSTRAINT "servisni_kontrakty_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_kontrakty" ADD CONSTRAINT "servisni_kontrakty_zarizeniId_fkey" FOREIGN KEY ("zarizeniId") REFERENCES "zarizeni"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_navstevy" ADD CONSTRAINT "servisni_navstevy_zarizeniId_fkey" FOREIGN KEY ("zarizeniId") REFERENCES "zarizeni"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_navstevy" ADD CONSTRAINT "servisni_navstevy_klientId_fkey" FOREIGN KEY ("klientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
