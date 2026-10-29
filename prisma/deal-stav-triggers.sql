-- Triggery historie stavů OP (deal_stav_zmeny). Idempotentní.
-- Zdroj pravdy pro trigger DDL — migrace 20261029180000_deal_stav_historie
-- obsahuje tentýž kód (pro prod migrate flow); test DB vznikají přes
-- `prisma db push`, který triggery nezná, proto je aplikují tests/setup.ts
-- a scripts/e2e-env.sh z tohoto souboru. Při změně uprav OBOJE.

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
