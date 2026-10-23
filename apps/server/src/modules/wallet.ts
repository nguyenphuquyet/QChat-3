import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../services/db";
import { requireCondition } from "../security/errors";
import { sendMessage } from "../services/messages";
import { uuid } from "../../../../packages/contracts";

const welcomeCredit = 50_000;
const minTransfer = 1_000;
const maxTransfer = 50_000_000;

async function ensureWallet(userId: string) {
  await db.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    // A single demo credit makes the wallet usable right after sign-up.
    const credit = await tx.wallet.updateMany({
      where: { userId, bonusGranted: false },
      data: { bonusGranted: true, balance: { increment: welcomeCredit } },
    });
    if (credit.count === 1) {
      await tx.walletTransaction.create({
        data: {
          walletId: userId,
          amount: welcomeCredit,
          kind: "WELCOME",
          note: "Quà tặng chào mừng",
        },
      });
    }
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

export async function walletRoute(
  userId: string,
  method: string,
  path: string[],
  body: unknown,
) {
  const [, sub] = path;
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
      })
      .strict()
      .parse(body);
    const peer = await db.user.findUnique({
      where: { qchatId: input.to },
      select: { id: true, nickname: true, disabled: true },
    });
    requireCondition(peer && !peer.disabled, 404, "USER_NOT_FOUND");
    requireCondition(peer.id !== userId, 400, "INVALID_TARGET");
    if (input.conversationId) {
      const conversation = await db.conversation.findUnique({
        where: { id: input.conversationId },
        include: { members: { select: { userId: true } } },
      });
      const memberIds = conversation?.members.map((m) => m.userId) ?? [];
      requireCondition(
        conversation?.kind === "DIRECT" &&
          memberIds.includes(userId) &&
          memberIds.includes(peer.id),
        400,
        "INVALID_CONVERSATION",
      );
    }
    await ensureWallet(userId);
    await ensureWallet(peer.id);
    const sender = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { nickname: true },
    });
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
      await tx.walletTransaction.create({
        data: {
          walletId: peer.id,
          amount: input.amount,
          kind: input.kind,
          note: input.note,
          peerId: userId,
          peerName: sender.nickname,
        },
      });
      return tx.wallet.findUniqueOrThrow({ where: { userId } });
    });
    if (input.conversationId) {
      try {
        await sendMessage(userId, {
          conversationId: input.conversationId,
          clientId: randomUUID(),
          kind: input.kind,
          text: JSON.stringify({ amount: input.amount, note: input.note }),
        });
      } catch (error) {
        // The money moved before the chat note; keep the transfer valid and
        // leave the failure to the server log rather than double-charging.
        console.error("Wallet message failed", {
          type: error instanceof Error ? error.name : "Unknown",
        });
      }
    }
    return { balance: wallet.balance, transactions: await history(userId) };
  }
}
