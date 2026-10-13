-- KPI vedení, fáze 1 (docs/kpi-vedeni/01-specifikace.md)

-- Role jednatel (vše jako ADMIN + KPI)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'JEDNATEL' BEFORE 'ADMIN';

-- Modul KPI (zapíná se ručně v DB per org)
ALTER TABLE "org_settings" ADD COLUMN "modulKpi" BOOLEAN NOT NULL DEFAULT false;

-- Kategorie výdeje ze skladu bez zakázky
CREATE TYPE "SkladKategorie" AS ENUM ('PROVOZNI_SPOTREBA', 'JINE');
ALTER TABLE "sklad_pohyby" ADD COLUMN "kategorie" "SkladKategorie";

-- Nastavení KPI per org
CREATE TABLE "kpi_nastaveni" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "cil" DECIMAL(14,2),
    "poradi" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_nastaveni_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kpi_nastaveni_orgId_kod_key" ON "kpi_nastaveni"("orgId", "kod");

ALTER TABLE "kpi_nastaveni" ADD CONSTRAINT "kpi_nastaveni_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
