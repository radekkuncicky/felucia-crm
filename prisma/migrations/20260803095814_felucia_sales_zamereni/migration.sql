-- CreateEnum
CREATE TYPE "DuvodProhry" AS ENUM ('CENA', 'KONKURENCE', 'ODLOZENO', 'NEREAGOVAL', 'JINE');

-- CreateEnum
CREATE TYPE "OdeslaniKanal" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ZamereniStav" AS ENUM ('ROZPRACOVANE', 'UZAVRENE');

-- CreateEnum
CREATE TYPE "ZamereniFotoTag" AS ENUM ('ROZVADEC', 'VENKOVNI_JEDNOTKA', 'VNITRNI_JEDNOTKA', 'STAVAJICI_ZDROJ', 'FASADA', 'PROSTUP', 'CELKOVY_POHLED', 'JINE');

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "duvodProhryKod" "DuvodProhry";

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "odeslanoAt" TIMESTAMP(3),
ADD COLUMN     "odeslanoKanal" "OdeslaniKanal",
ADD COLUMN     "platnostDo" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "zamereni" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "autorId" TEXT,
    "typ" "Technologie" NOT NULL,
    "stav" "ZamereniStav" NOT NULL DEFAULT 'ROZPRACOVANE',
    "datum" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "odpovedi" JSONB NOT NULL DEFAULT '{}',
    "definiceId" TEXT,
    "definiceVerze" INTEGER,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zamereni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zamereni_fotky" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "zamereniId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tag" "ZamereniFotoTag" NOT NULL DEFAULT 'JINE',
    "popis" TEXT,
    "poradi" INTEGER NOT NULL DEFAULT 0,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "anotace" JSONB,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zamereni_fotky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zamereni_definice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "typ" "Technologie" NOT NULL,
    "verze" INTEGER NOT NULL DEFAULT 1,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "nazev" TEXT NOT NULL,
    "schemaJson" JSONB NOT NULL,
    "povinneTagy" "ZamereniFotoTag"[] DEFAULT ARRAY[]::"ZamereniFotoTag"[],
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zamereni_definice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zamereni_orgId_stav_idx" ON "zamereni"("orgId", "stav");

-- CreateIndex
CREATE INDEX "zamereni_dealId_idx" ON "zamereni"("dealId");

-- CreateIndex
CREATE INDEX "zamereni_fotky_zamereniId_idx" ON "zamereni_fotky"("zamereniId");

-- CreateIndex
CREATE INDEX "zamereni_fotky_orgId_idx" ON "zamereni_fotky"("orgId");

-- CreateIndex
CREATE INDEX "zamereni_definice_orgId_typ_aktivni_idx" ON "zamereni_definice"("orgId", "typ", "aktivni");

-- CreateIndex
CREATE UNIQUE INDEX "zamereni_definice_orgId_typ_verze_key" ON "zamereni_definice"("orgId", "typ", "verze");

-- AddForeignKey
ALTER TABLE "zamereni" ADD CONSTRAINT "zamereni_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zamereni" ADD CONSTRAINT "zamereni_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zamereni" ADD CONSTRAINT "zamereni_definiceId_fkey" FOREIGN KEY ("definiceId") REFERENCES "zamereni_definice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zamereni_fotky" ADD CONSTRAINT "zamereni_fotky_zamereniId_fkey" FOREIGN KEY ("zamereniId") REFERENCES "zamereni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zamereni_definice" ADD CONSTRAINT "zamereni_definice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
