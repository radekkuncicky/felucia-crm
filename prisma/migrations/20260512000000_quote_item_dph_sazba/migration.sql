-- Add dphSazba per-item DPH to quote_items
ALTER TABLE "quote_items" ADD COLUMN "dphSazba" INTEGER NOT NULL DEFAULT 12;

-- Backfill from parent quote's dphSazba where available
UPDATE "quote_items" qi
SET "dphSazba" = q."dphSazba"
FROM "quotes" q
WHERE qi."quoteId" = q."id";
