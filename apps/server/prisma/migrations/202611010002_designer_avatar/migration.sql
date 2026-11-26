-- AlterTable
ALTER TABLE "RedPacketDesigner" ADD COLUMN "avatarId" UUID;

-- CreateIndex
CREATE INDEX "RedPacketDesigner_avatarId_idx" ON "RedPacketDesigner"("avatarId");

-- AddForeignKey
ALTER TABLE "RedPacketDesigner" ADD CONSTRAINT "RedPacketDesigner_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
