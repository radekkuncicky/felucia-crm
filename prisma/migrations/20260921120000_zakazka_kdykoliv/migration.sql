-- Zakazka.kdykoliv: příznak „lze montovat kdykoliv" (výplň volného místa ve výjezdu)
ALTER TABLE "zakazky" ADD COLUMN "kdykoliv" BOOLEAN NOT NULL DEFAULT false;
