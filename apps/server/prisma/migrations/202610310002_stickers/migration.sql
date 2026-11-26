-- CreateTable
CREATE TABLE "StickerPack" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverMediaId" UUID,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StickerPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sticker" (
    "id" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "animated" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStickerPack" (
    "userId" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStickerPack_pkey" PRIMARY KEY ("userId","packId")
);

-- CreateTable
CREATE TABLE "UserSticker" (
    "userId" UUID NOT NULL,
    "stickerId" UUID NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uses" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserSticker_pkey" PRIMARY KEY ("userId","stickerId")
);

-- CreateIndex
CREATE INDEX "StickerPack_ownerId_updatedAt_idx" ON "StickerPack"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "StickerPack_published_updatedAt_idx" ON "StickerPack"("published", "updatedAt");

-- CreateIndex
CREATE INDEX "StickerPack_coverMediaId_idx" ON "StickerPack"("coverMediaId");

-- CreateIndex
CREATE INDEX "Sticker_packId_position_idx" ON "Sticker"("packId", "position");

-- CreateIndex
CREATE INDEX "Sticker_mediaId_idx" ON "Sticker"("mediaId");

-- CreateIndex
CREATE INDEX "UserStickerPack_packId_idx" ON "UserStickerPack"("packId");

-- CreateIndex
CREATE INDEX "UserSticker_userId_usedAt_idx" ON "UserSticker"("userId", "usedAt");

-- AddForeignKey
ALTER TABLE "StickerPack" ADD CONSTRAINT "StickerPack_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerPack" ADD CONSTRAINT "StickerPack_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StickerPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStickerPack" ADD CONSTRAINT "UserStickerPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStickerPack" ADD CONSTRAINT "UserStickerPack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StickerPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSticker" ADD CONSTRAINT "UserSticker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSticker" ADD CONSTRAINT "UserSticker_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

