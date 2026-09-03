-- AlterTable
ALTER TABLE "leady" ADD COLUMN     "objednavka" TEXT,
ADD COLUMN     "prilohy" TEXT,
ADD COLUMN     "sluzba" TEXT,
ADD COLUMN     "strankaUrl" TEXT,
ADD COLUMN     "zdrojFormulare" TEXT;

-- Backfill: rozebrat hlavičku, kterou dřív lepil buildZprava() do textu zprávy,
-- do samostatných sloupců. Ve "zprava" zůstane jen to, co skutečně napsal klient.
UPDATE "leady" SET
  "zdrojFormulare" = (regexp_match(zprava, '^Zdroj formuláře: (.*)$', 'n'))[1],
  "sluzba"         = (regexp_match(zprava, '^Služba: (.*)$', 'n'))[1],
  "strankaUrl"     = (regexp_match(zprava, '^Stránka: (.*)$', 'n'))[1],
  "prilohy"        = (regexp_match(zprava, '^Přílohy: (.*)$', 'n'))[1],
  "objednavka"     = (regexp_match(zprava, '^Objednávka: (.*)$', 'n'))[1],
  "zprava"         = NULLIF(btrim(regexp_replace(
      zprava,
      '^(Zdroj formuláře:.*\n?)?(Služba:.*\n?)?(Objednávka:.*\n?)?(Přílohy:.*\n?)?(Stránka:.*\n?)?\n?',
      '', 'n')), '')
WHERE zprava LIKE 'Zdroj formuláře:%';
