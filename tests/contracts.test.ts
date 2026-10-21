import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  messageSchema,
  registerSchema,
  receiptSchema,
  signalSchema,
} from "../packages/contracts";
import { validSignature } from "../apps/server/src/modules/media";
test("message contract rejects forged sender and empty messages", () => {
  const valid = {
    conversationId: randomUUID(),
    clientId: randomUUID(),
    text: "Hello 👋",
  };
  assert.equal(messageSchema.parse(valid).kind, "TEXT");
  assert.equal(
    messageSchema.safeParse({ ...valid, senderId: randomUUID() }).success,
    false,
  );
  assert.equal(
    messageSchema.safeParse({ ...valid, text: "   " }).success,
    false,
  );
  assert.equal(
    messageSchema.safeParse({ ...valid, kind: "IMAGE" }).success,
    false,
  );
});
test("registration normalizes email and enforces strong minimum password", () => {
  const data = {
    qchatId: "alice_test",
    email: "ALICE@EXAMPLE.COM",
    password: "sufficiently-long-password",
    nickname: "Alice",
  };
  assert.equal(registerSchema.parse(data).email, "alice@example.com");
  assert.equal(
    registerSchema.safeParse({ ...data, password: "1234" }).success,
    false,
  );
});
test("receipts and call signals reject unbounded and forged input", () => {
  assert.equal(
    receiptSchema.safeParse({ conversationId: randomUUID(), sequence: -1 })
      .success,
    false,
  );
  assert.equal(
    signalSchema.safeParse({ callId: randomUUID(), data: "x".repeat(64001) })
      .success,
    false,
  );
});
test("media signature rejects executable bytes masquerading as an image", () => {
  assert.equal(
    validSignature("image/png", Buffer.from("MZ executable")),
    false,
  );
  assert.equal(
    validSignature("image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    true,
  );
  assert.equal(validSignature("text/html", Buffer.from("<script>")), false);
});
