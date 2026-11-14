-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "mobileId" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "mobileId" TEXT;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "gpsLat" DOUBLE PRECISION,
ADD COLUMN     "gpsLng" DOUBLE PRECISION,
ADD COLUMN     "mobileId" TEXT;

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "fotoStitky" JSONB;

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "autorId" TEXT,
ADD COLUMN     "gpsLat" DOUBLE PRECISION,
ADD COLUMN     "gpsLng" DOUBLE PRECISION,
ADD COLUMN     "mobileId" TEXT,
ADD COLUMN     "popis" TEXT,
ADD COLUMN     "tag" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pushTokenSales" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "activities_mobileId_key" ON "activities"("mobileId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_mobileId_key" ON "clients"("mobileId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_mobileId_key" ON "deals"("mobileId");

-- CreateIndex
CREATE UNIQUE INDEX "photos_mobileId_key" ON "photos"("mobileId");

-- CreateIndex
CREATE INDEX "photos_dealId_idx" ON "photos"("dealId");
