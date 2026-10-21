import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { z } from "zod";
import { authenticate } from "../../server/src/security/auth";
import { ApiError, requireCondition } from "../../server/src/security/errors";
import { rateLimit } from "../../server/src/security/rate-limit";
import { db } from "../../server/src/services/db";
import {
  membership,
  sendMessage,
  receipt,
  unblocked,
} from "../../server/src/services/messages";
import {
  messageSchema,
  receiptSchema,
  signalSchema,
  uuid,
} from "../../../packages/contracts";
const pub = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
const sub = pub.duplicate();
const http = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end('{"service":"qchat-realtime"}');
});
const io = new Server(http, {
  cors: { origin: process.env.WEB_ORIGIN ?? "https://localhost" },
  maxHttpBufferSize: 128000,
  transports: ["websocket"],
});
io.adapter(createAdapter(pub, sub));
io.use(async (socket, next) => {
  try {
    socket.data.auth = await authenticate(
      String(socket.handshake.auth.token ?? ""),
    );
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
});
io.on("connection", (socket) => {
  const auth = socket.data.auth as Awaited<ReturnType<typeof authenticate>>;
  socket.join(`user:${auth.userId}`);
  function event<T>(
    name: string,
    schema: z.ZodType<T>,
    fn: (v: T) => Promise<unknown>,
  ) {
    socket.on(name, async (raw, ack) => {
      try {
        const current = await authenticate(
          String(socket.handshake.auth.token ?? ""),
        );
        requireCondition(current.sessionId === auth.sessionId);
        await rateLimit(`socket:${auth.userId}`, 240);
        const result = await fn(schema.parse(raw));
        if (typeof ack === "function") ack({ ok: true, data: result });
      } catch (error) {
        if (typeof ack === "function")
          ack({
            ok: false,
            error:
              error instanceof ApiError
                ? error.code
                : error instanceof z.ZodError
                  ? "VALIDATION_ERROR"
                  : "SERVICE_ERROR",
          });
      }
    });
  }
  event(
    "conversation:join",
    z.object({ conversationId: uuid }).strict(),
    async (v) => {
      await membership(auth.userId, v.conversationId);
      return { ok: true };
    },
  );
  event("message:send", messageSchema, async (v) => {
    const result = await sendMessage(auth.userId, v);
    socket.emit("message:ack", result);
    return result;
  });
  for (const name of ["message:delivered", "message:read"])
    event(name, receiptSchema, async (v) => {
      const r = await receipt(
        auth.userId,
        v.conversationId,
        v.sequence,
        name === "message:read",
      );
      return r;
    });
  event(
    "conversation:typing",
    z.object({ conversationId: uuid, typing: z.boolean() }).strict(),
    async (v) => {
      await membership(auth.userId, v.conversationId);
      await notifyMembers(v.conversationId, "conversation:typing", {
        ...v,
        userId: auth.userId,
      });
      return { ok: true };
    },
  );
  event(
    "call:offer",
    z
      .object({
        conversationId: uuid,
        kind: z.enum(["AUDIO", "VIDEO"]),
        data: z.string().max(64000),
      })
      .strict(),
    async (v) => {
      await membership(auth.userId, v.conversationId);
      const c = await db.conversation.findUniqueOrThrow({
        where: { id: v.conversationId },
        include: { members: true },
      });
      requireCondition(c.kind === "DIRECT" && c.members.length === 2);
      const calleeId = c.members.find((m) => m.userId !== auth.userId)!.userId;
      await unblocked(auth.userId, calleeId);
      const call = await db.callSession.create({
        data: {
          conversationId: c.id,
          callerId: auth.userId,
          calleeId,
          kind: v.kind,
        },
      });
      io.to(`user:${calleeId}`).emit("call:offer", {
        callId: call.id,
        callerId: auth.userId,
        kind: v.kind,
        data: v.data,
      });
      return { callId: call.id };
    },
  );
  for (const name of ["call:answer", "call:ice-candidate", "call:end"])
    event(name, signalSchema, async (v) => {
      const call = await db.callSession.findUnique({ where: { id: v.callId } });
      requireCondition(
        call && [call.callerId, call.calleeId].includes(auth.userId),
      );
      await membership(auth.userId, call.conversationId);
      requireCondition(
        ["RINGING", "ACTIVE"].includes(call.status),
        409,
        "CALL_ENDED",
      );
      if (name === "call:answer") {
        requireCondition(
          call.calleeId === auth.userId && call.status === "RINGING",
        );
        await db.callSession.update({
          where: { id: call.id },
          data: { status: "ACTIVE" },
        });
      }
      if (name === "call:end")
        await db.callSession.update({
          where: { id: call.id },
          data: { status: "ENDED", endedAt: new Date() },
        });
      const peer =
        auth.userId === call.callerId ? call.calleeId : call.callerId;
      io.to(`user:${peer}`).emit(name, { ...v, userId: auth.userId });
      return { ok: true };
    });
});
async function notifyMembers(id: string, event: string, payload: unknown) {
  const members = await db.conversationMember.findMany({
    where: { conversationId: id },
    select: { userId: true },
  });
  for (const m of members) io.to(`user:${m.userId}`).emit(event, payload);
}
// PostgreSQL outbox is durable. Clients deduplicate by message ID; a crash after emit may replay.
let working = false;
const timer = setInterval(async () => {
  if (working) return;
  working = true;
  try {
    const events = await db.outbox.findMany({
      where: { deliveredAt: null },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    for (const e of events) {
      io.to(e.room).emit(e.event, e.payload);
      await db.outbox.update({
        where: { id: e.id },
        data: { deliveredAt: new Date() },
      });
    }
    const expired = await db.callSession.findMany({
      where: {
        status: "RINGING",
        createdAt: { lt: new Date(Date.now() - 45000) },
      },
    });
    for (const call of expired) {
      await db.callSession.update({
        where: { id: call.id },
        data: { status: "MISSED", endedAt: new Date() },
      });
      for (const id of [call.callerId, call.calleeId])
        io.to(`user:${id}`).emit("call:end", {
          callId: call.id,
          reason: "TIMEOUT",
        });
    }
  } catch {
    console.error("Realtime worker unavailable");
  } finally {
    working = false;
  }
}, 500);
// Revalidate idle connections too; expired/revoked credentials cannot keep receiving messages.
const sessionTimer = setInterval(async () => {
  for (const socket of io.sockets.sockets.values()) {
    try {
      await authenticate(String(socket.handshake.auth.token ?? ""));
    } catch {
      socket.disconnect(true);
    }
  }
}, 5000);
http.listen(Number(process.env.REALTIME_PORT ?? 3001), "0.0.0.0");
async function shutdown() {
  clearInterval(timer);
  clearInterval(sessionTimer);
  await io.close();
  await pub.quit();
  await sub.quit();
  await db.$disconnect();
  http.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
