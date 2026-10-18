-- KPI vedení, fáze 2: zdroj poptávky (docs/kpi-vedeni/01-specifikace.md, KPI 6)

CREATE TABLE "zdroje_poptavky" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "poradi" INTEGER NOT NULL DEFAULT 0,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zdroje_poptavky_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zdroje_poptavky_orgId_kod_key" ON "zdroje_poptavky"("orgId", "kod");

ALTER TABLE "zdroje_poptavky" ADD CONSTRAINT "zdroje_poptavky_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lead: zdroj poptávky + kdo doporučil
ALTER TABLE "leady" ADD COLUMN "zdrojPoptavkyId" TEXT;
ALTER TABLE "leady" ADD COLUMN "doporucilKlientId" TEXT;
ALTER TABLE "leady" ADD COLUMN "doporucilText" TEXT;
ALTER TABLE "leady" ADD CONSTRAINT "leady_zdrojPoptavkyId_fkey" FOREIGN KEY ("zdrojPoptavkyId") REFERENCES "zdroje_poptavky"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leady" ADD CONSTRAINT "leady_doporucilKlientId_fkey" FOREIGN KEY ("doporucilKlientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OP: zdroj poptávky, kdo doporučil, datum výhry
ALTER TABLE "deals" ADD COLUMN "zdrojPoptavkyId" TEXT;
ALTER TABLE "deals" ADD COLUMN "doporucilKlientId" TEXT;
ALTER TABLE "deals" ADD COLUMN "doporucilText" TEXT;
ALTER TABLE "deals" ADD COLUMN "vyhrano" TIMESTAMP(3);
ALTER TABLE "deals" ADD CONSTRAINT "deals_zdrojPoptavkyId_fkey" FOREIGN KEY ("zdrojPoptavkyId") REFERENCES "zdroje_poptavky"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_doporucilKlientId_fkey" FOREIGN KEY ("doporucilKlientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "deals_orgId_vyhrano_idx" ON "deals"("orgId", "vyhrano");

-- Backfill data výhry: poslední přechod na USPECH v audit logu, jinak vznik
-- zakázky (zakládá se při výhře), jinak vznik OP
UPDATE "deals" d SET "vyhrano" = COALESCE(
  (SELECT MAX(a."vytvoreno") FROM "audit_logs" a
    WHERE a."typZaznamu" = 'Deal' AND a."zaznamId" = d."id"
      AND (a."zmeny"->>'stav' = 'USPECH' OR a."zmeny"->'stav'->>'na' = 'USPECH')),
  (SELECT MIN(z."vytvoreno") FROM "zakazky" z WHERE z."opId" = d."id"),
  d."vytvoreno"
)
WHERE d."stav" = 'USPECH';
