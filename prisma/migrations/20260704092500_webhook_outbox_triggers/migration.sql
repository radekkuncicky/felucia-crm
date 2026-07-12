-- Transakční outbox pro webhooky + triggery na sledovaných tabulkách.
-- Event vznikne ve stejné transakci jako byznys zápis — rollback ho zahodí,
-- commit zaručí doručení (worker sweep). Trigger je no-op, pokud org nemá
-- žádný aktivní webhook endpoint (levný EXISTS přes index).
-- Trigger DDL je kopie prisma/webhook-triggers.sql (test DB přes db push
-- triggery nemají, aplikuje je tests/setup.ts a scripts/e2e.sh) — při změně
-- triggerů založ novou migraci a uprav i webhook-triggers.sql.

-- CreateTable
CREATE TABLE "webhook_outbox" (
    "id" BIGSERIAL NOT NULL,
    "orgId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_outbox_vytvoreno_idx" ON "webhook_outbox"("vytvoreno");

-- Trigger funkce: entita jako argument, operace z TG_OP.
CREATE OR REPLACE FUNCTION webhook_outbox_capture() RETURNS trigger AS $$
DECLARE
  rec RECORD;
  ev TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM webhook_endpoints w
    WHERE w."orgId" = rec."orgId" AND w.aktivni
  ) THEN
    RETURN NULL;
  END IF;

  ev := TG_ARGV[0] || '.' || CASE TG_OP
    WHEN 'INSERT' THEN 'created'
    WHEN 'UPDATE' THEN 'updated'
    ELSE 'deleted' END;

  INSERT INTO webhook_outbox ("orgId", event, payload)
  VALUES (rec."orgId", ev, to_jsonb(rec));

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_capture ON "clients";
CREATE TRIGGER webhook_capture AFTER INSERT OR UPDATE OR DELETE ON "clients"
  FOR EACH ROW EXECUTE FUNCTION webhook_outbox_capture('client');

DROP TRIGGER IF EXISTS webhook_capture ON "deals";
CREATE TRIGGER webhook_capture AFTER INSERT OR UPDATE OR DELETE ON "deals"
  FOR EACH ROW EXECUTE FUNCTION webhook_outbox_capture('deal');

DROP TRIGGER IF EXISTS webhook_capture ON "zakazky";
CREATE TRIGGER webhook_capture AFTER INSERT OR UPDATE OR DELETE ON "zakazky"
  FOR EACH ROW EXECUTE FUNCTION webhook_outbox_capture('zakazka');

DROP TRIGGER IF EXISTS webhook_capture ON "servisni_zakazky";
CREATE TRIGGER webhook_capture AFTER INSERT OR UPDATE OR DELETE ON "servisni_zakazky"
  FOR EACH ROW EXECUTE FUNCTION webhook_outbox_capture('servisni_zakazka');

DROP TRIGGER IF EXISTS webhook_capture ON "leady";
CREATE TRIGGER webhook_capture AFTER INSERT OR UPDATE OR DELETE ON "leady"
  FOR EACH ROW EXECUTE FUNCTION webhook_outbox_capture('lead');
