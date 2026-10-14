-- Položková sleva (%) z nabídky se přenáší do zakázky a vyúčtování
ALTER TABLE "zakazka_polozky" ADD COLUMN IF NOT EXISTS "sleva" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "vyuctovani_polozky" ADD COLUMN IF NOT EXISTS "sleva" DECIMAL(5,2) NOT NULL DEFAULT 0;
