-- ServisniZakazka: klient nebyl při zásahu přítomen → protokol bez podpisu (jako předávák)
ALTER TABLE "servisni_zakazky" ADD COLUMN "klientPritomen" BOOLEAN NOT NULL DEFAULT true;
