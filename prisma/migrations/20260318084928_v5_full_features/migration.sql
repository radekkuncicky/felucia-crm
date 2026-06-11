-- CreateEnum
CREATE TYPE "TypAkce" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "PlanOrg" AS ENUM ('FREE', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "TypPole" AS ENUM ('TEXT', 'CISLO', 'DATUM', 'CHECKBOX', 'VYBER');

-- CreateEnum
CREATE TYPE "Viditelnost" AS ENUM ('ALL', 'OWN', 'SELECTED');

-- AlterTable
ALTER TABLE "contract_templates" ADD COLUMN     "typSablony" TEXT DEFAULT 'text';

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "duvodProhry" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "dic" TEXT,
ADD COLUMN     "ico" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "plan" "PlanOrg" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planActiveTo" TIMESTAMP(3),
ADD COLUMN     "sidlo" TEXT,
ADD COLUMN     "web" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "nakupniCena" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "typAkce" "TypAkce" NOT NULL,
    "typZaznamu" TEXT NOT NULL,
    "zaznamId" TEXT NOT NULL,
    "zaznamNazev" TEXT NOT NULL,
    "zmeny" JSONB NOT NULL DEFAULT '{}',
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "typ" "TypPole" NOT NULL DEFAULT 'TEXT',
    "povinne" BOOLEAN NOT NULL DEFAULT false,
    "povinneOdStavu" TEXT,
    "poradi" INTEGER NOT NULL DEFAULT 0,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "moznosti" JSONB,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "hodnota" TEXT,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_nodes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "parentId" TEXT,
    "nazev" TEXT NOT NULL,
    "poradi" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visibility_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_node_users" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viditelnost" "Viditelnost" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "visibility_node_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extensions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "aktivni" BOOLEAN NOT NULL DEFAULT false,
    "apiKlic" TEXT,

    CONSTRAINT "extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_entityId_fieldId_key" ON "custom_field_values"("entityId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "visibility_node_users_nodeId_userId_key" ON "visibility_node_users"("nodeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_orgId_nazev_key" ON "extensions"("orgId", "nazev");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_nodes" ADD CONSTRAINT "visibility_nodes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_nodes" ADD CONSTRAINT "visibility_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "visibility_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_node_users" ADD CONSTRAINT "visibility_node_users_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "visibility_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_node_users" ADD CONSTRAINT "visibility_node_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
