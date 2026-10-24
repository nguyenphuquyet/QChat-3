-- CreateTable
CREATE TABLE "SiteLink" (
    "id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteLink_platform_key" ON "SiteLink"("platform");
