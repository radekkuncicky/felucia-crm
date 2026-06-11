-- CreateEnum
CREATE TYPE "public"."EtapaStav" AS ENUM ('PLANOVANA', 'PROBIHAJICI', 'PREDANA');

-- CreateEnum
CREATE TYPE "public"."SodTyp" AS ENUM ('DPH_12_BEZ_ZALOHY', 'DPH_12_SE_ZALOHOU', 'DPH_21_BEZ_ZALOHY', 'DPH_21_SE_ZALOHOU', 'PDP_BEZ_ZALOHY', 'PDP_SE_ZALOHOU');

-- CreateEnum
CREATE TYPE "public"."TypKlienta" AS ENUM ('FYZICKA_OSOBA', 'FIRMA');

-- CreateEnum
CREATE TYPE "public"."ZakazkaTyp" AS ENUM ('OBCHODNI', 'SERVISNI');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."SkladPohybTyp_new" AS ENUM ('VYDEJ', 'REZERVACE', 'STORNO', 'PRIJEM_SKLAD');
ALTER TABLE "public"."sklad_pohyby" ALTER COLUMN "typ" TYPE "public"."SkladPohybTyp_new" USING ("typ"::text::"public"."SkladPohybTyp_new");
ALTER TYPE "public"."SkladPohybTyp" RENAME TO "SkladPohybTyp_old";
ALTER TYPE "public"."SkladPohybTyp_new" RENAME TO "SkladPohybTyp";
DROP TYPE "public"."SkladPohybTyp_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."StavDealu" ADD VALUE 'ZNEPLATNENO';

-- AlterTable
ALTER TABLE "public"."activities" ADD COLUMN     "cas" TEXT,
ADD COLUMN     "misto" TEXT,
ADD COLUMN     "reminderAt" TIMESTAMP(3),
ADD COLUMN     "trvaniMin" INTEGER DEFAULT 15,
ALTER COLUMN "popis" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."api_keys" ADD COLUMN     "allowedOrigins" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "nazev" TEXT NOT NULL DEFAULT 'Bez názvu';

-- AlterTable
ALTER TABLE "public"."clients" ADD COLUMN     "typKlienta" "public"."TypKlienta" NOT NULL DEFAULT 'FYZICKA_OSOBA';

-- AlterTable
ALTER TABLE "public"."deals" ALTER COLUMN "dphSazba" SET DEFAULT 12;

-- AlterTable
ALTER TABLE "public"."leady" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."org_settings" ADD COLUMN     "obchodnikJmeno" TEXT,
ADD COLUMN     "obchodnikTelefon" TEXT,
ADD COLUMN     "sendServisniProtokolEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "singleTemplate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "storageLimit" BIGINT NOT NULL DEFAULT 3221225472,
ADD COLUMN     "zakazkyAutoAssignVedouci" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "zakazkyAutoVyuctovani" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "zakazkyDefaultDph" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "zakazkyDefaultVedouciId" TEXT,
ADD COLUMN     "zakazkyPrefix" TEXT;

-- AlterTable
ALTER TABLE "public"."organizations" ADD COLUMN     "aiCreditsExtra" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripeSubscriptionStatus" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."predavak_polozky" ADD COLUMN     "planovanoMnozstvi" DECIMAL(65,30) NOT NULL DEFAULT 1,
ADD COLUMN     "zahrnuto" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."predavaky" ADD COLUMN     "etapaId" TEXT,
ADD COLUMN     "upravenoPodpisano" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."quote_items" ADD COLUMN     "nakupniCena" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."quote_templates" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "pushToken" TEXT,
ADD COLUMN     "serviceAccess" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."vyuctovani" ADD COLUMN     "etapaId" TEXT;

-- AlterTable
ALTER TABLE "public"."vyuctovani_polozky" ALTER COLUMN "dphSazba" SET DEFAULT 12;

-- AlterTable
ALTER TABLE "public"."zakazka_polozky" ALTER COLUMN "dphSazba" SET DEFAULT 12;

-- AlterTable
ALTER TABLE "public"."zakazky" ADD COLUMN     "mistoStavby" TEXT,
ADD COLUMN     "pokyny" TEXT,
ADD COLUMN     "typ" "public"."ZakazkaTyp" NOT NULL DEFAULT 'OBCHODNI';

-- AlterTable
ALTER TABLE "public"."zarizeni" ADD COLUMN     "qrToken" TEXT;

