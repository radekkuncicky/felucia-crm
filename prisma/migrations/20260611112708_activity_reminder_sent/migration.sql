-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "activities_reminderAt_idx" ON "activities"("reminderAt");
