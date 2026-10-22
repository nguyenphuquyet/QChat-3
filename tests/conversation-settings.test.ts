import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../apps/server/src/services/db";
import { conversationsRoute } from "../apps/server/src/modules/conversations";

function replace(t: TestContext, object: any, key: string, implementation: any) {
  const original = object[key];
  object[key] = implementation;
  t.after(() => { object[key] = original; });
}

test("shared wallpapers enforce membership, group roles, image ownership and notify all members", async t => {
  const id = randomUUID(), owner = randomUUID(), member = randomUUID(), mediaId = randomUUID();
  let kind = "DIRECT", role = "MEMBER", present = true, mediaOwner = member, mime = "image/png", status = "READY";
  let saved: any;
  const events: any[] = [];
  const tx = {
    $queryRaw: async () => [{ id }],
    conversation: {
      findUniqueOrThrow: async () => ({ id, kind }),
      update: async ({ data }: any) => (saved = { id, ...data }),
    },
    conversationMember: {
      findUnique: async () => present ? { userId: member, role } : null,
      findMany: async () => [{ userId: owner }, { userId: member }],
    },
    media: { findUnique: async () => ({ id: mediaId, ownerId: mediaOwner, mime, status }) },
    outbox: { createMany: async ({ data }: any) => { events.push(...data); } },
  };
  replace(t, db.conversationMember, "findUnique", tx.conversationMember.findUnique);
  replace(t, db, "$transaction", async (action: any) => action(tx));
  const update = (body: unknown) => conversationsRoute(member, "PATCH", ["conversations", id, "wallpaper"], body, new URL("http://localhost"));
  const color = { wallpaperColor: "#e5edf5", wallpaperMediaId: null };
  await update(color);
  assert.equal(saved.wallpaperColor, color.wallpaperColor);
  assert.deepEqual(events.map(e => e.room), [`user:${owner}`, `user:${member}`]);
  assert.ok(events.every(e => e.event === "conversation:updated" && e.payload.conversationId === id));
  kind = "GROUP";
  await assert.rejects(update(color), { code: "FORBIDDEN" });
  role = "ADMIN";
  await update(color);
  role = "OWNER";
  await update({ wallpaperColor: null, wallpaperMediaId: mediaId });
  assert.equal(saved.wallpaperMediaId, mediaId);
  mediaOwner = owner;
  await assert.rejects(update({ wallpaperColor: null, wallpaperMediaId: mediaId }), { code: "INVALID_WALLPAPER" });
  mediaOwner = member;
  mime = "video/mp4";
  await assert.rejects(update({ wallpaperColor: null, wallpaperMediaId: mediaId }), { code: "INVALID_WALLPAPER" });
  mime = "image/png";
  status = "PENDING";
  await assert.rejects(update({ wallpaperColor: null, wallpaperMediaId: mediaId }), { code: "INVALID_WALLPAPER" });
  await assert.rejects(update({ ...color, wallpaperMediaId: mediaId }));
  await assert.rejects(update({ ...color, wallpaperColor: "invalid" }));
  await update({ wallpaperColor: null, wallpaperMediaId: null });
  assert.equal(saved.wallpaperColor, null);
  assert.equal(saved.wallpaperMediaId, null);
  present = false;
  await assert.rejects(update(color), { code: "FORBIDDEN" });
});

test("only the current owner appoints admins and no fourth admin can be added", async t => {
  const id = randomUUID(), owner = randomUUID(), peer = randomUUID();
  let actorRole = "OWNER", peerRole = "MEMBER", count = 2, locked = false, notifications = 0;
  const tx = {
    $queryRaw: async () => { locked = true; return [{ id }]; },
    conversationMember: {
      findUnique: async ({ where }: any) => ({ role: where.conversationId_userId.userId === owner ? actorRole : peerRole }),
      count: async () => { assert.ok(locked); return count; },
      update: async ({ where, data }: any) => {
        if (where.conversationId_userId.userId === peer) peerRole = data.role;
        return data;
      },
      findMany: async () => [{ userId: owner }, { userId: peer }],
    },
    outbox: { createMany: async () => { notifications++; } },
  };
  replace(t, db.conversationMember, "findUnique", async () => ({ role: "OWNER" }));
  replace(t, db.conversation, "findUniqueOrThrow", async () => ({ id, kind: "GROUP" }));
  replace(t, db, "$transaction", async (action: any) => action(tx));
  const update = (role: string) => conversationsRoute(owner, "PATCH", ["conversations", id, "members", peer], { role }, new URL("http://localhost"));
  await update("ADMIN");
  assert.equal(peerRole, "ADMIN");
  assert.equal(notifications, 1);
  count = 3;
  await update("ADMIN"); // Repeating the same assignment is harmless.
  await update("MEMBER");
  await assert.rejects(update("ADMIN"), { status: 409, code: "ADMIN_LIMIT_REACHED" });
  assert.equal(peerRole, "MEMBER");
  actorRole = "ADMIN"; // The initial membership snapshot may be stale.
  await assert.rejects(update("ADMIN"), { code: "FORBIDDEN" });
});
