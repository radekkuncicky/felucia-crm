-- CreateEnum
CREATE TYPE "ZakazkaStav" AS ENUM ('NOVA', 'PRIRAZENA', 'V_REALIZACI', 'PREDANA', 'VYUCTOVANA', 'HOTOVO');

-- CreateEnum
CREATE TYPE "ZakazkaPolozkaStav" AS ENUM ('CEKA', 'OBJEDNANO', 'NASKLADNENO', 'VYDANO');

-- CreateEnum
CREATE TYPE "SkladPohybTyp" AS ENUM ('PRIJEM', 'VYDEJ', 'REZERVACE', 'STORNO', 'PRIJEM_SKLAD');

-- CreateEnum
CREATE TYPE "PredavakStav" AS ENUM ('ROZPRACOVAN', 'PODPISAN', 'SCHVALEN', 'ODMITNUTO');

-- CreateEnum
CREATE TYPE "VyuctovaniStav" AS ENUM ('NAVRH', 'KE_SCHVALENI', 'SCHVALENO');

-- CreateTable
CREATE TABLE "zakazky" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "cislo" TEXT NOT NULL,
    "opId" TEXT,
    "klientId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "technologie" TEXT,
    "vedouciId" TEXT,
    "stav" "ZakazkaStav" NOT NULL DEFAULT 'NOVA',
    "poznamka" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uzavreno" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zakazky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technik_zakazky" (
    "id" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "technikId" TEXT NOT NULL,
    "prirazeno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technik_zakazky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakazka_polozky" (
    "id" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "kod" TEXT,
    "mnozstvi" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "jednotka" TEXT NOT NULL DEFAULT 'ks',
    "prodejniCena" DECIMAL(65,30),
    "nakupniCena" DECIMAL(65,30),
    "dphSazba" DECIMAL(65,30) NOT NULL DEFAULT 21,
    "mnozstviPouzito" DECIMAL(65,30),
    "stav" "ZakazkaPolozkaStav" NOT NULL DEFAULT 'CEKA',
    "poradi" INTEGER NOT NULL DEFAULT 0,
    "poznamka" TEXT,

    CONSTRAINT "zakazka_polozky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sklad_pohyby" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "zakazkaId" TEXT,
    "polozkaId" TEXT,
    "typ" "SkladPohybTyp" NOT NULL,
    "nazev" TEXT NOT NULL,
    "mnozstvi" DECIMAL(65,30) NOT NULL,
    "nakupniCena" DECIMAL(65,30),
    "duvod" TEXT,
    "schvalenoId" TEXT,
    "vytvorilId" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sklad_pohyby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predavaky" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "cislo" TEXT NOT NULL,
    "technikId" TEXT NOT NULL,
    "stav" "PredavakStav" NOT NULL DEFAULT 'ROZPRACOVAN',
    "podpisSvg" TEXT,
    "klientPritomen" BOOLEAN NOT NULL DEFAULT true,
    "poznamka" TEXT,
    "odmitnutoDuvod" TEXT,
    "schvalenoId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "podpisano" TIMESTAMP(3),
    "schvaleno" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predavaky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predavak_polozky" (
    "id" TEXT NOT NULL,
    "predavakId" TEXT NOT NULL,
    "zakazkaPolozkaId" TEXT,
    "nazev" TEXT NOT NULL,
    "mnozstviPouzito" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "jednotka" TEXT NOT NULL DEFAULT 'ks',
    "poznamka" TEXT,

    CONSTRAINT "predavak_polozky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predavak_fotky" (
    "id" TEXT NOT NULL,
    "predavakId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "popis" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predavak_fotky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakazka_fotky" (
    "id" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "popis" TEXT,
    "nahralId" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zakazka_fotky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vyuctovani" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "cislo" TEXT NOT NULL,
    "stav" "VyuctovaniStav" NOT NULL DEFAULT 'NAVRH',
    "poznamka" TEXT,
    "schvalenoId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schvaleno" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vyuctovani_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vyuctovani_polozky" (
    "id" TEXT NOT NULL,
    "vyuctovaniId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "mnozstvi" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "jednotka" TEXT NOT NULL DEFAULT 'ks',
    "nakupniCena" DECIMAL(65,30),
    "prodejniCena" DECIMAL(65,30) NOT NULL,
    "dphSazba" DECIMAL(65,30) NOT NULL DEFAULT 21,
    "poradi" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vyuctovani_polozky_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zakazky_orgId_stav_idx" ON "zakazky"("orgId", "stav");

-- CreateIndex
CREATE UNIQUE INDEX "zakazky_orgId_cislo_key" ON "zakazky"("orgId", "cislo");

-- CreateIndex
CREATE UNIQUE INDEX "technik_zakazky_zakazkaId_technikId_key" ON "technik_zakazky"("zakazkaId", "technikId");

-- CreateIndex
CREATE INDEX "sklad_pohyby_orgId_typ_idx" ON "sklad_pohyby"("orgId", "typ");

-- CreateIndex
CREATE INDEX "sklad_pohyby_zakazkaId_idx" ON "sklad_pohyby"("zakazkaId");

-- CreateIndex
CREATE UNIQUE INDEX "predavaky_orgId_cislo_key" ON "predavaky"("orgId", "cislo");

-- CreateIndex
CREATE UNIQUE INDEX "vyuctovani_orgId_cislo_key" ON "vyuctovani"("orgId", "cislo");

-- AddForeignKey
ALTER TABLE "zakazky" ADD CONSTRAINT "zakazky_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazky" ADD CONSTRAINT "zakazky_opId_fkey" FOREIGN KEY ("opId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazky" ADD CONSTRAINT "zakazky_klientId_fkey" FOREIGN KEY ("klientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazky" ADD CONSTRAINT "zakazky_vedouciId_fkey" FOREIGN KEY ("vedouciId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technik_zakazky" ADD CONSTRAINT "technik_zakazky_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technik_zakazky" ADD CONSTRAINT "technik_zakazky_technikId_fkey" FOREIGN KEY ("technikId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazka_polozky" ADD CONSTRAINT "zakazka_polozky_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sklad_pohyby" ADD CONSTRAINT "sklad_pohyby_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sklad_pohyby" ADD CONSTRAINT "sklad_pohyby_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sklad_pohyby" ADD CONSTRAINT "sklad_pohyby_polozkaId_fkey" FOREIGN KEY ("polozkaId") REFERENCES "zakazka_polozky"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sklad_pohyby" ADD CONSTRAINT "sklad_pohyby_vytvorilId_fkey" FOREIGN KEY ("vytvorilId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sklad_pohyby" ADD CONSTRAINT "sklad_pohyby_schvalenoId_fkey" FOREIGN KEY ("schvalenoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predavaky" ADD CONSTRAINT "predavaky_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predavaky" ADD CONSTRAINT "predavaky_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predavaky" ADD CONSTRAINT "predavaky_technikId_fkey" FOREIGN KEY ("technikId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predavaky" ADD CONSTRAINT "predavaky_schvalenoId_fkey" FOREIGN KEY ("schvalenoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predavak_polozky" ADD CONSTRAINT "predavak_polozky_predavakId_fkey" FOREIGN KEY ("predavakId") REFERENCES "predavaky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predavak_polozky" ADD CONSTRAINT "predavak_polozky_zakazkaPolozkaId_fkey" FOREIGN KEY ("zakazkaPolozkaId") REFERENCES "zakazka_polozky"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predavak_fotky" ADD CONSTRAINT "predavak_fotky_predavakId_fkey" FOREIGN KEY ("predavakId") REFERENCES "predavaky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazka_fotky" ADD CONSTRAINT "zakazka_fotky_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazka_fotky" ADD CONSTRAINT "zakazka_fotky_nahralId_fkey" FOREIGN KEY ("nahralId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vyuctovani" ADD CONSTRAINT "vyuctovani_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vyuctovani" ADD CONSTRAINT "vyuctovani_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vyuctovani" ADD CONSTRAINT "vyuctovani_schvalenoId_fkey" FOREIGN KEY ("schvalenoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vyuctovani_polozky" ADD CONSTRAINT "vyuctovani_polozky_vyuctovaniId_fkey" FOREIGN KEY ("vyuctovaniId") REFERENCES "vyuctovani"("id") ON DELETE CASCADE ON UPDATE CASCADE;
