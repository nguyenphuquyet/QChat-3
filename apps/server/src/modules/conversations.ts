import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "../services/db";
import {
  membership,
  publicUser,
  sendMessage,
  receipt,
  unblocked,
} from "../services/messages";
import { requireCondition } from "../security/errors";
import { messageSchema, uuid } from "../../../../packages/contracts";

async function notifyConversation(tx: Prisma.TransactionClient, id: string) {
  const members = await tx.conversationMember.findMany({ where: { conversationId: id } });
  await tx.outbox.createMany({ data: members.map(member => ({
    event: "conversation:updated", room: `user:${member.userId}`,
    payload: { conversationId: id },
  })) });
}
export async function conversationsRoute(
  userId: string,
  method: string,
  path: string[],
  body: unknown,
  url: URL,
) {
  const [, id, sub, target] = path;
  if (!id) {
    if (method === "GET") {
      const conversations = await db.conversation.findMany({
        where: { members: { some: { userId, hidden: false } } },
        include: {
          members: { include: { user: { select: publicUser } } },
          messages: {
            where: { states: { none: { userId, hidden: true } } },
            orderBy: { sequence: "desc" }, take: 1,
            include: {
              media: { select: { mime: true } },
              moneyTransfer: {
                select: {
                  status: true,
                  claimedAt: true,
                  refundedAt: true,
                  createdAt: true,
                  claimedCount: true,
                  recipientCount: true,
                  splitMode: true,
                  claims: {
                    where: { userId },
                    select: { amount: true, status: true, claimedAt: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      return conversations.map(c => ({
        ...c,
        messages: c.messages.filter(message =>
          message.sequence > (c.members.find(member => member.userId === userId)?.clearedSequence ?? 0)),
      }));
    }
    if (method === "POST") {
      const v = z
        .object({
          memberIds: z.array(uuid).min(1).max(99),
          title: z.string().max(100).default(""),
          kind: z.enum(["DIRECT", "GROUP"]).default("DIRECT"),
        })
        .strict()
        .parse(body);
      const peers = [...new Set(v.memberIds)].filter((x) => x !== userId);
      requireCondition(
        peers.length > 0 && (v.kind === "GROUP" || peers.length === 1),
        400,
        "INVALID_MEMBERS",
      );
      for (const peer of peers) {
        await unblocked(userId, peer);
        requireCondition(
          await db.friendship.findUnique({
            where: { ownerId_friendId: { ownerId: userId, friendId: peer } },
          }),
          403,
          "FRIEND_REQUIRED",
        );
      }
      const directKey =
        v.kind === "DIRECT" ? [userId, ...peers].sort().join(":") : null;
      const data = {
        kind: v.kind,
        title: v.title,
        directKey,
        members: {
          create: [
            { userId, role: "OWNER" },
            ...peers.map((userId) => ({ userId, role: "MEMBER" })),
          ],
        },
      };
      return directKey
        ? db.conversation.upsert({
            where: { directKey },
            create: data,
            update: {},
          })
        : db.conversation.create({ data });
    }
    return;
  }
  const m = await membership(userId, uuid.parse(id));
  if (sub === "wallpaper" && method === "PATCH") {
    const data = z.object({
      wallpaperColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
      wallpaperMediaId: uuid.nullable(),
    }).strict().refine(v => !(v.wallpaperColor && v.wallpaperMediaId)).parse(body);
    return db.$transaction(async tx => {
      // Serialize shared settings and role changes, then check current permissions.
      await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const c = await tx.conversation.findUniqueOrThrow({ where: { id } });
      const actor = await tx.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: id, userId } },
      });
      requireCondition(actor && (c.kind === "DIRECT" || ["OWNER", "ADMIN"].includes(actor.role)));
      if (data.wallpaperMediaId) {
        const media = await tx.media.findUnique({ where: { id: data.wallpaperMediaId } });
        requireCondition(media && media.ownerId === userId && media.status === "READY" &&
          media.mime.startsWith("image/"), 400, "INVALID_WALLPAPER");
      }
      const updated = await tx.conversation.update({ where: { id }, data });
      await notifyConversation(tx, id);
      return updated;
    });
  }
  if (sub === "messages") {
    if (method === "POST")
      return sendMessage(
        userId,
        messageSchema.parse({ ...(body as object), conversationId: id }),
      );
    if (method === "GET") {
      const after = z.coerce
        .number()
        .int()
        .nonnegative()
        .parse(url.searchParams.get("after") ?? 0);
      const before = url.searchParams.get("before");
      const search = url.searchParams.get("q")?.slice(0, 100);
      return db.message.findMany({
        where: {
          conversationId: id,
          sequence: before
            ? { lt: z.coerce.number().int().positive().parse(before), gt: m.clearedSequence }
            : { gt: Math.max(after, m.clearedSequence) },
          states: { none: { userId, hidden: true } },
          ...(search
            ? {
                text: { contains: search, mode: Prisma.QueryMode.insensitive },
                recalledAt: null,
              }
            : {}),
        },
        orderBy: { sequence: before ? "desc" : "asc" },
        take: 50,
        include: {
          sender: { select: publicUser },
          moneyTransfer: {
            select: {
              status: true,
              claimedAt: true,
              refundedAt: true,
              createdAt: true,
              claimedCount: true,
              recipientCount: true,
              splitMode: true,
              claims: {
                where: { userId },
                select: { amount: true, status: true, claimedAt: true },
              },
            },
          },
        },
      });
    }
  }
  if ((sub === "read" || sub === "delivered") && method === "POST")
    return receipt(
      userId,
      id,
      z.object({ sequence: z.number().int().nonnegative() }).parse(body)
        .sequence,
      sub === "read",
    );
  if (sub === "state" && method === "PATCH") {
    const data = z
      .object({
        muted: z.boolean().optional(),
        pinned: z.boolean().optional(),
        hidden: z.boolean().optional(),
        markedUnread: z.boolean().optional(),
      })
      .strict()
      .parse(body);
    return db.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data,
    });
  }
  if (sub === "history" && method === "DELETE") {
    const { hide } = z.object({ hide: z.boolean().default(false) }).strict().parse(body ?? {});
    return db.$transaction(async tx => {
      const c = await tx.conversation.findUniqueOrThrow({ where: { id } });
      return tx.conversationMember.update({
        where: { conversationId_userId: { conversationId: id, userId } },
        data: {
          clearedSequence: c.sequence, readSequence: c.sequence,
          deliveredSequence: c.sequence, markedUnread: false,
          ...(hide ? { hidden: true } : {}),
        },
      });
    });
  }
  if (!sub && method === "DELETE") {
    const c = await db.conversation.findUniqueOrThrow({ where: { id } });
    requireCondition(c.kind === "GROUP" && m.role === "OWNER", 403, "OWNER_REQUIRED");
    return db.$transaction(async tx => {
      const members = await tx.conversationMember.findMany({ where: { conversationId: id } });
      await tx.conversation.delete({ where: { id } });
      await tx.outbox.createMany({ data: members.map(member => ({
        event: "conversation:deleted", room: `user:${member.userId}`,
        payload: { conversationId: id },
      })) });
      return { ok: true };
    });
  }
  if (sub === "members") {
    if (method === "GET")
      return db.conversationMember.findMany({
        where: { conversationId: id },
        include: { user: { select: publicUser } },
      });
    const c = await db.conversation.findUniqueOrThrow({ where: { id } });
    requireCondition(c.kind === "GROUP");
    if (method === "POST") {
      requireCondition(["OWNER", "ADMIN"].includes(m.role));
      const { userId: peer } = z.object({ userId: uuid }).strict().parse(body);
      await unblocked(userId, peer);
      requireCondition(
        await db.friendship.findUnique({
          where: { ownerId_friendId: { ownerId: userId, friendId: peer } },
        }),
      );
      return db.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: id, userId: peer } },
        create: { conversationId: id, userId: peer },
        update: {},
      });
    }
    if (method === "DELETE" && target) {
      const peer = await membership(uuid.parse(target), id);
      requireCondition(peer.role !== "OWNER", 409, "TRANSFER_OWNERSHIP_FIRST");
      requireCondition(
        target === userId ||
          m.role === "OWNER" ||
          (m.role === "ADMIN" && peer.role === "MEMBER"),
      );
      await db.conversationMember.delete({
        where: {
          conversationId_userId: { conversationId: id, userId: target },
        },
      });
      return { ok: true };
    }
    if (method === "PATCH" && target) {
      requireCondition(m.role === "OWNER" && target !== userId);
      const { role } = z
        .object({ role: z.enum(["OWNER", "ADMIN", "MEMBER"]) })
        .strict()
        .parse(body);
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const actor = await tx.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: id, userId } },
        });
        requireCondition(actor?.role === "OWNER");
        const peer = await tx.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: id, userId: uuid.parse(target) } },
        });
        requireCondition(peer, 404, "NOT_FOUND");
        if (role === "ADMIN" && peer.role !== "ADMIN") {
          const admins = await tx.conversationMember.count({ where: { conversationId: id, role: "ADMIN" } });
          requireCondition(admins < 3, 409, "ADMIN_LIMIT_REACHED");
        }
        if (role === "OWNER")
          await tx.conversationMember.update({
            where: { conversationId_userId: { conversationId: id, userId } },
            data: { role: "MEMBER" },
          });
        await tx.conversationMember.update({
          where: {
            conversationId_userId: {
              conversationId: id,
              userId: uuid.parse(target),
            },
          },
          data: { role },
        });
        await notifyConversation(tx, id);
      });
      return { ok: true };
    }
  }
  if (!sub && method === "GET")
    return db.conversation.findUnique({
      where: { id },
      include: { members: { include: { user: { select: publicUser } } } },
    });
  if (!sub && method === "PATCH") {
    requireCondition(["OWNER", "ADMIN"].includes(m.role));
    const data = z
      .object({
        title: z.string().min(1).max(100).optional(),
        announcement: z.string().max(2000).optional(),
      })
      .strict()
      .parse(body);
    return db.conversation.update({ where: { id }, data });
  }
}
