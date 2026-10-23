-- CreateTable
CREATE TABLE "MoneyTransfer" (
    "id" UUID NOT NULL,
    "messageId" UUID,
    "senderId" UUID NOT NULL,
    "recipientId" UUID,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 1,
    "claimedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoneyTransfer_messageId_key" ON "MoneyTransfer"("messageId");
CREATE INDEX "MoneyTransfer_recipientId_status_idx" ON "MoneyTransfer"("recipientId", "status");
CREATE INDEX "MoneyTransfer_senderId_createdAt_idx" ON "MoneyTransfer"("senderId", "createdAt");

-- CreateTable
CREATE TABLE "MoneyTransferClaim" (
    "transferId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "MoneyTransferClaim_pkey" PRIMARY KEY ("transferId", "userId")
);

-- CreateIndex
CREATE INDEX "MoneyTransferClaim_userId_status_idx" ON "MoneyTransferClaim"("userId", "status");

-- AddForeignKey
ALTER TABLE "MoneyTransfer" ADD CONSTRAINT "MoneyTransfer_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MoneyTransferClaim" ADD CONSTRAINT "MoneyTransferClaim_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "MoneyTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
