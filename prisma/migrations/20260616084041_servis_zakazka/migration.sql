-- Fáze 1: povýšení ServisniNavsteva na ServisniZakazka + child ServisniPolozka.
-- Data-safe: tabulka se PŘEJMENOVÁVÁ (ne drop/create), 22 stávajících řádků zůstává.
-- Stav se mapuje ze ServisStav, cislo se backfilluje. Koncové schéma je shodné
-- s tím, co by Prisma vytvořila čistým create (stejné názvy constraintů/indexů),
-- takže žádný drift.

-- CreateEnum
CREATE TYPE "ServisniZakazkaStav" AS ENUM ('NOVA', 'NAPLANOVANA', 'PROBIHA', 'DOKONCENA', 'VYUCTOVANA', 'UZAVRENA', 'CEKA', 'ZRUSENA', 'REKLAMACE');

-- CreateEnum
CREATE TYPE "ServisniPolozkaTyp" AS ENUM ('PRACE', 'MATERIAL', 'DOPRAVA', 'JINE');

-- Stávající cizí klíče zrušíme, znovu je přidáme pod novými jmény tabulky níže.
ALTER TABLE "servisni_navstevy" DROP CONSTRAINT "servisni_navstevy_klientId_fkey";
ALTER TABLE "servisni_navstevy" DROP CONSTRAINT "servisni_navstevy_kontraktId_fkey";
ALTER TABLE "servisni_navstevy" DROP CONSTRAINT "servisni_navstevy_orgId_fkey";
ALTER TABLE "servisni_navstevy" DROP CONSTRAINT "servisni_navstevy_technikId_fkey";
ALTER TABLE "servisni_navstevy" DROP CONSTRAINT "servisni_navstevy_zarizeniId_fkey";

-- Přejmenování tabulky, PK constraintu a sloupce cisloNavstevy -> cislo.
ALTER TABLE "servisni_navstevy" RENAME TO "servisni_zakazky";
ALTER TABLE "servisni_zakazky" RENAME CONSTRAINT "servisni_navstevy_pkey" TO "servisni_zakazky_pkey";
ALTER TABLE "servisni_zakazky" RENAME COLUMN "cisloNavstevy" TO "cislo";

-- Migrace stavu ServisStav -> ServisniZakazkaStav.
ALTER TABLE "servisni_zakazky" ADD COLUMN "stav_new" "ServisniZakazkaStav";
UPDATE "servisni_zakazky" SET "stav_new" = CASE "stav"::text
  WHEN 'PLANOVANA' THEN 'NAPLANOVANA'::"ServisniZakazkaStav"
  WHEN 'POTVRZENA' THEN 'NAPLANOVANA'::"ServisniZakazkaStav"
  WHEN 'PROBIHA'   THEN 'PROBIHA'::"ServisniZakazkaStav"
  WHEN 'DOKONCENA' THEN 'DOKONCENA'::"ServisniZakazkaStav"
  WHEN 'ZRUSENA'   THEN 'ZRUSENA'::"ServisniZakazkaStav"
  WHEN 'PRESLA'    THEN 'NAPLANOVANA'::"ServisniZakazkaStav"
  ELSE 'NOVA'::"ServisniZakazkaStav"
END;
ALTER TABLE "servisni_zakazky" ALTER COLUMN "stav_new" SET NOT NULL;
ALTER TABLE "servisni_zakazky" DROP COLUMN "stav";
ALTER TABLE "servisni_zakazky" RENAME COLUMN "stav_new" TO "stav";
ALTER TABLE "servisni_zakazky" ALTER COLUMN "stav" SET DEFAULT 'NOVA';

-- planovanyTermin nově nullable (reaktivní zakázka bez termínu).
ALTER TABLE "servisni_zakazky" ALTER COLUMN "planovanyTermin" DROP NOT NULL;

-- Nové sloupce. updatedAt nemá DB default (Prisma @updatedAt), proto backfill + NOT NULL.
ALTER TABLE "servisni_zakazky"
  ADD COLUMN "cekaDuvod" TEXT,
  ADD COLUMN "protokolDokoncen" TIMESTAMP(3),
  ADD COLUMN "vyfakturovano" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vyfakturovanoDatum" TIMESTAMP(3),
  ADD COLUMN "zaplaceno" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "zaplacenoDatum" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "servisni_zakazky" SET "updatedAt" = "vytvoreno";
ALTER TABLE "servisni_zakazky" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Backfill čísel SZ-YY-NNNN (4 číslice). Řada per (org, rok vzniku), pořadí dle data vzniku.
WITH ordered AS (
  SELECT
    "id",
    to_char("vytvoreno", 'YY') AS yy,
    row_number() OVER (
      PARTITION BY "orgId", date_part('year', "vytvoreno")
      ORDER BY "vytvoreno", "id"
    ) AS rn
  FROM "servisni_zakazky"
  WHERE "cislo" IS NULL
)
UPDATE "servisni_zakazky" s
SET "cislo" = 'SZ-' || o.yy || '-' || lpad(o.rn::text, 4, '0')
FROM ordered o
WHERE s."id" = o."id";

-- CreateTable
CREATE TABLE "servisni_polozky" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "servisniZakazkaId" TEXT NOT NULL,
    "typ" "ServisniPolozkaTyp" NOT NULL DEFAULT 'PRACE',
    "popis" TEXT NOT NULL,
    "mnozstvi" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "jednotka" TEXT NOT NULL DEFAULT 'ks',
    "cenaZaJednotku" DECIMAL(12,2),
    "krytoKontraktem" BOOLEAN NOT NULL DEFAULT false,
    "dphSazba" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "poradi" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "servisni_polozky_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servisni_zakazky_orgId_stav_idx" ON "servisni_zakazky"("orgId", "stav");

-- CreateIndex
CREATE INDEX "servisni_zakazky_orgId_planovanyTermin_idx" ON "servisni_zakazky"("orgId", "planovanyTermin");

-- CreateIndex
CREATE UNIQUE INDEX "servisni_zakazky_orgId_cislo_key" ON "servisni_zakazky"("orgId", "cislo");

-- CreateIndex
CREATE INDEX "servisni_polozky_servisniZakazkaId_idx" ON "servisni_polozky"("servisniZakazkaId");

-- AddForeignKey
ALTER TABLE "servisni_zakazky" ADD CONSTRAINT "servisni_zakazky_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_zakazky" ADD CONSTRAINT "servisni_zakazky_kontraktId_fkey" FOREIGN KEY ("kontraktId") REFERENCES "servisni_kontrakty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_zakazky" ADD CONSTRAINT "servisni_zakazky_zarizeniId_fkey" FOREIGN KEY ("zarizeniId") REFERENCES "zarizeni"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_zakazky" ADD CONSTRAINT "servisni_zakazky_klientId_fkey" FOREIGN KEY ("klientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_zakazky" ADD CONSTRAINT "servisni_zakazky_technikId_fkey" FOREIGN KEY ("technikId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_polozky" ADD CONSTRAINT "servisni_polozky_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_polozky" ADD CONSTRAINT "servisni_polozky_servisniZakazkaId_fkey" FOREIGN KEY ("servisniZakazkaId") REFERENCES "servisni_zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;
