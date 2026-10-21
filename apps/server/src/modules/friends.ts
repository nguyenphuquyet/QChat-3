import { z } from "zod";
import { db } from "../services/db";
import { publicUser, unblocked } from "../services/messages";
import { requireCondition } from "../security/errors";
import { uuid } from "../../../../packages/contracts";
export async function friendsRoute(
  userId: string,
  method: string,
  path: string[],
  body: unknown,
) {
  const [_, sub, id] = path;
  if (sub === "requests") {
    if (method === "GET")
      return db.friendRequest.findMany({
        where: { recipientId: userId, status: "PENDING" },
        include: { sender: { select: publicUser } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    if (method === "POST") {
      const v = z.object({ recipientId: uuid }).strict().parse(body);
      requireCondition(v.recipientId !== userId, 400, "SELF_REQUEST");
      await unblocked(userId, v.recipientId);
      requireCondition(
        await db.user.findFirst({
          where: { id: v.recipientId, allowRequests: true, disabled: false },
        }),
      );
      return db.friendRequest.upsert({
        where: {
          senderId_recipientId: {
            senderId: userId,
            recipientId: v.recipientId,
          },
        },
        create: { senderId: userId, recipientId: v.recipientId },
        update: { status: "PENDING" },
      });
    }
    if (method === "PATCH" && id) {
      const { accept } = z.object({ accept: z.boolean() }).strict().parse(body);
      return db.$transaction(async (tx) => {
        const request = await tx.friendRequest.findUnique({
          where: { id: uuid.parse(id) },
        });
        requireCondition(
          request &&
            request.recipientId === userId &&
            request.status === "PENDING",
        );
        await unblocked(userId, request.senderId);
        await tx.friendRequest.update({
          where: { id },
          data: { status: accept ? "ACCEPTED" : "REJECTED" },
        });
        if (accept)
          await tx.friendship.createMany({
            data: [
              { ownerId: userId, friendId: request.senderId },
              { ownerId: request.senderId, friendId: userId },
            ],
            skipDuplicates: true,
          });
        return { ok: true };
      });
    }
  }
  if (!sub && method === "GET")
    return db.friendship.findMany({
      where: { ownerId: userId },
      include: { friend: { select: publicUser } },
      orderBy: { friend: { nickname: "asc" } },
      take: 500,
    });
  if (sub && method === "PATCH") {
    const { remark } = z
      .object({ remark: z.string().max(64) })
      .strict()
      .parse(body);
    return db.friendship.update({
      where: {
        ownerId_friendId: { ownerId: userId, friendId: uuid.parse(sub) },
      },
      data: { remark },
    });
  }
  if (sub && method === "DELETE") {
    await db.friendship.deleteMany({
      where: {
        OR: [
          { ownerId: userId, friendId: uuid.parse(sub) },
          { ownerId: sub, friendId: userId },
        ],
      },
    });
    return { ok: true };
  }
}
