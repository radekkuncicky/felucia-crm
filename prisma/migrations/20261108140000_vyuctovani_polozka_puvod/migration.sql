-- Původ položky vyúčtování (produkt/kód z nabídky) pro porovnání s CN
ALTER TABLE "vyuctovani_polozky" ADD COLUMN "productId" TEXT;
ALTER TABLE "vyuctovani_polozky" ADD COLUMN "kod" TEXT;
