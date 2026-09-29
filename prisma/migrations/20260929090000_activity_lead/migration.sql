-- Aktivity i na leadu: dealId volitelné, nové leadId, přesně jeden rodič
ALTER TABLE "activities" ALTER COLUMN "dealId" DROP NOT NULL;
ALTER TABLE "activities" ADD COLUMN "leadId" TEXT;

-- CreateIndex
CREATE INDEX "activities_leadId_idx" ON "activities"("leadId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leady"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activities" ADD CONSTRAINT "activities_one_parent_chk" CHECK (num_nonnulls("dealId", "leadId") = 1);

-- Trigger doplnění orgId umí i rodiče lead
CREATE OR REPLACE FUNCTION activities_fill_org_id() RETURNS trigger AS $$
BEGIN
  IF NEW."orgId" IS NULL THEN
    IF NEW."dealId" IS NOT NULL THEN
      SELECT d."orgId" INTO NEW."orgId" FROM "deals" d WHERE d."id" = NEW."dealId";
    ELSIF NEW."leadId" IS NOT NULL THEN
      SELECT l."orgId" INTO NEW."orgId" FROM "leady" l WHERE l."id" = NEW."leadId";
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
