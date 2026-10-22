import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../apps/server/src/services/db";
import {
  authenticate,
  createSession,
  refreshSession,
  digest,
} from "../apps/server/src/security/auth";

test("persistent sessions survive retries and remain revocable", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET =
    "persistent-session-test-secret-at-least-32-characters";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const session = {
    id: "session",
    userId: "user",
    expiresAt: null as Date | null,
    revokedAt: null as Date | null,
    user: { disabled: false, role: "USER" },
    refreshHash: "",
  };
  const originalCreate = db.userSession.create;
  const originalFind = db.userSession.findUnique;
  t.after(() => {
    db.userSession.create = originalCreate;
    db.userSession.findUnique = originalFind;
  });
  db.userSession.create = (async ({ data }: any) => {
    assert.equal(data.expiresAt, null);
    session.refreshHash = data.refreshHash;
    return session;
  }) as typeof db.userSession.create;
  db.userSession.findUnique = (async ({ where }: any) =>
    where.id === session.id || where.refreshHash === session.refreshHash
      ? session
      : null) as typeof db.userSession.findUnique;
  const login = await createSession("user", "test-device");
  assert.equal(session.refreshHash, digest(login.refreshToken));
  for (const refreshed of await Promise.all([
    refreshSession(login.refreshToken),
    refreshSession(login.refreshToken),
  ])) {
    assert.equal(refreshed.refreshToken, login.refreshToken);
    assert.equal((await authenticate(refreshed.accessToken)).userId, "user");
  }
  await assert.rejects(refreshSession("invalid-token"));
  session.expiresAt = new Date(0);
  await assert.rejects(refreshSession(login.refreshToken));
  await assert.rejects(authenticate(login.accessToken));
  session.expiresAt = null;
  session.user.disabled = true;
  await assert.rejects(refreshSession(login.refreshToken));
  await assert.rejects(authenticate(login.accessToken));
  session.user.disabled = false;
  session.revokedAt = new Date();
  await assert.rejects(refreshSession(login.refreshToken));
  await assert.rejects(authenticate(login.accessToken));
});
