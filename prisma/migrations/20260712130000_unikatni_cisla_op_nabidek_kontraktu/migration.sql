-- Unikátní čísla dokladů per organizace.
-- deals_orgId_kod_key a quotes_orgId_kod_key byly vytvořeny ručně 2026-07-12
-- (spolu s opravou existujících duplicit), proto IF NOT EXISTS.
CREATE UNIQUE INDEX IF NOT EXISTS "deals_orgId_kod_key" ON "deals"("orgId", "kod");
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_orgId_kod_key" ON "quotes"("orgId", "kod");
CREATE UNIQUE INDEX IF NOT EXISTS "servisni_kontrakty_orgId_cisloKontraktu_key" ON "servisni_kontrakty"("orgId", "cisloKontraktu");
