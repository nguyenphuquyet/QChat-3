import { randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../services/db";
import { requireCondition } from "../security/errors";
import { sendMessage } from "../services/messages";
import { coverSnapshotForTransfer, coversRoute } from "./covers";
import { uuid } from "../../../../packages/contracts";

const minTransfer = 1_000;
const maxTransfer = 50_000_000;

/// Wallets start empty. A new account must not receive a demo balance; funds
/// only arrive through transfers or an audited adjustment from the console.
async function ensureWallet(userId: string) {
  await db.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return db.wallet.findUniqueOrThrow({ where: { userId } });
}

async function history(userId: string) {
  return db.walletTransaction.findMany({
    where: { walletId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}

function transferIdFromMessage(text: string) {
  try {
    return z.object({ transferId: uuid }).parse(JSON.parse(text)).transferId;
  } catch {
    requireCondition(false, 400, "INVALID_MONEY_MESSAGE");
  }
}

export async function claimMoneyTransfer(userId: string, messageId: string) {
  return db.$transaction(async (tx) => {
    const message = await tx.message.findUnique({ where: { id: messageId } });
    requireCondition(
      message && ["TRANSFER", "RED_PACKET"].includes(message.kind),
      400,
      "INVALID_MONEY_MESSAGE",
    );
    const transfer = await tx.moneyTransfer.findUnique({
      where: { id: transferIdFromMessage(message.text) },
      include: { claims: { where: { userId } } },
    });
    requireCondition(
      transfer &&
        transfer.senderId === message.senderId &&
        (transfer.messageId === null || transfer.messageId === message.id),
      404,
      "MONEY_TRANSFER_NOT_FOUND",
    );
    const claim = transfer.claims[0];
    requireCondition(transfer.status !== "REFUNDED", 410, "MONEY_EXPIRED");
    requireCondition(claim, 403, "RECIPIENT_REQUIRED");

    if (claim.status === "PENDING") {
      const claimedAt = new Date();
      const claimed = await tx.moneyTransferClaim.updateMany({
        where: { transferId: transfer.id, userId, status: "PENDING" },
        data: { status: "CLAIMED", claimedAt },
      });
      if (claimed.count) {
        await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: claim.amount } },
        });
        const sender = await tx.user.findUniqueOrThrow({
          where: { id: transfer.senderId },
          select: { nickname: true },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: userId,
            amount: claim.amount,
            kind: transfer.kind,
            note: transfer.note,
            peerId: transfer.senderId,
            peerName: sender.nickname,
          },
        });
        const progress = await tx.moneyTransfer.update({
          where: { id: transfer.id },
          data: { claimedCount: { increment: 1 } },
        });
        const completed = progress.claimedCount >= progress.recipientCount;
        const settled = completed
            ? await tx.moneyTransfer.update({
                where: { id: transfer.id },
                data: { status: "CLAIMED", claimedAt },
              })
            : progress;
        const members = await tx.conversationMember.findMany({
          where: { conversationId: message.conversationId },
          select: { userId: true },
        });
        await tx.outbox.createMany({
          data: members.map((member) => ({
            event: "money:claimed",
            room: `user:${member.userId}`,
            payload: {
              conversationId: message.conversationId,
              messageId: message.id,
              transferId: transfer.id,
              status: settled.status,
              claimedAt,
              claimedCount: settled.claimedCount,
              recipientCount: settled.recipientCount,
            },
          })),
        });
      }
    }
    return tx.moneyTransfer.findUniqueOrThrow({
      where: { id: transfer.id },
      include: { claims: { where: { userId } } },
    });
  });
}

export type RedPacketSplit = "EQUAL" | "RANDOM";

