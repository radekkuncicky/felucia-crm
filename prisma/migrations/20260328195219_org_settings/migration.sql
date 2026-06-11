-- CreateTable
CREATE TABLE "org_settings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "modulServis" BOOLEAN NOT NULL DEFAULT true,
    "modulAnalytiky" BOOLEAN NOT NULL DEFAULT true,
    "modulDokumenty" BOOLEAN NOT NULL DEFAULT true,
    "modulDasa" BOOLEAN NOT NULL DEFAULT true,
    "modulCeniky" BOOLEAN NOT NULL DEFAULT true,
    "povinnaAktivitaUOP" BOOLEAN NOT NULL DEFAULT false,
    "automatickyServis" BOOLEAN NOT NULL DEFAULT true,
    "schvaleniNabidky" BOOLEAN NOT NULL DEFAULT false,
    "notifOpBezAktivity" BOOLEAN NOT NULL DEFAULT true,
    "notifBlizkTermin" BOOLEAN NOT NULL DEFAULT true,
    "notifNovyOP" BOOLEAN NOT NULL DEFAULT true,
    "notifDniBezeAktivity" INTEGER NOT NULL DEFAULT 7,
    "defaultDphSazba" INTEGER NOT NULL DEFAULT 12,
    "defaultPlatnostDni" INTEGER NOT NULL DEFAULT 30,
    "zobrazitNakladoveCeny" BOOLEAN NOT NULL DEFAULT false,
    "primaryColor" TEXT NOT NULL DEFAULT '#FFC93C',

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_settings_orgId_key" ON "org_settings"("orgId");

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
