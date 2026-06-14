-- CreateTable
CREATE TABLE "zakazka_kontakty" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "profese" TEXT NOT NULL,
    "jmeno" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "poznamka" TEXT,
    "vytvorilId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zakazka_kontakty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zakazka_kontakty_zakazkaId_idx" ON "zakazka_kontakty"("zakazkaId");

-- CreateIndex
CREATE INDEX "zakazka_kontakty_orgId_idx" ON "zakazka_kontakty"("orgId");

-- AddForeignKey
ALTER TABLE "zakazka_kontakty" ADD CONSTRAINT "zakazka_kontakty_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;