/// Divides `amount` over `recipients`.
///
/// EQUAL gives every member the same share and scatters the odd đồng across
/// random members, so the same people are not always paid the extra unit.
/// RANDOM keeps the lucky-draw feel: one unit per member is reserved first,
/// then the rest is weighted, so nobody can receive a zero share.
export function splitRedPacket(
  amount: number,
  recipients: string[],
  mode: RedPacketSplit = "RANDOM",
) {
  requireCondition(amount >= recipients.length, 400, "AMOUNT_TOO_SMALL");
  const count = recipients.length;
  const shares = new Array<number>(count).fill(1);
  if (mode === "EQUAL") {
    const base = Math.floor(amount / count);
    shares.fill(base);
    let remainder = amount - base * count;
    const order = recipients.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index--) {
      const swap = randomInt(index + 1);
      [order[index], order[swap]] = [order[swap], order[index]];
    }
    for (let index = 0; remainder > 0; index++, remainder--) {
      shares[order[index]]++;
    }
  } else {
    const rest = amount - count;
    const weights = recipients.map(() => randomInt(40, 161));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const extras = weights.map((weight) =>
      Math.floor((rest * weight) / totalWeight),
    );
    let remainder = rest - extras.reduce((sum, extra) => sum + extra, 0);
    for (
      let index = 0;
      remainder > 0;
      index = (index + 1) % count, remainder--
    ) {
      extras[index]++;
    }
    for (let index = 0; index < count; index++) shares[index] += extras[index];
  }
  return recipients.map((userId, index) => ({ userId, amount: shares[index] }));
}

