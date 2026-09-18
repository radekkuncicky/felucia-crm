-- Dodavatelé + objednávky materiálu (products.dodavatel bylo prázdné u všech řádků → drop)
-- CreateEnum
CREATE TYPE "ObjednavkaStav" AS ENUM ('NAVRH', 'ODESLANA', 'CASTECNE_DORUCENA', 'DORUCENA', 'ZRUSENA');

-- AlterTable
ALTER TABLE "products" DROP COLUMN IF EXISTS "dodavatel";

-- CreateTable
CREATE TABLE "dodavatele" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "ico" TEXT,
    "dic" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "kontaktOsoba" TEXT,
    "ulice" TEXT,
    "mesto" TEXT,
    "psc" TEXT,
    "poznamka" TEXT,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dodavatele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_dodavatele" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "dodavatelId" TEXT NOT NULL,
    "objednaciKod" TEXT,
    "nakupniCena" DECIMAL(12,2),
    "dodaciLhuta" TEXT,
    "hlavni" BOOLEAN NOT NULL DEFAULT false,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_dodavatele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objednavky" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "cislo" TEXT NOT NULL,
    "stav" "ObjednavkaStav" NOT NULL DEFAULT 'NAVRH',
    "dodavatelId" TEXT NOT NULL,
    "zakazkaId" TEXT,
    "zobrazitCeny" BOOLEAN NOT NULL DEFAULT false,
    "pozadovanyTermin" TIMESTAMP(3),
    "poznamka" TEXT,
    "vytvorilId" TEXT NOT NULL,
    "odeslano" TIMESTAMP(3),
    "doruceno" TIMESTAMP(3),
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objednavky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objednavka_polozky" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "objednavkaId" TEXT NOT NULL,
    "productId" TEXT,
    "zakazkaPolozkaId" TEXT,
    "objednaciKod" TEXT,
    "nazev" TEXT NOT NULL,
    "mnozstvi" DECIMAL(12,3) NOT NULL,
    "jednotka" TEXT NOT NULL DEFAULT 'ks',
    "nakupniCena" DECIMAL(12,2),
    "mnozstviDoruceno" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "poradi" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "objednavka_polozky_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dodavatele_orgId_aktivni_idx" ON "dodavatele"("orgId", "aktivni");

-- CreateIndex
CREATE INDEX "product_dodavatele_orgId_dodavatelId_idx" ON "product_dodavatele"("orgId", "dodavatelId");

-- CreateIndex
CREATE UNIQUE INDEX "product_dodavatele_productId_dodavatelId_key" ON "product_dodavatele"("productId", "dodavatelId");

-- CreateIndex
CREATE INDEX "objednavky_orgId_zakazkaId_idx" ON "objednavky"("orgId", "zakazkaId");

-- CreateIndex
CREATE INDEX "objednavky_orgId_dodavatelId_idx" ON "objednavky"("orgId", "dodavatelId");

-- CreateIndex
CREATE INDEX "objednavky_orgId_stav_idx" ON "objednavky"("orgId", "stav");

-- CreateIndex
CREATE UNIQUE INDEX "objednavky_orgId_cislo_key" ON "objednavky"("orgId", "cislo");

-- CreateIndex
CREATE INDEX "objednavka_polozky_orgId_objednavkaId_idx" ON "objednavka_polozky"("orgId", "objednavkaId");

-- CreateIndex
CREATE INDEX "objednavka_polozky_zakazkaPolozkaId_idx" ON "objednavka_polozky"("zakazkaPolozkaId");

-- AddForeignKey
ALTER TABLE "dodavatele" ADD CONSTRAINT "dodavatele_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_dodavatele" ADD CONSTRAINT "product_dodavatele_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_dodavatele" ADD CONSTRAINT "product_dodavatele_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_dodavatele" ADD CONSTRAINT "product_dodavatele_dodavatelId_fkey" FOREIGN KEY ("dodavatelId") REFERENCES "dodavatele"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objednavky" ADD CONSTRAINT "objednavky_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objednavky" ADD CONSTRAINT "objednavky_dodavatelId_fkey" FOREIGN KEY ("dodavatelId") REFERENCES "dodavatele"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objednavky" ADD CONSTRAINT "objednavky_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objednavky" ADD CONSTRAINT "objednavky_vytvorilId_fkey" FOREIGN KEY ("vytvorilId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objednavka_polozky" ADD CONSTRAINT "objednavka_polozky_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objednavka_polozky" ADD CONSTRAINT "objednavka_polozky_objednavkaId_fkey" FOREIGN KEY ("objednavkaId") REFERENCES "objednavky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objednavka_polozky" ADD CONSTRAINT "objednavka_polozky_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objednavka_polozky" ADD CONSTRAINT "objednavka_polozky_zakazkaPolozkaId_fkey" FOREIGN KEY ("zakazkaPolozkaId") REFERENCES "zakazka_polozky"("id") ON DELETE SET NULL ON UPDATE CASCADE;

