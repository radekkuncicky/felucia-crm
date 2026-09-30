-- Technici přiřazení k etapám zakázky (přístup k zakázce dál řídí technik_zakazky)
CREATE TABLE "etapa_technici" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "technikId" TEXT NOT NULL,
    "prirazeno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapa_technici_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etapa_technici_etapaId_technikId_key" ON "etapa_technici"("etapaId", "technikId");
CREATE INDEX "etapa_technici_technikId_idx" ON "etapa_technici"("technikId");

-- AddForeignKey
ALTER TABLE "etapa_technici" ADD CONSTRAINT "etapa_technici_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etapa_technici" ADD CONSTRAINT "etapa_technici_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "zakazka_etapy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "etapa_technici" ADD CONSTRAINT "etapa_technici_technikId_fkey" FOREIGN KEY ("technikId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
