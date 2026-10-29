-- CreateTable
CREATE TABLE "deal_stav_zmeny" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "zStavu" "StavDealu",
    "naStav" "StavDealu" NOT NULL,
    "zmenilId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_stav_zmeny_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_stav_zmeny_dealId_vytvoreno_idx" ON "deal_stav_zmeny"("dealId", "vytvoreno");

-- CreateIndex
CREATE INDEX "deal_stav_zmeny_orgId_vytvoreno_idx" ON "deal_stav_zmeny"("orgId", "vytvoreno");

-- AddForeignKey
ALTER TABLE "deal_stav_zmeny" ADD CONSTRAINT "deal_stav_zmeny_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_stav_zmeny" ADD CONSTRAINT "deal_stav_zmeny_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_stav_zmeny" ADD CONSTRAINT "deal_stav_zmeny_zmenilId_fkey" FOREIGN KEY ("zmenilId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Zápis historie triggerem ────────────────────────────────────────────────
-- Tentýž kód je v prisma/deal-stav-triggers.sql (test DB přes db push triggery
-- nezná — aplikují ho tests/setup.ts a scripts/e2e-env.sh). Při změně uprav OBOJE.
-- Stav OP se mění z mnoha míst (web, appka, Dáša, podpis smlouvy, převod leadu,
-- webhook…), proto historii píše DB. SECURITY DEFINER: zápis nezávisí na RLS
-- kontextu volajícího (webhooky jedou bez app.org_id).

CREATE OR REPLACE FUNCTION deal_stav_zmena_zapis() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."stav" IS DISTINCT FROM OLD."stav" THEN
    INSERT INTO "deal_stav_zmeny" ("id", "orgId", "dealId", "zStavu", "naStav", "vytvoreno")
    VALUES (
      gen_random_uuid()::text, NEW."orgId", NEW."id",
      CASE WHEN TG_OP = 'UPDATE' THEN OLD."stav" END, NEW."stav",
      CASE WHEN TG_OP = 'INSERT' THEN NEW."vytvoreno" ELSE clock_timestamp() END
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deal_stav_zmena ON "deals";
CREATE TRIGGER deal_stav_zmena AFTER INSERT OR UPDATE OF "stav" ON "deals"
FOR EACH ROW EXECUTE FUNCTION deal_stav_zmena_zapis();

-- Kdo změnil: aplikace k změně stavu píše audit_logs (typZaznamu Deal, zmeny.stav)
-- s userId — ten se připíše k čerstvé změně téhož OP do stejného stavu.
CREATE OR REPLACE FUNCTION deal_stav_zmena_kdo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  na text := CASE jsonb_typeof(NEW."zmeny"->'stav')
    WHEN 'string' THEN NEW."zmeny"->>'stav'
    WHEN 'object' THEN NEW."zmeny"->'stav'->>'na' END;
BEGIN
  IF NEW."typZaznamu" = 'Deal' AND NEW."userId" IS NOT NULL AND na IS NOT NULL THEN
    UPDATE "deal_stav_zmeny" SET "zmenilId" = NEW."userId"
    WHERE "id" = (
      SELECT "id" FROM "deal_stav_zmeny"
      WHERE "dealId" = NEW."zaznamId" AND "zmenilId" IS NULL AND "naStav"::text = na
        AND "vytvoreno" > clock_timestamp() - interval '2 minutes'
      ORDER BY "vytvoreno" DESC LIMIT 1
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deal_stav_zmena_kdo ON "audit_logs";
CREATE TRIGGER deal_stav_zmena_kdo AFTER INSERT ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION deal_stav_zmena_kdo();

-- ─── Zpětné doplnění z audit_logs (eviduje se od 30. 3. 2026) ───────────────
-- Počáteční záznam k datu založení: stav „z" první zaznamenané změny, jinak
-- NOVY (OP vznikají jako nové); OP bez jediné změny dostanou aktuální stav.
-- Po sobě jdoucí stejné stavy (opakované uložení) se slučují.

WITH zmeny AS (
  SELECT a."zaznamId" AS deal_id, a."vytvoreno", a."userId",
    CASE jsonb_typeof(a."zmeny"->'stav')
      WHEN 'string' THEN a."zmeny"->>'stav'
      WHEN 'object' THEN a."zmeny"->'stav'->>'na' END AS na,
    CASE WHEN jsonb_typeof(a."zmeny"->'stav') = 'object' THEN a."zmeny"->'stav'->>'z' END AS z
  FROM "audit_logs" a
  JOIN "deals" d ON d."id" = a."zaznamId" AND d."orgId" = a."orgId"
  WHERE a."typZaznamu" = 'Deal'
),
platne AS (
  SELECT * FROM zmeny
  WHERE na IN ('NOVY','JEDNANI','NABIDKA','PRED_UZAVRENIM','USPECH','PAS','ZNEPLATNENO')
),
prvni AS (
  SELECT DISTINCT ON (deal_id) deal_id, z FROM platne ORDER BY deal_id, "vytvoreno"
),
udalosti AS (
  SELECT d."id" AS deal_id, d."orgId", d."vytvoreno",
    CASE
      WHEN p.deal_id IS NULL THEN d."stav"::text
      WHEN p.z IN ('NOVY','JEDNANI','NABIDKA','PRED_UZAVRENIM','USPECH','PAS','ZNEPLATNENO') THEN p.z
      ELSE 'NOVY'
    END AS na,
    NULL::text AS user_id, 0 AS poradi
  FROM "deals" d LEFT JOIN prvni p ON p.deal_id = d."id"
  UNION ALL
  SELECT z.deal_id, d."orgId", GREATEST(z."vytvoreno", d."vytvoreno"), z.na, z."userId", 1
  FROM platne z JOIN "deals" d ON d."id" = z.deal_id
),
serazene AS (
  SELECT *, LAG(na) OVER (PARTITION BY deal_id ORDER BY "vytvoreno", poradi) AS pred
  FROM udalosti
)
INSERT INTO "deal_stav_zmeny" ("id", "orgId", "dealId", "zStavu", "naStav", "zmenilId", "vytvoreno")
SELECT gen_random_uuid()::text, "orgId", deal_id, pred::"StavDealu", na::"StavDealu",
  (SELECT u."id" FROM "users" u WHERE u."id" = user_id), "vytvoreno"
FROM serazene
WHERE pred IS NULL OR pred <> na;

-- Kde historie nesedí s aktuálním stavem (změna mimo audit), dorovnat k poslední známé změně
INSERT INTO "deal_stav_zmeny" ("id", "orgId", "dealId", "zStavu", "naStav", "vytvoreno")
SELECT gen_random_uuid()::text, d."orgId", d."id", h."naStav", d."stav", h."vytvoreno" + interval '1 second'
FROM "deals" d
JOIN LATERAL (
  SELECT "naStav", "vytvoreno" FROM "deal_stav_zmeny" WHERE "dealId" = d."id" ORDER BY "vytvoreno" DESC LIMIT 1
) h ON true
WHERE h."naStav" <> d."stav";
