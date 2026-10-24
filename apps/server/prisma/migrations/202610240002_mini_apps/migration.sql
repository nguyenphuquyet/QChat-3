-- CreateTable
CREATE TABLE "MiniApp" (
    "id" UUID NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconUrl" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'utilities',
    "developerName" TEXT NOT NULL DEFAULT '',
    "supportUrl" TEXT NOT NULL DEFAULT '',
    "privacyUrl" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersion" TEXT,
    "requestedPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "developerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniAppVersion" (
    "id" UUID NOT NULL,
    "miniAppId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "manifest" JSONB NOT NULL,
    "entry" TEXT NOT NULL,
    "minRuntimeVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "requestedPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "channel" TEXT NOT NULL DEFAULT 'DEVELOPMENT',
    "uploadedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MiniAppVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniAppReview" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniAppReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniAppRelease" (
    "id" UUID NOT NULL,
    "miniAppId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniAppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniAppPermissionRequest" (
    "id" UUID NOT NULL,
    "miniAppId" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" UUID NOT NULL,
    "reviewedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "MiniAppPermissionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniAppMember" (
    "id" UUID NOT NULL,
    "miniAppId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DEVELOPER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniAppMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniAppApiKey" (
    "id" UUID NOT NULL,
    "miniAppId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MiniAppApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRecentMiniApp" (
    "userId" UUID NOT NULL,
    "miniAppId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserRecentMiniApp_pkey" PRIMARY KEY ("userId","miniAppId")
);

-- CreateTable
CREATE TABLE "UserFavoriteMiniApp" (
    "userId" UUID NOT NULL,
    "miniAppId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavoriteMiniApp_pkey" PRIMARY KEY ("userId","miniAppId")
);

-- CreateTable
CREATE TABLE "MiniAppAnalyticsEvent" (
    "id" UUID NOT NULL,
    "miniAppId" UUID NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "event" TEXT NOT NULL,
    "userId" UUID,
    "errorCode" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniAppAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiniApp_appId_key" ON "MiniApp"("appId");
CREATE INDEX "MiniApp_status_updatedAt_idx" ON "MiniApp"("status", "updatedAt");
CREATE INDEX "MiniApp_category_status_idx" ON "MiniApp"("category", "status");
CREATE INDEX "MiniApp_developerId_updatedAt_idx" ON "MiniApp"("developerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MiniAppVersion_miniAppId_version_key" ON "MiniAppVersion"("miniAppId", "version");
CREATE INDEX "MiniAppVersion_miniAppId_createdAt_idx" ON "MiniAppVersion"("miniAppId", "createdAt");
CREATE INDEX "MiniAppVersion_status_idx" ON "MiniAppVersion"("status");

-- CreateIndex
CREATE INDEX "MiniAppReview_versionId_createdAt_idx" ON "MiniAppReview"("versionId", "createdAt");

-- CreateIndex
CREATE INDEX "MiniAppRelease_miniAppId_createdAt_idx" ON "MiniAppRelease"("miniAppId", "createdAt");

-- CreateIndex
CREATE INDEX "MiniAppPermissionRequest_miniAppId_createdAt_idx" ON "MiniAppPermissionRequest"("miniAppId", "createdAt");
CREATE INDEX "MiniAppPermissionRequest_status_createdAt_idx" ON "MiniAppPermissionRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MiniAppMember_miniAppId_userId_key" ON "MiniAppMember"("miniAppId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MiniAppApiKey_prefix_key" ON "MiniAppApiKey"("prefix");
CREATE INDEX "MiniAppApiKey_miniAppId_idx" ON "MiniAppApiKey"("miniAppId");

-- CreateIndex
CREATE INDEX "UserRecentMiniApp_userId_openedAt_idx" ON "UserRecentMiniApp"("userId", "openedAt");

-- CreateIndex
CREATE INDEX "MiniAppAnalyticsEvent_miniAppId_createdAt_idx" ON "MiniAppAnalyticsEvent"("miniAppId", "createdAt");
CREATE INDEX "MiniAppAnalyticsEvent_event_createdAt_idx" ON "MiniAppAnalyticsEvent"("event", "createdAt");

-- AddForeignKey
ALTER TABLE "MiniApp" ADD CONSTRAINT "MiniApp_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppVersion" ADD CONSTRAINT "MiniAppVersion_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "MiniApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppReview" ADD CONSTRAINT "MiniAppReview_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MiniAppVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppRelease" ADD CONSTRAINT "MiniAppRelease_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "MiniApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppRelease" ADD CONSTRAINT "MiniAppRelease_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MiniAppVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppPermissionRequest" ADD CONSTRAINT "MiniAppPermissionRequest_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "MiniApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppMember" ADD CONSTRAINT "MiniAppMember_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "MiniApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppMember" ADD CONSTRAINT "MiniAppMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppApiKey" ADD CONSTRAINT "MiniAppApiKey_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "MiniApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRecentMiniApp" ADD CONSTRAINT "UserRecentMiniApp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRecentMiniApp" ADD CONSTRAINT "UserRecentMiniApp_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "MiniApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFavoriteMiniApp" ADD CONSTRAINT "UserFavoriteMiniApp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFavoriteMiniApp" ADD CONSTRAINT "UserFavoriteMiniApp_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "MiniApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiniAppAnalyticsEvent" ADD CONSTRAINT "MiniAppAnalyticsEvent_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "MiniApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
