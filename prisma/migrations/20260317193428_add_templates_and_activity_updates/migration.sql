-- AlterEnum
ALTER TYPE "TypAktivity" ADD VALUE 'UKOL';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "splneno" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "quote_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "popis" TEXT,
    "technologie" "Technologie",
    "polozky" JSONB NOT NULL DEFAULT '[]',
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
