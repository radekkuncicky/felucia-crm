-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "prilohaCenikPath" TEXT,
ADD COLUMN     "prilohaVopPath" TEXT,
ADD COLUMN     "prilohaVzspPath" TEXT;

-- AlterTable
ALTER TABLE "sod" ADD COLUMN     "prilohaCenik" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prilohaNabidka" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prilohaVop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prilohaVzsp" BOOLEAN NOT NULL DEFAULT false;
