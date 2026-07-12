-- Reklamace: self-relace na servisni_zakazky (nová zakázka odkazuje na původní)
ALTER TABLE "servisni_zakazky" ADD COLUMN "puvodniZakazkaId" TEXT;

CREATE INDEX "servisni_zakazky_puvodniZakazkaId_idx" ON "servisni_zakazky"("puvodniZakazkaId");

ALTER TABLE "servisni_zakazky" ADD CONSTRAINT "servisni_zakazky_puvodniZakazkaId_fkey" FOREIGN KEY ("puvodniZakazkaId") REFERENCES "servisni_zakazky"("id") ON DELETE SET NULL ON UPDATE CASCADE;
