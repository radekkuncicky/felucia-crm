-- CreateEnum
CREATE TYPE "ServisTyp" AS ENUM ('ROCNI', 'POLOLETNI', 'DVOULETNI', 'JEDNOURAZOVY');

-- CreateEnum
CREATE TYPE "ServisStav" AS ENUM ('PLANOVANA', 'DOKONCENA', 'ZRUSENA', 'PRESLA');

-- CreateTable
CREATE TABLE "servisni_kontrakty" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "klientId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "typ" "ServisTyp" NOT NULL,
    "intervalMesicu" INTEGER NOT NULL,
    "cena" DECIMAL(12,2),
    "zacatek" TIMESTAMP(3) NOT NULL,
    "konec" TIMESTAMP(3),
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "poznamka" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servisni_kontrakty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servisni_navstevy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kontraktId" TEXT NOT NULL,
    "planovanyTermin" TIMESTAMP(3) NOT NULL,
    "skutecnyTermin" TIMESTAMP(3),
    "stav" "ServisStav" NOT NULL DEFAULT 'PLANOVANA',
    "technikId" TEXT,
    "poznamka" TEXT,
    "zprava" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servisni_navstevy_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "servisni_kontrakty" ADD CONSTRAINT "servisni_kontrakty_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_kontrakty" ADD CONSTRAINT "servisni_kontrakty_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_kontrakty" ADD CONSTRAINT "servisni_kontrakty_klientId_fkey" FOREIGN KEY ("klientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_navstevy" ADD CONSTRAINT "servisni_navstevy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_navstevy" ADD CONSTRAINT "servisni_navstevy_kontraktId_fkey" FOREIGN KEY ("kontraktId") REFERENCES "servisni_kontrakty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servisni_navstevy" ADD CONSTRAINT "servisni_navstevy_technikId_fkey" FOREIGN KEY ("technikId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
