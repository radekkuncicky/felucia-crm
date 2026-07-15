-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "shareExpiresAt" TIMESTAMP(3),
ADD COLUMN     "shareTokenEnc" TEXT,
ADD COLUMN     "shareTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "quotes_shareTokenHash_key" ON "quotes"("shareTokenHash");

