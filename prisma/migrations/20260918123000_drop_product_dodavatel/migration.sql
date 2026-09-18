-- Sloupec byl během deploye dočasně vrácen, aby běžící build nespadl; po nasazení
-- nové verze (která ho nečte) se odstraní definitivně.
ALTER TABLE "products" DROP COLUMN IF EXISTS "dodavatel";
