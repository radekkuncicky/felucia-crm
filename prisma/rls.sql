-- GENEROVÁNO scripts/generate-rls-sql.ts — NEEDITOVAT RUČNĚ.
-- Idempotentní. Aplikace: psql <DB_URL> -f prisma/rls.sql (jako owner nanto či superuser).
-- Role nanto_app musí existovat (jednorázově: CREATE ROLE nanto_app LOGIN PASSWORD '…' NOBYPASSRLS).
--
-- Princip: orgPrisma se připojuje jako nanto_app a před dotazy nastavuje
-- app.org_id (set_config, transaction-local). Policy bez kontextu nic
-- nevrátí (fail-closed). Bare prisma (auth/superadmin/worker/migrace) se
-- připojuje jako owner nanto, kterého RLS neomezuje (bez FORCE).

GRANT USAGE ON SCHEMA public TO nanto_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nanto_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nanto_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nanto IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nanto_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nanto IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nanto_app;

-- AiUsageLog
ALTER TABLE "ai_usage_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "ai_usage_logs";
CREATE POLICY org_rls ON "ai_usage_logs" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- ApiKey
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "api_keys";
CREATE POLICY org_rls ON "api_keys" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- AuditLog
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "audit_logs";
CREATE POLICY org_rls ON "audit_logs" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Category
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "categories";
CREATE POLICY org_rls ON "categories" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Cenik
ALTER TABLE "ceniky" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "ceniky";
CREATE POLICY org_rls ON "ceniky" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Client
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "clients";
CREATE POLICY org_rls ON "clients" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- ContractTemplate
ALTER TABLE "contract_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "contract_templates";
CREATE POLICY org_rls ON "contract_templates" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- CustomFieldValue
ALTER TABLE "custom_field_values" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "custom_field_values";
CREATE POLICY org_rls ON "custom_field_values" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- CustomField
ALTER TABLE "custom_fields" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "custom_fields";
CREATE POLICY org_rls ON "custom_fields" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Deal
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "deals";
CREATE POLICY org_rls ON "deals" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Document
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "documents";
CREATE POLICY org_rls ON "documents" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Extension
ALTER TABLE "extensions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "extensions";
CREATE POLICY org_rls ON "extensions" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Lead
ALTER TABLE "leady" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "leady";
CREATE POLICY org_rls ON "leady" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Notification
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "notifications";
CREATE POLICY org_rls ON "notifications" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- OrgSettings
ALTER TABLE "org_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "org_settings";
CREATE POLICY org_rls ON "org_settings" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- OrgTemplateMapping
ALTER TABLE "org_template_mappings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "org_template_mappings";
CREATE POLICY org_rls ON "org_template_mappings" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Photo
ALTER TABLE "photos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "photos";
CREATE POLICY org_rls ON "photos" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Predavak
ALTER TABLE "predavaky" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "predavaky";
CREATE POLICY org_rls ON "predavaky" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Product
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "products";
CREATE POLICY org_rls ON "products" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- QuoteTemplate
ALTER TABLE "quote_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "quote_templates";
CREATE POLICY org_rls ON "quote_templates" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Quote
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "quotes";
CREATE POLICY org_rls ON "quotes" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- ServisniKontrakt
ALTER TABLE "servisni_kontrakty" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "servisni_kontrakty";
CREATE POLICY org_rls ON "servisni_kontrakty" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- ServisniPolozka
ALTER TABLE "servisni_polozky" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "servisni_polozky";
CREATE POLICY org_rls ON "servisni_polozky" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- ServisniZakazka
ALTER TABLE "servisni_zakazky" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "servisni_zakazky";
CREATE POLICY org_rls ON "servisni_zakazky" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- SkladPohyb
ALTER TABLE "sklad_pohyby" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "sklad_pohyby";
CREATE POLICY org_rls ON "sklad_pohyby" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Sod
ALTER TABLE "sod" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "sod";
CREATE POLICY org_rls ON "sod" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- User
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "users";
CREATE POLICY org_rls ON "users" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- VisibilityNode
ALTER TABLE "visibility_nodes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "visibility_nodes";
CREATE POLICY org_rls ON "visibility_nodes" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Vyuctovani
ALTER TABLE "vyuctovani" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "vyuctovani";
CREATE POLICY org_rls ON "vyuctovani" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- ZakázkaDokument
ALTER TABLE "zakazka_dokumenty" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "zakazka_dokumenty";
CREATE POLICY org_rls ON "zakazka_dokumenty" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- ZakazkaEtapa
ALTER TABLE "zakazka_etapy" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "zakazka_etapy";
CREATE POLICY org_rls ON "zakazka_etapy" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- ZakazkaKontakt
ALTER TABLE "zakazka_kontakty" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "zakazka_kontakty";
CREATE POLICY org_rls ON "zakazka_kontakty" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Zakazka
ALTER TABLE "zakazky" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "zakazky";
CREATE POLICY org_rls ON "zakazky" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));

-- Zarizeni
ALTER TABLE "zarizeni" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_rls ON "zarizeni";
CREATE POLICY org_rls ON "zarizeni" FOR ALL TO nanto_app
  USING ("orgId" = current_setting('app.org_id', true)) WITH CHECK ("orgId" = current_setting('app.org_id', true));
