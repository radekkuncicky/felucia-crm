-- AlterTable
ALTER TABLE "vyuctovani" ADD COLUMN     "predavakId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "vyuctovani_predavakId_key" ON "vyuctovani"("predavakId");

-- AddForeignKey
ALTER TABLE "vyuctovani" ADD CONSTRAINT "vyuctovani_predavakId_fkey" FOREIGN KEY ("predavakId") REFERENCES "predavaky"("id") ON DELETE SET NULL ON UPDATE CASCADE;

