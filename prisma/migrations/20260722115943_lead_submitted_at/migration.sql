-- AlterTable
ALTER TABLE "leady" ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "leady_orgId_email_submittedAt_idx" ON "leady"("orgId", "email", "submittedAt");
