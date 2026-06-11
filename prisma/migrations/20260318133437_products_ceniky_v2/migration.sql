-- AlterTable
ALTER TABLE "products" ADD COLUMN     "dphSazba" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "kod" TEXT,
ADD COLUMN     "popis" TEXT,
ADD COLUMN     "produktovaRada" TEXT,
ADD COLUMN     "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ceniky" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "popis" TEXT,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ceniky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cenik_polozky" (
    "id" TEXT NOT NULL,
    "cenikId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cena" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "cenik_polozky_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ceniky_orgId_kod_key" ON "ceniky"("orgId", "kod");

-- CreateIndex
CREATE UNIQUE INDEX "cenik_polozky_cenikId_productId_key" ON "cenik_polozky"("cenikId", "productId");

-- AddForeignKey
ALTER TABLE "ceniky" ADD CONSTRAINT "ceniky_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenik_polozky" ADD CONSTRAINT "cenik_polozky_cenikId_fkey" FOREIGN KEY ("cenikId") REFERENCES "ceniky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenik_polozky" ADD CONSTRAINT "cenik_polozky_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
