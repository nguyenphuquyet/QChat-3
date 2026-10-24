import { db } from "./db";

/// A red packet or transfer that nobody accepts goes back to the sender after
/// this window. The value is intentionally a constant instead of a setting:
/// the client copy promises 24 hours.
export const moneyExpiryMs = 24 * 60 * 60 * 1000;

const sweepIntervalMs = 60_000;
const batchSize = 200;

let lastSweep = 0;
let sweeping: Promise<number> | null = null;

/// Moves the still-pending claims of one transfer to REFUNDED, credits the
/// sender and publishes the new state. Returns the refunded amount, or null
/// when another worker already settled the transfer.
async function refundTransfer(transferId: string, now: Date) {
  return db.$transaction(async (tx) => {
    const transfer = await tx.moneyTransfer.findUnique({
      where: { id: transferId },
      include: {
        message: { select: { id: true, conversationId: true } },
        claims: { where: { status: "PENDING" }, select: { userId: true, amount: true } },
      },
    });
    if (!transfer || transfer.status !== "PENDING") return null;

    // Claiming and refunding both start by flipping the claim row, so the two
    // paths serialise on the same primary key and cannot pay twice.
    const expired = await tx.moneyTransferClaim.updateMany({
      where: { transferId, status: "PENDING" },
      data: { status: "REFUNDED" },
    });
    if (expired.count === 0) {
      // Every share was claimed but the transfer never got its final status.
      await tx.moneyTransfer.updateMany({
        where: { id: transferId, status: "PENDING" },
        data: { status: "CLAIMED", claimedAt: now },
      });
      return null;
    }

    const refundedClaims = await tx.moneyTransferClaim.findMany({
      where: { transferId, status: "REFUNDED" },
      select: { amount: true },
    });
    const refundedAmount = refundedClaims.reduce((sum, claim) => sum + claim.amount, 0);

    const settled = await tx.moneyTransfer.updateMany({
      where: { id: transferId, status: "PENDING" },
      data: { status: "REFUNDED", refundedAt: now },
    });
    if (settled.count !== 1) throw new Error("MONEY_TRANSFER_ALREADY_SETTLED");

    await tx.wallet.upsert({
      where: { userId: transfer.senderId },
      create: { userId: transfer.senderId, balance: refundedAmount },
      update: { balance: { increment: refundedAmount } },
    });

    const peerId =
      transfer.recipientCount === 1
        ? (transfer.recipientId ?? transfer.claims[0]?.userId ?? null)
        : null;
    const peer = peerId
      ? await tx.user.findUnique({ where: { id: peerId }, select: { nickname: true } })
      : null;
    await tx.walletTransaction.create({
      data: {
        walletId: transfer.senderId,
        amount: refundedAmount,
        kind: "REFUND",
        note:
          transfer.kind === "RED_PACKET"
            ? "Hoàn tiền hồng bao chưa nhận"
            : "Hoàn tiền chuyển khoản chưa nhận",
        peerId,
        peerName: peer?.nickname ?? "",
      },
    });

    if (transfer.message) {
      const members = await tx.conversationMember.findMany({
        where: { conversationId: transfer.message.conversationId },
        select: { userId: true },
      });
      await tx.outbox.createMany({
        data: members.map((member) => ({
          event: "money:refunded",
          room: `user:${member.userId}`,
          payload: {
            conversationId: transfer.message!.conversationId,
            messageId: transfer.message!.id,
            transferId: transfer.id,
            status: "REFUNDED",
            refundedAt: now,
            refundedAmount,
            claimedCount: transfer.claimedCount,
            recipientCount: transfer.recipientCount,
          },
        })),
      });
    }
    return refundedAmount;
  });
}

/// Refunds every red packet / transfer that is still PENDING past the 24 hour
/// window. Safe to call from several processes at once.
export async function expireMoneyTransfers(now = new Date()) {
  const cutoff = new Date(now.getTime() - moneyExpiryMs);
  const due = await db.moneyTransfer.findMany({
    where: { status: "PENDING", createdAt: { lte: cutoff } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });
  let refunded = 0;
  for (const transfer of due) {
    try {
      if ((await refundTransfer(transfer.id, now)) !== null) refunded++;
    } catch (error) {
      // One broken transfer must not stop the rest of the batch.
      console.error("[money-expiry] refund failed", transfer.id, error);
    }
  }
  return refunded;
}

/// Request-path sweep: at most one run per minute per server instance. The
/// instrumentation timer does the steady work; this keeps the state fresh for
/// deployments where the timer has not started yet.
export function maybeExpireMoneyTransfers(now = new Date()) {
  if (sweeping) return sweeping;
  if (now.getTime() - lastSweep < sweepIntervalMs) return Promise.resolve(0);
  sweeping = expireMoneyTransfers(now)
    .catch((error) => {
      console.error("[money-expiry] sweep failed", error);
      return 0;
    })
    .finally(() => {
      lastSweep = Date.now();
      sweeping = null;
    });
  return sweeping;
}

const sweepState = globalThis as unknown as {
  qchatMoneyExpiryTimer?: ReturnType<typeof setInterval>;
};

/// Starts the background sweep once per process. Next.js calls this from
/// `instrumentation.ts`; the timer is unref'ed so it never keeps a CLI alive.
export function startMoneyExpirySweep() {
  if (sweepState.qchatMoneyExpiryTimer) return;
  const run = () => {
    void expireMoneyTransfers().catch((error) =>
      console.error("[money-expiry] sweep failed", error),
    );
  };
  const timer = setInterval(run, sweepIntervalMs);
  timer.unref?.();
  sweepState.qchatMoneyExpiryTimer = timer;
  run();
}
