-- Activity.orgId: přidat jako NULL, dopočítat z deals, pak NOT NULL
ALTER TABLE "activities" ADD COLUMN "orgId" TEXT;
UPDATE "activities" a SET "orgId" = d."orgId" FROM "deals" d WHERE d."id" = a."dealId";
DELETE FROM "activities" WHERE "orgId" IS NULL; -- osiřelé záznamy bez OP (FK je CASCADE, nemělo by existovat)
ALTER TABLE "activities" ALTER COLUMN "orgId" SET NOT NULL;


-- CreateTable
CREATE TABLE "zakazka_ukoly" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "poznamka" TEXT,
    "termin" TIMESTAMP(3),
    "resitelId" TEXT,
    "hotovo" BOOLEAN NOT NULL DEFAULT false,
    "hotovoAt" TIMESTAMP(3),
    "hotovoId" TEXT,
    "poradi" INTEGER NOT NULL DEFAULT 0,
    "vytvorilId" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zakazka_ukoly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zakazka_ukoly_zakazkaId_poradi_idx" ON "zakazka_ukoly"("zakazkaId", "poradi");

-- CreateIndex
CREATE INDEX "zakazka_ukoly_orgId_resitelId_hotovo_termin_idx" ON "zakazka_ukoly"("orgId", "resitelId", "hotovo", "termin");

-- CreateIndex
CREATE INDEX "activities_orgId_resitelId_splneno_datum_idx" ON "activities"("orgId", "resitelId", "splneno", "datum");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazka_ukoly" ADD CONSTRAINT "zakazka_ukoly_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazka_ukoly" ADD CONSTRAINT "zakazka_ukoly_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakazka_ukoly" ADD CONSTRAINT "zakazka_ukoly_resitelId_fkey" FOREIGN KEY ("resitelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

