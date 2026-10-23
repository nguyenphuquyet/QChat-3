-- CreateTable
CREATE TABLE "Wallet" (
    "userId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "bonusGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TRANSFER',
    "note" TEXT NOT NULL DEFAULT '',
    "peerId" UUID,
    "peerName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
