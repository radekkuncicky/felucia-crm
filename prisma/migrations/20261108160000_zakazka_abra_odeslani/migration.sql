-- Zakázka založená v ABRA Flexi (F2 tlačítko „Založit v ABRA“)
ALTER TABLE "zakazky" ADD COLUMN "abraZakazkaId" INTEGER;
ALTER TABLE "zakazky" ADD COLUMN "abraOdeslano" TIMESTAMP(3);
