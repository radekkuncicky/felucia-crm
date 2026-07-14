-- CreateEnum
CREATE TYPE "SodStav" AS ENUM ('NAVRH', 'ODESLANO', 'PODEPSANO', 'EXPIROVANO', 'STORNO');

-- CreateEnum
CREATE TYPE "SodUdalostTyp" AS ENUM ('VYTVORENO', 'REVIZE', 'ODESLANO', 'ZOBRAZENO', 'OTP_ODESLAN', 'OTP_OVERENO', 'OTP_CHYBA', 'PODEPSANO', 'ZNEPLATNENO', 'EXPIROVANO', 'STORNO');

-- CreateEnum
CREATE TYPE "PodpisRelaceStav" AS ENUM ('AKTIVNI', 'PODEPSANA', 'ZNEPLATNENA', 'EXPIROVANA');

-- AlterTable
ALTER TABLE "sod" ADD COLUMN     "podepsalJmeno" TEXT,
ADD COLUMN     "podepsano" TIMESTAMP(3),
ADD COLUMN     "podpisIp" TEXT,
ADD COLUMN     "podpisSvg" TEXT,
ADD COLUMN     "podpisTextHash" TEXT,
ADD COLUMN     "podpisUserAgent" TEXT,
ADD COLUMN     "stav" "SodStav" NOT NULL DEFAULT 'NAVRH';

-- CreateTable
CREATE TABLE "sod_verze" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sodId" TEXT NOT NULL,
    "cislo" INTEGER NOT NULL,
    "textSmlouvy" TEXT NOT NULL,
    "vytvorilId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sod_verze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sod_udalosti" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sodId" TEXT NOT NULL,
    "relaceId" TEXT,
    "typ" "SodUdalostTyp" NOT NULL,
    "meta" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sod_udalosti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sod_podpis_relace" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sodId" TEXT NOT NULL,
    "verzeId" TEXT,
    "stav" "PodpisRelaceStav" NOT NULL DEFAULT 'AKTIVNI',
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "expirace" TIMESTAMP(3) NOT NULL,
    "otpHash" TEXT,
    "otpExpirace" TIMESTAMP(3),
    "otpPokusy" INTEGER NOT NULL DEFAULT 0,
    "otpOvereno" TIMESTAMP(3),
    "odeslalId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sod_podpis_relace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sod_verze_sodId_cislo_key" ON "sod_verze"("sodId", "cislo");

-- CreateIndex
CREATE INDEX "sod_udalosti_sodId_idx" ON "sod_udalosti"("sodId");

-- CreateIndex
CREATE UNIQUE INDEX "sod_podpis_relace_tokenHash_key" ON "sod_podpis_relace"("tokenHash");

-- CreateIndex
CREATE INDEX "sod_podpis_relace_sodId_idx" ON "sod_podpis_relace"("sodId");

-- AddForeignKey
ALTER TABLE "sod_verze" ADD CONSTRAINT "sod_verze_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_verze" ADD CONSTRAINT "sod_verze_sodId_fkey" FOREIGN KEY ("sodId") REFERENCES "sod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_udalosti" ADD CONSTRAINT "sod_udalosti_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_udalosti" ADD CONSTRAINT "sod_udalosti_sodId_fkey" FOREIGN KEY ("sodId") REFERENCES "sod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_podpis_relace" ADD CONSTRAINT "sod_podpis_relace_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_podpis_relace" ADD CONSTRAINT "sod_podpis_relace_sodId_fkey" FOREIGN KEY ("sodId") REFERENCES "sod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
