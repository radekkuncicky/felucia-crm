-- CreateEnum
CREATE TYPE "QuoteTemplateTyp" AS ENUM ('BASE', 'STANDARD', 'CUSTOM_HTML', 'SYSTEM');

-- AlterTable: quote_templates — add new columns
ALTER TABLE "quote_templates" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "planRequired" "PlanOrg" NOT NULL DEFAULT 'STARTER',
ADD COLUMN "typ" "QuoteTemplateTyp" NOT NULL DEFAULT 'BASE',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();

-- AlterTable: quotes — add templateId
ALTER TABLE "quotes" ADD COLUMN "templateId" TEXT;

-- CreateTable: quote_template_configs
CREATE TABLE "quote_template_configs" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#4CAF50',
    "accentColor" TEXT NOT NULL DEFAULT '#1A2E1B',
    "headerText" TEXT,
    "footerLine1" TEXT,
    "footerLine2" TEXT,
    "footerLine3" TEXT,
    "showOpKod" BOOLEAN NOT NULL DEFAULT true,
    "showDatumPlatnosti" BOOLEAN NOT NULL DEFAULT true,
    "showPoznamka" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,
    CONSTRAINT "quote_template_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: quote_template_htmls
CREATE TABLE "quote_template_htmls" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "cssContent" TEXT,
    CONSTRAINT "quote_template_htmls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_template_configs_templateId_key" ON "quote_template_configs"("templateId");
CREATE UNIQUE INDEX "quote_template_htmls_templateId_key" ON "quote_template_htmls"("templateId");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "quote_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quote_template_configs" ADD CONSTRAINT "quote_template_configs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "quote_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_template_htmls" ADD CONSTRAINT "quote_template_htmls_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "quote_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
