-- Stav nabídky vůči klientovi (procesní mapa NANTO 4.1)
CREATE TYPE "QuoteStav" AS ENUM ('ROZPRACOVANA', 'ODESLANA', 'AKCEPTOVANA', 'ODMITNUTA');

ALTER TABLE "quotes" ADD COLUMN "stav" "QuoteStav" NOT NULL DEFAULT 'ROZPRACOVANA';
ALTER TABLE "quotes" ADD COLUMN "stavZmenen" TIMESTAMP(3);

CREATE INDEX "quotes_orgId_stav_idx" ON "quotes"("orgId", "stav");

-- Backfill: aktivní nabídka vyhraného OP = akceptovaná, jinak odeslaná podle odeslanoAt
UPDATE "quotes" q SET "stav" = 'AKCEPTOVANA', "stavZmenen" = COALESCE(q."odeslanoAt", q."vytvoreno")
FROM "deals" d
WHERE d."id" = q."dealId" AND d."stav" = 'USPECH' AND q."aktivni" = true;

UPDATE "quotes" SET "stav" = 'ODESLANA', "stavZmenen" = "odeslanoAt"
WHERE "stav" = 'ROZPRACOVANA' AND "odeslanoAt" IS NOT NULL;
