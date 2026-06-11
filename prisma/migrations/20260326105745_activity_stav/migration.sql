-- CreateEnum
CREATE TYPE "ActivityStav" AS ENUM ('PLANOVANA', 'DOKONCENA', 'ZRUSENA');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "stav" "ActivityStav" NOT NULL DEFAULT 'PLANOVANA';
