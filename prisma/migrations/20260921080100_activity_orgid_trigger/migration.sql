-- Bezpečnostní síť: klient bez orgId (starý build, webhook) → dopočítat z deals.
-- BEFORE trigger běží před kontrolou NOT NULL.
CREATE OR REPLACE FUNCTION activities_fill_org_id() RETURNS trigger AS $$
BEGIN
  IF NEW."orgId" IS NULL THEN
    SELECT d."orgId" INTO NEW."orgId" FROM "deals" d WHERE d."id" = NEW."dealId";
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activities_fill_org_id ON "activities";
CREATE TRIGGER activities_fill_org_id
  BEFORE INSERT ON "activities"
  FOR EACH ROW EXECUTE FUNCTION activities_fill_org_id();
