-- Protokoly ze zakázky (tlaková zkouška, zaregulování VZT) — typ + vazba na etapu
ALTER TABLE "zakazka_dokumenty" ADD COLUMN "protokolTyp" TEXT;
ALTER TABLE "zakazka_dokumenty" ADD COLUMN "etapaId" TEXT;
CREATE INDEX "zakazka_dokumenty_etapaId_idx" ON "zakazka_dokumenty"("etapaId");
ALTER TABLE "zakazka_dokumenty" ADD CONSTRAINT "zakazka_dokumenty_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "zakazka_etapy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Už vytvořené protokoly (do teď ležely v Podkladech)
UPDATE "zakazka_dokumenty" SET "protokolTyp" = 'TLAKOVA_ZKOUSKA' WHERE "nazev" LIKE 'Protokol o tlakové zkoušce%' AND "mime" = 'application/pdf';
UPDATE "zakazka_dokumenty" SET "protokolTyp" = 'ZAREGULOVANI_VZT' WHERE "nazev" LIKE 'Protokol o zaregulování VZT%' AND "mime" = 'application/pdf';
