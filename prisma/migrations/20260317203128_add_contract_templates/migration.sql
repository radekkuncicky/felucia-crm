-- CreateTable
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "obsah" TEXT NOT NULL,
    "vytvoreno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
