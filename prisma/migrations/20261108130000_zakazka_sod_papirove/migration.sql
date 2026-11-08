-- SOD podepsaná papírově mimo Felucii (ruční příznak na zakázce)
ALTER TABLE "zakazky" ADD COLUMN "sodPapirovePodepsano" TIMESTAMP(3);
ALTER TABLE "zakazky" ADD COLUMN "sodPapirovePodepsalJmeno" TEXT;
