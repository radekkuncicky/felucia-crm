-- CreateEnum
CREATE TYPE "ServisPriorita" AS ENUM ('BEZNA', 'URGENTNI');

-- AlterTable
ALTER TABLE "servisni_zakazky" ADD COLUMN     "popis" TEXT,
ADD COLUMN     "priorita" "ServisPriorita" NOT NULL DEFAULT 'BEZNA',
ADD COLUMN     "adresaZasahu" TEXT,
ADD COLUMN     "kontaktJmeno" TEXT,
ADD COLUMN     "kontaktTelefon" TEXT;
