-- Servis krok 6: úklid po refactoru. Enum ServisStav nahradil ServisniZakazkaStav
-- (žádný sloupec ho nepoužívá) a zakázky typu SERVISNI se už nezakládají (0 řádků).

-- AlterEnum
BEGIN;
CREATE TYPE "ZakazkaTyp_new" AS ENUM ('OBCHODNI');
ALTER TABLE "zakazky" ALTER COLUMN "typ" DROP DEFAULT;
ALTER TABLE "zakazky" ALTER COLUMN "typ" TYPE "ZakazkaTyp_new" USING ("typ"::text::"ZakazkaTyp_new");
ALTER TYPE "ZakazkaTyp" RENAME TO "ZakazkaTyp_old";
ALTER TYPE "ZakazkaTyp_new" RENAME TO "ZakazkaTyp";
DROP TYPE "ZakazkaTyp_old";
ALTER TABLE "zakazky" ALTER COLUMN "typ" SET DEFAULT 'OBCHODNI';
COMMIT;

-- DropEnum
DROP TYPE "ServisStav";
