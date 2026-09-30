-- ServisniZakazka: evidence odeslání servisního protokolu klientovi e-mailem
ALTER TABLE "servisni_zakazky" ADD COLUMN "protokolOdeslan" TIMESTAMP(3);
ALTER TABLE "servisni_zakazky" ADD COLUMN "protokolOdeslanNa" TEXT;
