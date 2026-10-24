-- AlterTable
ALTER TABLE "MoneyTransfer" ADD COLUMN "refundedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MoneyTransfer_status_createdAt_idx" ON "MoneyTransfer"("status", "createdAt");
