ALTER TABLE "Conversation" ADD COLUMN "wallpaperColor" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "wallpaperMediaId" UUID;
CREATE INDEX "Conversation_wallpaperMediaId_idx" ON "Conversation"("wallpaperMediaId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_wallpaperMediaId_fkey"
  FOREIGN KEY ("wallpaperMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
