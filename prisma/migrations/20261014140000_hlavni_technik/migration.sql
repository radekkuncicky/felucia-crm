-- Hlavní technik zakázky / etapy (jeden z přiřazených techniků)
ALTER TABLE "zakazky" ADD COLUMN IF NOT EXISTS "hlavniTechnikId" TEXT;
ALTER TABLE "zakazka_etapy" ADD COLUMN IF NOT EXISTS "hlavniTechnikId" TEXT;

ALTER TABLE "zakazky" ADD CONSTRAINT "zakazky_hlavniTechnikId_fkey"
  FOREIGN KEY ("hlavniTechnikId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "zakazka_etapy" ADD CONSTRAINT "zakazka_etapy_hlavniTechnikId_fkey"
  FOREIGN KEY ("hlavniTechnikId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stávající zakázky/etapy: hlavní = první přiřazený technik
UPDATE "zakazky" z SET "hlavniTechnikId" = t."technikId"
FROM (
  SELECT DISTINCT ON ("zakazkaId") "zakazkaId", "technikId"
  FROM "technik_zakazky" ORDER BY "zakazkaId", "prirazeno" ASC
) t
WHERE t."zakazkaId" = z."id" AND z."hlavniTechnikId" IS NULL;

UPDATE "zakazka_etapy" e SET "hlavniTechnikId" = t."technikId"
FROM (
  SELECT DISTINCT ON ("etapaId") "etapaId", "technikId"
  FROM "etapa_technici" ORDER BY "etapaId", "prirazeno" ASC
) t
WHERE t."etapaId" = e."id" AND e."hlavniTechnikId" IS NULL;
