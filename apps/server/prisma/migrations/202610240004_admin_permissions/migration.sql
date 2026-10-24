-- Scoped management access. ADMIN keeps full control; any other account with
-- at least one entry here can open the matching sections of the admin console.
ALTER TABLE "User"
ADD COLUMN "adminPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
