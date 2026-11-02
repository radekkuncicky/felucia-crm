-- CreateTable
CREATE TABLE "abra_faktury" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "abraId" INTEGER NOT NULL,
    "kod" TEXT NOT NULL,
    "typ" TEXT NOT NULL,
    "typDokl" TEXT NOT NULL,
    "odberatel" TEXT,
    "zakazkaKod" TEXT,
    "zakazkaId" TEXT,
    "etapaCislo" INTEGER,
    "vystaveno" TIMESTAMP(3) NOT NULL,
    "splatnost" TIMESTAMP(3),
    "uhrazeno" TIMESTAMP(3),
    "celkemSDph" DECIMAL(14,2) NOT NULL,
    "celkemBezDph" DECIMAL(14,2) NOT NULL,
    "zbyvaUhradit" DECIMAL(14,2) NOT NULL,
    "stavUhrady" TEXT,
    "synchronizovano" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abra_faktury_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abra_faktury_orgId_zakazkaId_idx" ON "abra_faktury"("orgId", "zakazkaId");

-- CreateIndex
CREATE INDEX "abra_faktury_orgId_vystaveno_idx" ON "abra_faktury"("orgId", "vystaveno");

-- CreateIndex
CREATE UNIQUE INDEX "abra_faktury_orgId_abraId_key" ON "abra_faktury"("orgId", "abraId");

-- AddForeignKey
ALTER TABLE "abra_faktury" ADD CONSTRAINT "abra_faktury_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abra_faktury" ADD CONSTRAINT "abra_faktury_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE SET NULL ON UPDATE CASCADE;

