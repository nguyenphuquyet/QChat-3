import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { authenticate } from "../security/auth";
import { ApiError, requireCondition } from "../security/errors";
import { rateLimit, redis } from "../security/rate-limit";
import { authRoute } from "../modules/auth";
import { friendsRoute } from "../modules/friends";
import { conversationsRoute } from "../modules/conversations";
import { messagesRoute } from "../modules/messages";
import { momentsRoute } from "../modules/moments";
import { mediaRoute } from "../modules/media";
import { walletRoute } from "../modules/wallet";
import { usersRoute } from "../modules/users";
import { publicUser } from "./messages";
import { searchRoute } from "../modules/search";
import { maybeExpireMoneyTransfers } from "./money-expiry";
import { miniAppsRoute } from "../modules/miniapps";
import { isLinkPlatform, readSiteLinks } from "./site-links";
import { uuid } from "../../../../packages/contracts";
export async function handle(request: Request) {
  try {
    // Unclaimed money goes back to the sender after 24 hours. The sweep is
    // throttled to one run per minute and the timer in instrumentation.ts is
    // the primary trigger, so this stays cheap on the request path.
    await maybeExpireMoneyTransfers();
    const url = new URL(request.url),
      path = url.pathname.replace(/^\/api\//, "").split("/"),
      method = request.method;
    const origin = request.headers.get("origin");
    requireCondition(
      !origin || origin === process.env.WEB_ORIGIN,
      403,
      "ORIGIN_NOT_ALLOWED",
    );
    if (path[0] === "health") {
      await db.$queryRaw`SELECT 1`;
      await redis.ping();
      return Response.json({ ok: true });
    }
    let body: unknown = {};
    if (
      !["GET", "HEAD", "DELETE"].includes(method) ||
      request.headers.get("content-type")?.includes("json")
    ) {
      const text = await request.text();
      requireCondition(text.length <= 128000, 413, "BODY_TOO_LARGE");
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        throw new ApiError(400, "INVALID_JSON");
      }
    }
    if (
      path[0] === "auth" &&
      method === "POST" &&
      !["logout"].includes(path[1])
    ) {
      await rateLimit(
        `auth:${request.headers.get("x-real-ip") ?? "unknown"}`,
        20,
      );
      const result = await authRoute(path[1], body);
      if (result !== undefined) return Response.json(result);
    }
    const auth = await authenticate(
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
    );
    const { userId, sessionId } = auth;
    await rateLimit(`user:${userId}`, 180);
    let result: unknown;
    switch (path[0]) {
      case "search":
        if (method === "GET") result = await searchRoute(userId, url);
        break;
      case "users":
        result = await usersRoute(userId, method, path, body, url);
        break;
      case "friends":
        result = await friendsRoute(userId, method, path, body);
        break;
      case "conversations":
        result = await conversationsRoute(userId, method, path, body, url);
        break;
      case "messages":
        result = await messagesRoute(userId, method, path, body);
        break;
      case "moments":
        result = await momentsRoute(userId, method, path, body, url);
        break;
      case "media":
        result = await mediaRoute(userId, method, path, body);
        break;
      case "wallet":
        result = await walletRoute(userId, method, path, body);
        break;
      case "miniapps":
        result = await miniAppsRoute(
          userId,
          auth.role,
          method,
          path,
          body,
          url,
        );
        break;
      case "auth":
        if (path[1] === "logout" && method === "POST") {
          const v = z
            .object({ all: z.boolean().default(false) })
            .strict()
            .parse(body);
          await db.userSession.updateMany({
            where: v.all ? { userId } : { id: sessionId },
            data: { revokedAt: new Date() },
          });
          result = { ok: true };
        }
        if (path[1] === "sessions" && method === "GET")
          result = (
            await db.userSession.findMany({
              where: { userId, revokedAt: null },
              select: {
                id: true,
                deviceName: true,
                createdAt: true,
                expiresAt: true,
              },
            })
          ).map((session) => ({
            ...session,
            current: session.id === sessionId,
          }));
        if (path[1] === "sessions" && path[2] && method === "DELETE") {
          await db.userSession.updateMany({
            where: { id: uuid.parse(path[2]), userId },
            data: { revokedAt: new Date() },
          });
          result = { ok: true };
        }
        break;
      case "blocks":
        if (method === "GET")
          result = await db.blockedUser.findMany({
            where: { ownerId: userId },
            include: { target: { select: publicUser } },
          });
        if (method === "POST") {
          const { targetId } = z
            .object({ targetId: uuid })
            .strict()
            .parse(body);
          requireCondition(targetId !== userId, 400, "INVALID_TARGET");
          result = await db.blockedUser.upsert({
            where: { ownerId_targetId: { ownerId: userId, targetId } },
            create: { ownerId: userId, targetId },
            update: {},
          });
        }
        if (method === "DELETE") {
          await db.blockedUser.deleteMany({
            where: { ownerId: userId, targetId: uuid.parse(path[1]) },
          });
          result = { ok: true };
        }
        break;
      case "favorites":
        if (method === "GET")
          result = await db.message.findMany({
            where: {
              states: { some: { userId, favorite: true } },
              conversation: { members: { some: { userId } } },
            },
            take: 100,
            orderBy: { createdAt: "desc" },
          });
        break;
      case "devices":
        if (method === "POST") {
          const v = z
            .object({
              token: z.string().min(16).max(4096),
              platform: z.enum(["android", "ios"]),
            })
            .strict()
            .parse(body);
          result = await db.pushDevice.upsert({
            where: { token: v.token },
            create: { ...v, userId },
            update: { userId, platform: v.platform },
          });
        }
        break;
      case "calls":
        if (method === "GET")
          result = await db.callSession.findMany({
            where: { OR: [{ callerId: userId }, { calleeId: userId }] },
            orderBy: { createdAt: "desc" },
            take: 50,
          });
        break;
      case "reports":
        if (method === "POST") {
          const v = z
            .object({ targetId: uuid, reason: z.string().min(1).max(2000) })
            .strict()
            .parse(body);
          result = await db.report.create({
            data: { ...v, reporterId: userId },
          });
        }
        break;
      case "feedback":
        if (method === "POST") {
          const v = z
            .object({ content: z.string().trim().min(1).max(2000) })
            .strict()
            .parse(body);
          result = await db.feedback.create({
            data: { userId, content: v.content },
            select: { id: true, status: true, createdAt: true },
          });
        }
        break;
      case "admin":
        requireCondition(auth.role === "ADMIN");
        if (method === "GET" && path[1] === "stats") {
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const activity = await Promise.all(
            Array.from({ length: 7 }, async (_, i) => {
              const start = new Date(today.getTime() - (6 - i) * 86400000);
              const end = new Date(start.getTime() + 86400000);
              return {
                date: start.toISOString(),
                messages: await db.message.count({
                  where: { createdAt: { gte: start, lt: end } },
                }),
              };
            }),
          );
          result = {
            users: await db.user.count(),
            messages: await db.message.count(),
            conversations: await db.conversation.count(),
            disabledUsers: await db.user.count({ where: { disabled: true } }),
            pendingReports: await db.report.count({
              where: { status: "OPEN" },
            }),
            pendingFeedback: await db.feedback.count({
              where: { status: "OPEN" },
            }),
            activeSessions: await db.userSession.count({
              where: {
                revokedAt: null,
                user: { disabled: false },
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
            }),
            activity,
            storage:
              (await db.media.aggregate({ _sum: { size: true } }))._sum.size ??
              0,
          };
        }
        if (method === "GET" && path[1] === "users") {
          const page = z.coerce
            .number()
            .int()
            .min(1)
            .max(100000)
            .parse(url.searchParams.get("page") ?? 1);
          const query = z
            .string()
            .max(100)
            .parse(url.searchParams.get("q") ?? "")
            .trim();
          const where = query
            ? {
                OR: [
                  {
                    qchatId: { contains: query, mode: "insensitive" as const },
                  },
                  {
                    nickname: { contains: query, mode: "insensitive" as const },
                  },
                  { email: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {};
          const [items, total] = await Promise.all([
            db.user.findMany({
              where,
              skip: (page - 1) * 20,
              take: 20,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                qchatId: true,
                nickname: true,
                email: true,
                role: true,
                disabled: true,
                createdAt: true,
              },
            }),
            db.user.count({ where }),
          ]);
          result = { items, total, page, pageSize: 20 };
        }
        if (method === "GET" && path[1] === "reports")
          result = await db.report.findMany({
            take: 100,
            orderBy: { createdAt: "desc" },
          });
        if (method === "GET" && path[1] === "feedback")
          result = await db.feedback.findMany({
            take: 100,
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: { id: true, qchatId: true, nickname: true, email: true },
              },
            },
          });
        if (method === "PATCH" && path[1] === "feedback") {
          const v = z
            .object({ status: z.enum(["RESOLVED", "DISMISSED"]) })
            .strict()
            .parse(body);
          const targetId = uuid.parse(path[2]);
          await db.$transaction([
            db.feedback.update({
              where: { id: targetId },
              data: { status: v.status, handledAt: new Date() },
            }),
            db.auditLog.create({
              data: {
                actorId: userId,
                action: `FEEDBACK_${v.status}`,
                targetId,
              },
            }),
          ]);
          result = { ok: true };
        }
        if (method === "GET" && path[1] === "audit")
          result = await db.auditLog.findMany({
            take: 100,
            orderBy: { createdAt: "desc" },
          });
        if (method === "PATCH" && path[1] === "users") {
          const v = z.object({ disabled: z.boolean() }).strict().parse(body);
          const targetId = uuid.parse(path[2]);
          requireCondition(targetId !== userId, 400, "SELF_LOCK");
          await db.$transaction([
            db.user.update({ where: { id: targetId }, data: v }),
            db.auditLog.create({
              data: {
                actorId: userId,
                action: v.disabled ? "USER_LOCK" : "USER_UNLOCK",
                targetId,
              },
            }),
          ]);
          result = { ok: true };
        }
        if (method === "PATCH" && path[1] === "reports") {
          const v = z
            .object({ status: z.enum(["RESOLVED", "DISMISSED"]) })
            .strict()
            .parse(body);
          const targetId = uuid.parse(path[2]);
          await db.$transaction([
            db.report.update({ where: { id: targetId }, data: v }),
            db.auditLog.create({
              data: { actorId: userId, action: `REPORT_${v.status}`, targetId },
            }),
          ]);
          result = { ok: true };
        }
        if (method === "GET" && path[1] === "links")
          result = await readSiteLinks();
        if (method === "PATCH" && path[1] === "links") {
          const platform = path[2] ?? "";
          requireCondition(isLinkPlatform(platform), 400, "UNKNOWN_PLATFORM");
          const v = z
            .object({
              label: z.string().trim().min(1).max(40),
              url: z.string().trim().max(500),
              note: z.string().trim().max(300),
              enabled: z.boolean(),
            })
            .strict()
            .parse(body);
          requireCondition(
            v.url === "" || /^(https?:\/\/\S+|\/\S*)$/i.test(v.url),
            400,
            "INVALID_URL",
          );
          await db.$transaction([
            db.siteLink.upsert({
              where: { platform },
              create: { platform, ...v },
              update: v,
            }),
            db.auditLog.create({
              data: {
                actorId: userId,
                action: "SITE_LINK_UPDATE",
                targetId: platform,
              },
            }),
          ]);
          result = { ok: true };
        }
        break;
    }
    if (result === undefined) throw new ApiError(404, "NOT_FOUND");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          issues: error.issues.map((i) => ({ path: i.path, code: i.code })),
        },
        { status: 400 },
      );
    if (error instanceof ApiError)
      return Response.json({ error: error.code }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return Response.json({ error: "ALREADY_EXISTS" }, { status: 409 });
      if (error.code === "P2025" || error.code === "P2003")
        return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("API request failed", {
      type: error instanceof Error ? error.name : "Unknown",
    });
    return Response.json({ error: "SERVICE_ERROR" }, { status: 500 });
  }
}
