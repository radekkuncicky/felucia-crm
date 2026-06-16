-- NÁVRH migrace Fáze 1 - servisní zakázka. NESPOUŠTĚT.
-- Slouží jen k review logiky data-migrace. Finální migraci vygeneruje
-- `prisma migrate dev --name servis_zakazka`; tuto data-část (krok 3) do ní doplníme ručně.

BEGIN;

-- 1. Nové enum typy
CREATE TYPE "ServisniZakazkaStav" AS ENUM (
  'NOVA', 'NAPLANOVANA', 'PROBIHA', 'DOKONCENA',
  'VYUCTOVANA', 'UZAVRENA', 'CEKA', 'ZRUSENA', 'REKLAMACE'
);
CREATE TYPE "ServisniPolozkaTyp" AS ENUM ('PRACE', 'MATERIAL', 'DOPRAVA', 'JINE');

-- 2. Přejmenování tabulky a sloupce
ALTER TABLE "servisni_navstevy" RENAME TO "servisni_zakazky";
ALTER TABLE "servisni_zakazky" RENAME COLUMN "cisloNavstevy" TO "cislo";

-- 3. Migrace stavu (ServisStav -> ServisniZakazkaStav)
ALTER TABLE "servisni_zakazky" ADD COLUMN "stav_new" "ServisniZakazkaStav";
UPDATE "servisni_zakazky" SET "stav_new" = CASE "stav"::text
  WHEN 'PLANOVANA'  THEN 'NAPLANOVANA'::"ServisniZakazkaStav"
  WHEN 'POTVRZENA'  THEN 'NAPLANOVANA'::"ServisniZakazkaStav"
  WHEN 'PROBIHA'    THEN 'PROBIHA'::"ServisniZakazkaStav"
  WHEN 'DOKONCENA'  THEN 'DOKONCENA'::"ServisniZakazkaStav"
  WHEN 'ZRUSENA'    THEN 'ZRUSENA'::"ServisniZakazkaStav"
  WHEN 'PRESLA'     THEN 'NAPLANOVANA'::"ServisniZakazkaStav"
  ELSE 'NOVA'::"ServisniZakazkaStav"
END;
ALTER TABLE "servisni_zakazky" ALTER COLUMN "stav_new" SET NOT NULL;
ALTER TABLE "servisni_zakazky" ALTER COLUMN "stav_new" SET DEFAULT 'NOVA';
ALTER TABLE "servisni_zakazky" DROP COLUMN "stav";
ALTER TABLE "servisni_zakazky" RENAME COLUMN "stav_new" TO "stav";

-- 4. planovanyTermin nově nullable (reaktivní zakázka bez termínu)
ALTER TABLE "servisni_zakazky" ALTER COLUMN "planovanyTermin" DROP NOT NULL;

-- 5. Nové sloupce
ALTER TABLE "servisni_zakazky"
  ADD COLUMN "cekaDuvod"          TEXT,
  ADD COLUMN "protokolDokoncen"   TIMESTAMP(3),
  ADD COLUMN "vyfakturovano"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vyfakturovanoDatum" TIMESTAMP(3),
  ADD COLUMN "zaplaceno"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "zaplacenoDatum"     TIMESTAMP(3),
  ADD COLUMN "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT now();

-- 6. Indexy
CREATE INDEX "servisni_zakazky_orgId_stav_idx" ON "servisni_zakazky" ("orgId", "stav");
CREATE INDEX "servisni_zakazky_orgId_planovanyTermin_idx" ON "servisni_zakazky" ("orgId", "planovanyTermin");

-- 7. Child tabulka položek vyúčtování
CREATE TABLE "servisni_polozky" (
  "id"                TEXT NOT NULL,
  "orgId"             TEXT NOT NULL,
  "servisniZakazkaId" TEXT NOT NULL,
  "typ"               "ServisniPolozkaTyp" NOT NULL DEFAULT 'PRACE',
  "popis"             TEXT NOT NULL,
  "mnozstvi"          DECIMAL(12,2) NOT NULL DEFAULT 1,
  "jednotka"          TEXT NOT NULL DEFAULT 'ks',
  "cenaZaJednotku"    DECIMAL(12,2),
  "krytoKontraktem"   BOOLEAN NOT NULL DEFAULT false,
  "dphSazba"          DECIMAL(5,2) NOT NULL DEFAULT 21,
  "poradi"            INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "servisni_polozky_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "servisni_polozky_servisniZakazkaId_idx" ON "servisni_polozky" ("servisniZakazkaId");
ALTER TABLE "servisni_polozky"
  ADD CONSTRAINT "servisni_polozky_servisniZakazkaId_fkey"
  FOREIGN KEY ("servisniZakazkaId") REFERENCES "servisni_zakazky" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "servisni_polozky"
  ADD CONSTRAINT "servisni_polozky_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pozn.: starý typ "ServisStav" nezahazujeme hned - může ho používat jiný kód.
-- DROP TYPE "ServisStav" až po ověření, že nikdo nereferencuje (samostatný krok).

COMMIT;
