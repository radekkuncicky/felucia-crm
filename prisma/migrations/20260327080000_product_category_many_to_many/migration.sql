-- CreateTable: M2M join table for Product <-> Category
CREATE TABLE "_ProductCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProductCategories_B_index" ON "_ProductCategories"("B");

-- AddForeignKey
ALTER TABLE "_ProductCategories" ADD CONSTRAINT "_ProductCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductCategories" ADD CONSTRAINT "_ProductCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: copy existing categoryId assignments into the new join table
INSERT INTO "_ProductCategories" ("A", "B")
SELECT p."categoryId", p."id"
FROM "products" p
WHERE p."categoryId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "categories" c WHERE c."id" = p."categoryId");

-- AlterTable: drop old columns
ALTER TABLE "products" DROP COLUMN "categoryId";
ALTER TABLE "products" DROP COLUMN "kategorie";
