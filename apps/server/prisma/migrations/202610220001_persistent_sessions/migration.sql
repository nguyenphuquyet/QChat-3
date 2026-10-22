ALTER TABLE "UserSession" ALTER COLUMN "expiresAt" DROP NOT NULL;

-- Keep valid sessions signed in; never revive an expired or revoked session.
UPDATE "UserSession" SET "expiresAt" = NULL
WHERE "revokedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP;