-- CreateTable
CREATE TABLE "public"."ai_usage_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "toolCalls" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "velikost" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "cesta" TEXT NOT NULL,
    "popis" TEXT,
    "uploadedById" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typ" TEXT NOT NULL,
    "zprava" TEXT NOT NULL,
    "precteno" BOOLEAN NOT NULL DEFAULT false,
    "dealId" TEXT,
    "klientId" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."org_template_mappings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "technologie" TEXT,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "org_template_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sod" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "cislo" TEXT NOT NULL,
    "typ" "public"."SodTyp" NOT NULL,
    "klientJmeno" TEXT NOT NULL,
    "klientAdresa" TEXT,
    "klientEmail" TEXT,
    "klientTelefon" TEXT,
    "klientIco" TEXT,
    "klientDic" TEXT,
    "kontaktniOsoba" TEXT,
    "kontaktniTelefon" TEXT,
    "predmetDila" TEXT NOT NULL,
    "adresaDila" TEXT,
    "terminPrevzeti" TEXT,
    "pocetDniRealizace" INTEGER,
    "zmenaTerm" TEXT,
    "cenaBezDph" DECIMAL(12,2),
    "cenaSDph" DECIMAL(12,2),
    "dphSazba" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "zalohaKc" DECIMAL(12,2),
    "zalohaSplatnost" INTEGER DEFAULT 14,
    "zalohaKategorie" TEXT,
    "poznamky" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "textSmlouvy" TEXT,
    "templateId" TEXT,

    CONSTRAINT "sod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."zakazka_dokumenty" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "nahralId" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zakazka_dokumenty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."zakazka_etapy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "cislo" INTEGER NOT NULL,
    "nazev" TEXT,
    "montazOd" TIMESTAMP(3),
    "montazDo" TIMESTAMP(3),
    "stav" "public"."EtapaStav" NOT NULL DEFAULT 'PLANOVANA',
    "poznamka" TEXT,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zakazka_etapy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."zakazka_komentare" (
    "id" TEXT NOT NULL,
    "zakazkaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zakazka_komentare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_orgId_vytvoreno_idx" ON "public"."ai_usage_logs"("orgId" ASC, "vytvoreno" ASC);

-- CreateIndex
CREATE INDEX "ai_usage_logs_userId_vytvoreno_idx" ON "public"."ai_usage_logs"("userId" ASC, "vytvoreno" ASC);

-- CreateIndex
CREATE INDEX "documents_orgId_idx" ON "public"."documents"("orgId" ASC);

-- CreateIndex
CREATE INDEX "notifications_orgId_idx" ON "public"."notifications"("orgId" ASC);

-- CreateIndex
CREATE INDEX "notifications_userId_precteno_idx" ON "public"."notifications"("userId" ASC, "precteno" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "org_template_mappings_orgId_technologie_key" ON "public"."org_template_mappings"("orgId" ASC, "technologie" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sod_orgId_cislo_key" ON "public"."sod"("orgId" ASC, "cislo" ASC);

-- CreateIndex
CREATE INDEX "zakazka_dokumenty_zakazkaId_idx" ON "public"."zakazka_dokumenty"("zakazkaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "zakazka_etapy_zakazkaId_cislo_key" ON "public"."zakazka_etapy"("zakazkaId" ASC, "cislo" ASC);

-- CreateIndex
CREATE INDEX "zakazka_etapy_zakazkaId_idx" ON "public"."zakazka_etapy"("zakazkaId" ASC);

-- CreateIndex
CREATE INDEX "zakazka_komentare_zakazkaId_idx" ON "public"."zakazka_komentare"("zakazkaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_klic_key" ON "public"."api_keys"("klic" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "zarizeni_qrToken_key" ON "public"."zarizeni"("qrToken" ASC);

-- AddForeignKey
ALTER TABLE "public"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."org_template_mappings" ADD CONSTRAINT "org_template_mappings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."org_template_mappings" ADD CONSTRAINT "org_template_mappings_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."quote_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."predavaky" ADD CONSTRAINT "predavaky_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "public"."zakazka_etapy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sod" ADD CONSTRAINT "sod_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sod" ADD CONSTRAINT "sod_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sod" ADD CONSTRAINT "sod_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."contract_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vyuctovani" ADD CONSTRAINT "vyuctovani_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "public"."zakazka_etapy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zakazka_dokumenty" ADD CONSTRAINT "zakazka_dokumenty_nahralId_fkey" FOREIGN KEY ("nahralId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zakazka_dokumenty" ADD CONSTRAINT "zakazka_dokumenty_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "public"."zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zakazka_etapy" ADD CONSTRAINT "zakazka_etapy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zakazka_etapy" ADD CONSTRAINT "zakazka_etapy_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "public"."zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zakazka_komentare" ADD CONSTRAINT "zakazka_komentare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zakazka_komentare" ADD CONSTRAINT "zakazka_komentare_zakazkaId_fkey" FOREIGN KEY ("zakazkaId") REFERENCES "public"."zakazky"("id") ON DELETE CASCADE ON UPDATE CASCADE;

