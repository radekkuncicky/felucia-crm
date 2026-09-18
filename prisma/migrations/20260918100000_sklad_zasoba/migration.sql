-- Sklad v2: reálná zásoba vedená na katalogovém produktu.
-- Nové typy pohybů (STORNO se rozděluje na STORNO_REZERVACE / VRATKA_VYDEJE, přidána KOREKCE),
-- vazba položky zakázky i pohybu na products.id, minimální množství na produktu.
-- Datové přemapování STORNO je v následující migraci — nově přidaná hodnota enumu
-- nejde použít ve stejné transakci, ve které vznikla.
ALTER TYPE "SkladPohybTyp" ADD VALUE IF NOT EXISTS 'STORNO_REZERVACE';
ALTER TYPE "SkladPohybTyp" ADD VALUE IF NOT EXISTS 'VRATKA_VYDEJE';
ALTER TYPE "SkladPohybTyp" ADD VALUE IF NOT EXISTS 'KOREKCE';

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "minMnozstvi" DECIMAL(12,3);

ALTER TABLE "zakazka_polozky" ADD COLUMN IF NOT EXISTS "productId" TEXT;
CREATE INDEX IF NOT EXISTS "zakazka_polozky_productId_idx" ON "zakazka_polozky"("productId");
DO $$ BEGIN
  ALTER TABLE "zakazka_polozky" ADD CONSTRAINT "zakazka_polozky_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "sklad_pohyby" ADD COLUMN IF NOT EXISTS "productId" TEXT;
CREATE INDEX IF NOT EXISTS "sklad_pohyby_orgId_productId_idx" ON "sklad_pohyby"("orgId", "productId");
DO $$ BEGIN
  ALTER TABLE "sklad_pohyby" ADD CONSTRAINT "sklad_pohyby_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
