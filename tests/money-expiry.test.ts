import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { db } from "../apps/server/src/services/db";
import { expireMoneyTransfers, moneyExpiryMs } from "../apps/server/src/services/money-expiry";

function replace(t: TestContext, object: any, key: string, implementation: any) {
  const original = object[key];
  object[key] = implementation;
  t.after(() => { object[key] = original; });
}

test("unclaimed money is refunded to the sender once and notified to the chat", async (t) => {
  const now = new Date("2026-10-24T12:00:00.000Z");
  const senderId = "11111111-1111-1111-1111-111111111111";
  const peerId = "22222222-2222-2222-2222-222222222222";
  const transfer = {
    id: "33333333-3333-3333-3333-333333333333",
    senderId,
    recipientId: peerId,
    kind: "TRANSFER",
    status: "PENDING",
    claimedCount: 0,
    recipientCount: 1,
    message: { id: "message", conversationId: "conversation" },
    claims: [{ userId: peerId, amount: 50000 }],
  };
  const transactions: any[] = [];
  const events: any[] = [];
  const updates: any[] = [];
  let filteredByExpiry: any;

  replace(t, db.moneyTransfer, "findMany", async ({ where }: any) => {
    filteredByExpiry = where;
    return transfer.status === "PENDING" ? [{ id: transfer.id }] : [];
  });
  replace(t, db, "$transaction", async (action: any) =>
    action({
      moneyTransfer: {
        findUnique: async () => transfer,
        updateMany: async ({ data }: any) => {
          updates.push(data);
          if (transfer.status !== "PENDING") return { count: 0 };
          transfer.status = data.status;
          return { count: 1 };
        },
      },
      moneyTransferClaim: {
        updateMany: async () => ({ count: 1 }),
        findMany: async () => [{ amount: 50000 }],
      },
      wallet: { upsert: async () => ({}) },
      walletTransaction: { create: async ({ data }: any) => transactions.push(data) },
      user: { findUnique: async () => ({ nickname: "Linh" }) },
      conversationMember: { findMany: async () => [{ userId: senderId }, { userId: peerId }] },
      outbox: { createMany: async ({ data }: any) => events.push(...data) },
    }),
  );

  assert.equal(await expireMoneyTransfers(now), 1);
  assert.deepEqual(filteredByExpiry, {
    status: "PENDING",
    createdAt: { lte: new Date(now.getTime() - moneyExpiryMs) },
  });
  assert.equal(updates.at(-1).status, "REFUNDED");
  assert.ok(updates.at(-1).refundedAt instanceof Date);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].walletId, senderId);
  assert.equal(transactions[0].amount, 50000);
  assert.equal(transactions[0].kind, "REFUND");
  assert.equal(transactions[0].peerId, peerId);
  assert.equal(events.length, 2);
  assert.ok(events.every((event) => event.event === "money:refunded"));
  assert.equal(events[0].payload.status, "REFUNDED");
  assert.equal(events[0].payload.refundedAmount, 50000);

  // A second sweep must not credit the sender again.
  assert.equal(await expireMoneyTransfers(now), 0);
  assert.equal(transactions.length, 1);
  assert.equal(events.length, 2);
});
