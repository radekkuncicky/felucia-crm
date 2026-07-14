-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "modulPodpisy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripePodpisySubId" TEXT;
