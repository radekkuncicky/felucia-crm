-- AlterEnum
ALTER TYPE "SodUdalostTyp" ADD VALUE 'PRIPOMINKA';

-- AlterTable
ALTER TABLE "sod_podpis_relace" ADD COLUMN     "tokenEnc" TEXT;
