-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OBCHODNIK', 'TECHNIK');

-- CreateEnum
CREATE TYPE "Technologie" AS ENUM ('KLIMA', 'TEPELNE_CERPADLO', 'REKUPERACE', 'PODLAHOVE_TOPENI', 'VZDUCHOTECHNIKA', 'JINE');

-- CreateEnum
CREATE TYPE "StavDealu" AS ENUM ('NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM', 'USPECH', 'PAS');

-- CreateEnum
CREATE TYPE "TypAktivity" AS ENUM ('HOVOR', 'EMAIL', 'SCHUZKA', 'POZNAMKA');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT,
    "telefon" TEXT,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jmeno" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hesloHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OBCHODNIK',
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jmeno" TEXT NOT NULL,
    "prijmeni" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "technologie" "Technologie" NOT NULL,
    "stav" "StavDealu" NOT NULL DEFAULT 'NOVY',
    "predmet" TEXT,
    "hodnotaZalohy" DECIMAL(12,2),
    "splatnostZalohy" TIMESTAMP(3),
    "terminPrevzeti" TIMESTAMP(3),
    "terminRealizace" TIMESTAMP(3),
    "cisloSmlouvy" TEXT,
    "adresaDila" TEXT,
    "kontaktniOsoba" TEXT,
    "kontaktniTelefon" TEXT,
    "poznamky" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "kategorie" TEXT,
    "cena" DECIMAL(12,2) NOT NULL,
    "jednotka" TEXT NOT NULL DEFAULT 'ks',
    "aktivni" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "productId" TEXT,
    "nazev" TEXT NOT NULL,
    "mnozstvi" DECIMAL(10,3) NOT NULL,
    "cenaZaKus" DECIMAL(12,2) NOT NULL,
    "poznamky" TEXT,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT,
    "typ" "TypAktivity" NOT NULL,
    "popis" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_orgId_email_key" ON "users"("orgId", "email");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