export async function walletRoute(
  userId: string,
  method: string,
  path: string[],
  body: unknown,
  url: URL,
) {
  const [, sub] = path;
  if (sub === "covers" || sub === "designer" || sub === "designers") {
    return coversRoute(userId, method, path, body, url);
  }
  if (!sub && method === "GET") {
    const wallet = await ensureWallet(userId);
    return { balance: wallet.balance, transactions: await history(userId) };
  }
  if (sub === "transactions" && method === "GET") {
    const wallet = await ensureWallet(userId);
    return { balance: wallet.balance, transactions: await history(userId) };
  }
  if (sub === "transfer" && method === "POST") {
    const input = z
      .object({
        to: z.string().trim().min(3).max(32),
        amount: z.number().int().min(minTransfer).max(maxTransfer),
        kind: z.enum(["TRANSFER", "RED_PACKET"]).default("TRANSFER"),
        note: z.string().trim().max(100).default(""),
        conversationId: uuid.optional(),
        coverId: z.union([uuid, z.literal("default")]).optional(),
        // Group red packets only. Ignored for a transfer or a one-person
        // packet, and defaulted for clients that predate the option.
        splitMode: z.enum(["EQUAL", "RANDOM"]).default("RANDOM"),
      })
      .strict()
      .parse(body);
    const cover =
      input.kind === "RED_PACKET" &&
      input.coverId &&
      input.coverId !== "default"
        ? await coverSnapshotForTransfer(userId, input.coverId)
        : null;
    const peer = await db.user.findUnique({
      where: { qchatId: input.to },
      select: { id: true, nickname: true, disabled: true },
    });
    requireCondition(peer && !peer.disabled, 404, "USER_NOT_FOUND");
    requireCondition(peer.id !== userId, 400, "INVALID_TARGET");
    let recipients = [peer.id];
    if (input.conversationId) {
      const conversation = await db.conversation.findUnique({
        where: { id: input.conversationId },
        include: { members: { select: { userId: true } } },
      });
      const memberIds = conversation?.members.map((m) => m.userId) ?? [];
      requireCondition(
        memberIds.includes(userId) &&
          (conversation?.kind === "DIRECT"
              ? memberIds.includes(peer.id)
              : input.kind === "RED_PACKET"),
        400,
        "INVALID_CONVERSATION",
      );
      if (conversation?.kind === "GROUP") {
        recipients = memberIds.filter((memberId) => memberId !== userId);
        requireCondition(recipients.length > 0, 400, "NO_RED_PACKET_RECIPIENTS");
      }
    }
    await ensureWallet(userId);
    await Promise.all(recipients.map(ensureWallet));
    const sender = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { nickname: true },
    });
    if (!input.conversationId) {
      const wallet = await db.$transaction(async (tx) => {
        const debit = await tx.wallet.updateMany({
          where: { userId, balance: { gte: input.amount } },
          data: { balance: { decrement: input.amount } },
        });
        requireCondition(debit.count === 1, 400, "INSUFFICIENT_FUNDS");
        await tx.wallet.update({
          where: { userId: peer.id },
          data: { balance: { increment: input.amount } },
        });
        await tx.walletTransaction.createMany({
          data: [
            {
              walletId: userId,
              amount: -input.amount,
              kind: input.kind,
              note: input.note,
              peerId: peer.id,
              peerName: peer.nickname,
            },
            {
              walletId: peer.id,
              amount: input.amount,
              kind: input.kind,
              note: input.note,
              peerId: userId,
              peerName: sender.nickname,
            },
          ],
        });
        return tx.wallet.findUniqueOrThrow({ where: { userId } });
      });
      return { balance: wallet.balance, transactions: await history(userId) };
    }

    const soleRecipient = recipients[0];
    const grouped = input.kind === "RED_PACKET" && recipients.length > 1;
    const transfer = await db.$transaction(async (tx) => {
      const debit = await tx.wallet.updateMany({
        where: { userId, balance: { gte: input.amount } },
        data: { balance: { decrement: input.amount } },
      });
      requireCondition(debit.count === 1, 400, "INSUFFICIENT_FUNDS");
      await tx.walletTransaction.create({
        data: {
          walletId: userId,
          amount: -input.amount,
          kind: input.kind,
          note: input.note,
          peerId: peer.id,
          peerName: peer.nickname,
        },
      });
      const shares = grouped
        ? splitRedPacket(input.amount, recipients, input.splitMode)
        : [{ userId: soleRecipient, amount: input.amount }];
      const pending = await tx.moneyTransfer.create({
        data: {
          id: randomUUID(),
          senderId: userId,
          recipientId: recipients.length === 1 ? soleRecipient : null,
          amount: input.amount,
          kind: input.kind,
          note: input.note,
          recipientCount: shares.length,
          splitMode: grouped ? input.splitMode : "EQUAL",
          ...(cover
            ? {
                cover: { connect: { id: cover.id } },
                coverDesign: cover.design as Prisma.InputJsonValue,
              }
            : {}),
          claims: { create: shares },
        },
      });
      return pending;
    });
    try {
      const message = await sendMessage(userId, {
        conversationId: input.conversationId,
        clientId: randomUUID(),
        kind: input.kind,
        text: JSON.stringify({
          amount: input.amount,
          note: input.note,
          transferId: transfer.id,
          ...(grouped ? { splitMode: input.splitMode } : {}),
          ...(cover ? { coverId: cover.id, cover: cover.design } : {}),
        }),
      });
      await db.moneyTransfer.update({
        where: { id: transfer.id },
        data: { messageId: message.id },
      });
    } catch (error) {
      await db.$transaction(async (tx) => {
        const refunded = await tx.moneyTransfer.updateMany({
          where: { id: transfer.id, status: "PENDING" },
          data: { status: "REFUNDED", refundedAt: new Date() },
        });
        if (!refunded.count) return;
        await tx.moneyTransferClaim.updateMany({
          where: { transferId: transfer.id, status: "PENDING" },
          data: { status: "REFUNDED" },
        });
        await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: input.amount } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: userId,
            amount: input.amount,
            kind: "REFUND",
            note: "Hoàn tiền do không gửi được tin nhắn",
            peerId: peer.id,
            peerName: peer.nickname,
          },
        });
      });
      throw error;
    }
    const wallet = await db.wallet.findUniqueOrThrow({ where: { userId } });
    return { balance: wallet.balance, transactions: await history(userId) };
  }
}
