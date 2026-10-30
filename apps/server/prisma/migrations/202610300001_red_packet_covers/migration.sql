-- CreateTable
CREATE TABLE "RedPacketDesigner" (
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedPacketDesigner_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RedPacketCover" (
    "id" UUID NOT NULL,
    "designerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "design" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "price" INTEGER NOT NULL DEFAULT 0,
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedPacketCover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRedPacketCover" (
    "userId" UUID NOT NULL,
    "coverId" UUID NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRedPacketCover_pkey" PRIMARY KEY ("userId","coverId")
);

-- AlterTable
ALTER TABLE "MoneyTransfer" ADD COLUMN "coverId" UUID,
ADD COLUMN "coverDesign" JSONB;

-- CreateIndex
CREATE INDEX "RedPacketCover_status_updatedAt_idx" ON "RedPacketCover"("status", "updatedAt");
CREATE INDEX "RedPacketCover_designerId_updatedAt_idx" ON "RedPacketCover"("designerId", "updatedAt");
CREATE INDEX "UserRedPacketCover_userId_selected_idx" ON "UserRedPacketCover"("userId", "selected");
CREATE INDEX "MoneyTransfer_coverId_idx" ON "MoneyTransfer"("coverId");

-- AddForeignKey
ALTER TABLE "RedPacketDesigner" ADD CONSTRAINT "RedPacketDesigner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedPacketCover" ADD CONSTRAINT "RedPacketCover_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "RedPacketDesigner"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRedPacketCover" ADD CONSTRAINT "UserRedPacketCover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRedPacketCover" ADD CONSTRAINT "UserRedPacketCover_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "RedPacketCover"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MoneyTransfer" ADD CONSTRAINT "MoneyTransfer_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "RedPacketCover"("id") ON DELETE SET NULL ON UPDATE CASCADE;
