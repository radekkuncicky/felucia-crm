-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "cil" TEXT,
ADD COLUMN     "resitelId" TEXT,
ADD COLUMN     "vysledek" TEXT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_resitelId_fkey" FOREIGN KEY ("resitelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
