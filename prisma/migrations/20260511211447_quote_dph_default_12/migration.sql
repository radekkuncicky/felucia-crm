-- AlterTable: Change default DPH on quotes from 21 to 12
ALTER TABLE "quotes" ALTER COLUMN "dphSazba" SET DEFAULT 12;
