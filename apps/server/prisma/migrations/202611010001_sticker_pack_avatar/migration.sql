-- AlterTable
ALTER TABLE "StickerPack" ADD COLUMN "avatarMediaId" UUID;

-- CreateIndex
CREATE INDEX "StickerPack_avatarMediaId_idx" ON "StickerPack"("avatarMediaId");

-- AddForeignKey
ALTER TABLE "StickerPack" ADD CONSTRAINT "StickerPack_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
