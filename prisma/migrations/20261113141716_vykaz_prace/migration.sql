-- CreateEnum
CREATE TYPE "VykazTyp" AS ENUM ('VYJEZD', 'POLOZKA');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sazbaHodina" DECIMAL(10,2),
ADD COLUMN     "sazbaKm" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "vykaz_prace" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typ" "VykazTyp" NOT NULL DEFAULT 'VYJEZD',
    "zakazkaId" TEXT,
    "servisniZakazkaId" TEXT,
    "datum" DATE NOT NULL,
    "hodiny" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "km" INTEGER NOT NULL DEFAULT 0,
    "sazbaHodina" DECIMAL(10,2),
    "sazbaKm" DECIMAL(10,2),
    "popis" TEXT,
    "castka" DECIMAL(10,2),
    "poznamka" TEXT,
    "fakturaceId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upraveno" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vykaz_prace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vykaz_fakturace" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cislo" INTEGER NOT NULL,
    "obdobiOd" DATE NOT NULL,
    "obdobiDo" DATE NOT NULL,
    "hodinyCelkem" DECIMAL(8,2) NOT NULL,
    "kmCelkem" INTEGER NOT NULL,
    "castkaCelkem" DECIMAL(12,2) NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vykaz_fakturace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vykaz_prace_orgId_userId_fakturaceId_idx" ON "vykaz_prace"("orgId", "userId", "fakturaceId");

-- CreateIndex
CREATE INDEX "vykaz_prace_zakazkaId_idx" ON "vykaz_prace"("zakazkaId");

-- CreateIndex
CREATE INDEX "vykaz_prace_servisniZakazkaId_idx" ON "vykaz_prace"("servisniZakazkaId");

-- CreateIndex
CREATE INDEX "vykaz_fakturace_orgId_userId_idx" ON "vykaz_fakturace"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "vykaz_fakturace_userId_cislo_key" ON "vykaz_fakturace"("userId", "cislo");

-- AddForeignKey
ALTER TABLE "vykaz_prace" ADD CONSTRAINT "vykaz_prace_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vykaz_prace" ADD CONSTRAINT "vykaz_prace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vykaz_prace" ADD CONSTRAINT "vykaz_prace_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vykaz_prace" ADD CONSTRAINT "vykaz_prace_servisniZakazkaId_fkey" FOREIGN KEY ("servisniZakazkaId") REFERENCES "servisni_zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vykaz_prace" ADD CONSTRAINT "vykaz_prace_fakturaceId_fkey" FOREIGN KEY ("fakturaceId") REFERENCES "vykaz_fakturace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vykaz_fakturace" ADD CONSTRAINT "vykaz_fakturace_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vykaz_fakturace" ADD CONSTRAINT "vykaz_fakturace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
