import test from "node:test";
import assert from "node:assert/strict";
import { splitRedPacket } from "../apps/server/src/modules/wallet";

const recipients = (count: number) =>
  Array.from({ length: count }, (_, index) => `user-${index}`);

const total = (shares: { amount: number }[]) =>
  shares.reduce((sum, share) => sum + share.amount, 0);

test("a packet split evenly gives every member the same share", () => {
  const shares = splitRedPacket(100_000, recipients(4), "EQUAL");
  assert.equal(total(shares), 100_000);
  assert.ok(shares.every((share) => share.amount === 25_000));
});

test("an even split scatters the odd đồng instead of losing it", () => {
  const shares = splitRedPacket(100_001, recipients(4), "EQUAL");
  assert.equal(total(shares), 100_001);
  assert.deepEqual(
    shares.map((share) => share.amount).sort((a, b) => a - b),
    [25_000, 25_000, 25_000, 25_001],
  );
});

test("an even split still pays every member when nobody claims all", () => {
  // The same shares feed the 24h refund, so the sum must always equal the
  // packet even when the amount leaves a remainder.
  for (const amount of [1_000, 10_001, 999_999]) {
    const shares = splitRedPacket(amount, recipients(7), "EQUAL");
    assert.equal(total(shares), amount);
    assert.equal(shares.length, 7);
  }
});

test("a random split hands out the whole packet and never zero", () => {
  for (const amount of [12, 1_000, 12_345, 999_999]) {
    const count = Math.min(amount, 12);
    const shares = splitRedPacket(amount, recipients(count), "RANDOM");
    assert.equal(shares.length, count);
    assert.equal(total(shares), amount);
    assert.ok(shares.every((share) => share.amount >= 1));
  }
});

test("a random split is not the same as an even one", () => {
  const runs = Array.from({ length: 8 }, () =>
    splitRedPacket(100_000, recipients(6), "RANDOM").map(
      (share) => share.amount,
    ),
  );
  assert.ok(
    runs.some((amounts) => new Set(amounts).size > 1),
    "random shares should differ at least once",
  );
});

test("a packet smaller than its group is rejected", () => {
  assert.throws(
    () => splitRedPacket(2, recipients(3), "EQUAL"),
    (error: { code?: string }) => error.code === "AMOUNT_TOO_SMALL",
  );
});
