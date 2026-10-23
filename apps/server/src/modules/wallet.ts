import { randomInt, randomUUID } from "node:crypto";
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

function splitRedPacket(amount: number, recipients: string[]) {
  requireCondition(amount >= recipients.length, 400, "AMOUNT_TOO_SMALL");
  const weights = recipients.map(() => randomInt(40, 161));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map((weight) => Math.floor((amount * weight) / totalWeight));
  let remainder = amount - shares.reduce((sum, share) => sum + share, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % shares.length) {
    shares[index]++;
    remainder--;
  }
  return recipients.map((userId, index) => ({ userId, amount: shares[index] }));
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
        requireCondition(recipients.isNotEmpty, 400, "NO_RED_PACKET_RECIPIENTS");
      }
    }
    await ensureWallet(userId);
    await Future.all(recipients.map(ensureWallet));
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
      const shares = input.kind === "RED_PACKET" && recipients.length > 1
          ? splitRedPacket(input.amount, recipients)
          : [{ userId: recipients.single, amount: input.amount }];
      const pending = await tx.moneyTransfer.create({
        data: {
          id: randomUUID(),
          senderId: userId,
          recipientId: recipients.length == 1 ? recipients.single : null,
          amount: input.amount,
          kind: input.kind,
          note: input.note,
          recipientCount: shares.length,
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
          data: { status: "REFUNDED" },
        });
        if (!refunded.count) return;
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
