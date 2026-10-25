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
import { miniAppsRoute, miniAppReviewRoute } from "../modules/miniapps";
import { deleteMediaObjects } from "../modules/media";
import { deleteBuild } from "./miniapp-storage";
import {
  ADMIN_SECTIONS,
  canManage,
  isManager,
  normalizePermissions,
} from "../security/permissions";
import { isLinkPlatform, readSiteLinks } from "./site-links";
import {
  isPaymentServiceKey,
  paymentServiceGroups,
  readPaymentServices,
} from "./payment-services";
import { uuid } from "../../../../packages/contracts";
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const maxWalletAdjustment = 50_000_000;

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
          // Reports target a conversation. Requiring membership stops a client
          // from reporting a chat it cannot see.
          const member = await db.conversationMember.findUnique({
            where: {
              conversationId_userId: {
                conversationId: v.targetId,
                userId,
              },
            },
            select: { conversationId: true },
          });
          requireCondition(member, 404, "NOT_FOUND");
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
      case "admin": {
        // Every admin endpoint requires at least one management section. The
        // exact section is checked per route so a manager cannot reach screens
        // that were not granted to them.
        requireCondition(isManager(auth), 403, "FORBIDDEN");
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
            usersToday: await db.user.count({
              where: { createdAt: { gte: today } },
            }),
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
            totalMiniApps: await db.miniApp.count(),
            pendingMiniApps: await db.miniAppVersion.count({
              where: { status: "REVIEWING" },
            }),
            pendingMiniAppPermissions: await db.miniAppPermissionRequest.count({
              where: { status: "PENDING" },
            }),
            me: {
              userId,
              role: auth.role,
              permissions:
                auth.role === "ADMIN"
                  ? [...ADMIN_SECTIONS]
                  : normalizePermissions(auth.permissions),
            },
            activity,
            storage:
              (await db.media.aggregate({ _sum: { size: true } }))._sum.size ??
              0,
          };
        }
        if (method === "GET" && path[1] === "users" && !path[2]) {
          requireCondition(canManage(auth, "users"), 403, "FORBIDDEN");
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
                adminPermissions: true,
                disabled: true,
                createdAt: true,
              },
            }),
            db.user.count({ where }),
          ]);
          result = { items, total, page, pageSize: 20 };
        }
        if (method === "GET" && path[1] === "users" && path[2]) {
          requireCondition(canManage(auth, "users"), 403, "FORBIDDEN");
          const id = uuid.parse(path[2]);
          const user = await db.user.findUnique({
            where: { id },
            select: {
              id: true,
              qchatId: true,
              nickname: true,
              email: true,
              role: true,
              adminPermissions: true,
              disabled: true,
              createdAt: true,
            },
          });
          requireCondition(user, 404, "NOT_FOUND");
          const [sessions, counts, wallet] = await Promise.all([
            db.userSession.findMany({
              where: { userId: id, revokedAt: null },
              orderBy: { createdAt: "desc" },
              take: 10,
              select: {
                id: true,
                deviceName: true,
                createdAt: true,
                expiresAt: true,
              },
            }),
            Promise.all([
              db.message.count({ where: { senderId: id } }),
              db.moment.count({ where: { authorId: id } }),
              db.conversationMember.count({ where: { userId: id } }),
              db.miniApp.count({ where: { developerId: id } }),
              db.media.count({ where: { ownerId: id } }),
              db.report.count({ where: { targetId: id } }),
            ]).then(
              ([
                messages,
                moments,
                conversations,
                miniApps,
                media,
                reports,
              ]) => ({
                messages,
                moments,
                conversations,
                miniApps,
                media,
                reports,
              }),
            ),
            db.wallet.findUnique({
              where: { userId: id },
              select: { balance: true, bonusGranted: true },
            }),
          ]);
          result = { user, sessions, counts, wallet };
        }
        if (method === "GET" && path[1] === "reports") {
          requireCondition(canManage(auth, "reports"), 403, "FORBIDDEN");
          const rows = await db.report.findMany({
            take: 100,
            orderBy: { createdAt: "desc" },
          });
          // The app reports a conversation id. Resolve it so a moderator can
          // identify the exact chat without exposing message bodies.
          const targets = [...new Set(rows.map((row) => row.targetId))].filter(
            isUuid,
          );
          const people = [
            ...new Set([...rows.map((row) => row.reporterId), ...targets]),
          ].filter(isUuid);
          const [conversations, users] = await Promise.all([
            targets.length
              ? db.conversation.findMany({
                  where: { id: { in: targets } },
                  select: {
                    id: true,
                    kind: true,
                    title: true,
                    createdAt: true,
                    members: {
                      take: 12,
                      select: {
                        role: true,
                        user: {
                          select: { id: true, qchatId: true, nickname: true },
                        },
                      },
                    },
                    _count: { select: { members: true } },
                  },
                })
              : [],
            people.length
              ? db.user.findMany({
                  where: { id: { in: people } },
                  select: {
                    id: true,
                    qchatId: true,
                    nickname: true,
                    email: true,
                    disabled: true,
                  },
                })
              : [],
          ]);
          const conversationById = new Map(
            conversations.map((row) => [row.id, row]),
          );
          const userById = new Map(users.map((row) => [row.id, row]));
          result = rows.map((row) => ({
            ...row,
            conversation: conversationById.get(row.targetId) ?? null,
            targetUser: userById.get(row.targetId) ?? null,
            reporter: userById.get(row.reporterId) ?? null,
          }));
        }
        if (method === "GET" && path[1] === "feedback") {
          requireCondition(canManage(auth, "feedback"), 403, "FORBIDDEN");
          result = await db.feedback.findMany({
            take: 100,
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  qchatId: true,
                  nickname: true,
                  email: true,
                },
              },
            },
          });
        }
        if (method === "PATCH" && path[1] === "feedback") {
          requireCondition(canManage(auth, "feedback"), 403, "FORBIDDEN");
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
        if (method === "GET" && path[1] === "audit") {
          requireCondition(canManage(auth, "audit"), 403, "FORBIDDEN");
          result = await db.auditLog.findMany({
            take: 100,
            orderBy: { createdAt: "desc" },
          });
        }
        if (method === "PATCH" && path[1] === "users") {
          requireCondition(canManage(auth, "users"), 403, "FORBIDDEN");
          const v = z
            .object({
              disabled: z.boolean().optional(),
              role: z.enum(["USER", "ADMIN"]).optional(),
              adminPermissions: z
                .array(z.enum(ADMIN_SECTIONS))
                .max(ADMIN_SECTIONS.length)
                .optional(),
            })
            .strict()
            .parse(body);
          requireCondition(
            v.disabled !== undefined ||
              v.role !== undefined ||
              v.adminPermissions !== undefined,
            400,
            "NOTHING_TO_UPDATE",
          );
          const targetId = uuid.parse(path[2]);
          const target = await db.user.findUnique({
            where: { id: targetId },
            select: { id: true, role: true },
          });
          requireCondition(target, 404, "NOT_FOUND");
          // Roles and management sections are privileges: only a full
          // administrator grants them, and never to their own account.
          if (v.role !== undefined || v.adminPermissions !== undefined) {
            requireCondition(auth.role === "ADMIN", 403, "ADMIN_REQUIRED");
            requireCondition(targetId !== userId, 400, "SELF_ROLE");
          }
          if (v.disabled !== undefined)
            requireCondition(
              targetId !== userId || v.disabled === false,
              400,
              "SELF_LOCK",
            );
          if (target.role === "ADMIN" && v.role === "USER")
            requireCondition(
              (await db.user.count({ where: { role: "ADMIN" } })) > 1,
              409,
              "LAST_ADMIN",
            );
          const permissions =
            v.adminPermissions === undefined
              ? undefined
              : normalizePermissions(v.adminPermissions);
          const actions: string[] = [];
          if (v.disabled !== undefined)
            actions.push(v.disabled ? "USER_LOCK" : "USER_UNLOCK");
          if (v.role !== undefined) actions.push("USER_ROLE_UPDATE");
          if (permissions !== undefined)
            actions.push("USER_PERMISSIONS_UPDATE");
          await db.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: targetId },
              data: {
                ...(v.disabled === undefined ? {} : { disabled: v.disabled }),
                ...(v.role === undefined ? {} : { role: v.role }),
                ...(permissions === undefined
                  ? {}
                  : { adminPermissions: permissions }),
              },
            });
            if (v.disabled === true)
              await tx.userSession.updateMany({
                where: { userId: targetId, revokedAt: null },
                data: { revokedAt: new Date() },
              });
            for (const action of actions)
              await tx.auditLog.create({
                data: { actorId: userId, action, targetId },
              });
          });
          result = { ok: true };
        }
        if (
          method === "POST" &&
          path[1] === "users" &&
          path[3] === "sessions"
        ) {
          requireCondition(canManage(auth, "users"), 403, "FORBIDDEN");
          const targetId = uuid.parse(path[2]);
          const revoked = await db.userSession.updateMany({
            where: { userId: targetId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await db.auditLog.create({
            data: {
              actorId: userId,
              action: "USER_SESSIONS_REVOKED",
              targetId,
            },
          });
          result = { ok: true, revoked: revoked.count };
        }
        if (method === "DELETE" && path[1] === "users") {
          // Permanent removal is full-admin only. Media rows, messages and
          // objects are cleared first because their foreign keys would
          // otherwise block the account row from being deleted.
          requireCondition(auth.role === "ADMIN", 403, "ADMIN_REQUIRED");
          const targetId = uuid.parse(path[2]);
          requireCondition(targetId !== userId, 400, "SELF_DELETE");
          const target = await db.user.findUnique({
            where: { id: targetId },
            select: { role: true, qchatId: true },
          });
          requireCondition(target, 404, "NOT_FOUND");
          if (target.role === "ADMIN")
            requireCondition(
              (await db.user.count({ where: { role: "ADMIN" } })) > 1,
              409,
              "LAST_ADMIN",
            );
          const [media, versions] = await Promise.all([
            db.media.findMany({
              where: { ownerId: targetId },
              select: { id: true, key: true },
            }),
            db.miniAppVersion.findMany({
              where: { miniApp: { developerId: targetId } },
              select: { storageKey: true },
            }),
          ]);
          const mediaIds = media.map((file) => file.id);
          await db.$transaction(async (tx) => {
            await tx.message.deleteMany({ where: { senderId: targetId } });
            await tx.moment.deleteMany({ where: { authorId: targetId } });
            if (mediaIds.length) {
              await tx.momentMedia.deleteMany({
                where: { mediaId: { in: mediaIds } },
              });
              await tx.message.updateMany({
                where: { mediaId: { in: mediaIds } },
                data: { mediaId: null },
              });
              await tx.conversation.updateMany({
                where: { wallpaperMediaId: { in: mediaIds } },
                data: { wallpaperMediaId: null },
              });
              await tx.user.updateMany({
                where: { avatarId: { in: mediaIds } },
                data: { avatarId: null },
              });
              await tx.media.deleteMany({ where: { id: { in: mediaIds } } });
            }
            // Rows without a foreign key would otherwise point at a user that
            // no longer exists.
            await tx.messageUserState.deleteMany({
              where: { userId: targetId },
            });
            await tx.momentLike.deleteMany({ where: { userId: targetId } });
            await tx.moneyTransferClaim.deleteMany({
              where: { userId: targetId },
            });
            await tx.report.deleteMany({
              where: { OR: [{ targetId }, { reporterId: targetId }] },
            });
            await tx.user.delete({ where: { id: targetId } });
            await tx.auditLog.create({
              data: {
                actorId: userId,
                action: "USER_DELETE",
                targetId: target.qchatId,
              },
            });
          });
          await deleteMediaObjects(media.map((file) => file.key));
          await Promise.allSettled(
            versions.map((version) => deleteBuild(version.storageKey)),
          );
          result = { ok: true, deleted: target.qchatId };
        }
        if (
          method === "GET" &&
          path[1] === "payments" &&
          path[2] === "transactions"
        ) {
          requireCondition(canManage(auth, "payments"), 403, "FORBIDDEN");
          const page = z.coerce
            .number()
            .int()
            .min(1)
            .max(100000)
            .parse(url.searchParams.get("page") ?? 1);
          const query = z
            .string()
            .max(80)
            .parse(url.searchParams.get("q") ?? "")
            .trim();
          const kind = z
            .string()
            .max(20)
            .parse(url.searchParams.get("kind") ?? "")
            .trim();
          const where: Prisma.WalletTransactionWhereInput = {
            ...(/^[A-Z_]{3,20}$/.test(kind) ? { kind } : {}),
            ...(query
              ? {
                  wallet: {
                    user: {
                      OR: [
                        {
                          qchatId: {
                            contains: query,
                            mode: "insensitive" as const,
                          },
                        },
                        {
                          nickname: {
                            contains: query,
                            mode: "insensitive" as const,
                          },
                        },
                        {
                          email: {
                            contains: query,
                            mode: "insensitive" as const,
                          },
                        },
                      ],
                    },
                  },
                }
              : {}),
          };
          const [items, total] = await Promise.all([
            db.walletTransaction.findMany({
              where,
              skip: (page - 1) * 20,
              take: 20,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                amount: true,
                kind: true,
                note: true,
                peerName: true,
                createdAt: true,
                wallet: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        qchatId: true,
                        nickname: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            }),
            db.walletTransaction.count({ where }),
          ]);
          result = { items, total, page, pageSize: 20 };
        }
        if (
          method === "GET" &&
          path[1] === "payments" &&
          path[2] === "wallets"
        ) {
          requireCondition(canManage(auth, "payments"), 403, "FORBIDDEN");
          const page = z.coerce
            .number()
            .int()
            .min(1)
            .max(100000)
            .parse(url.searchParams.get("page") ?? 1);
          const query = z
            .string()
            .max(80)
            .parse(url.searchParams.get("q") ?? "")
            .trim();
          const where: Prisma.WalletWhereInput = query
            ? {
                user: {
                  OR: [
                    {
                      qchatId: {
                        contains: query,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      nickname: {
                        contains: query,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      email: { contains: query, mode: "insensitive" as const },
                    },
                  ],
                },
              }
            : {};
          const [items, total] = await Promise.all([
            db.wallet.findMany({
              where,
              skip: (page - 1) * 20,
              take: 20,
              orderBy: [{ balance: "desc" }, { userId: "asc" }],
              select: {
                userId: true,
                balance: true,
                bonusGranted: true,
                updatedAt: true,
                user: {
                  select: {
                    id: true,
                    qchatId: true,
                    nickname: true,
                    email: true,
                    disabled: true,
                  },
                },
              },
            }),
            db.wallet.count({ where }),
          ]);
          result = { items, total, page, pageSize: 20 };
        }
        if (method === "GET" && path[1] === "payments" && !path[2]) {
          requireCondition(canManage(auth, "payments"), 403, "FORBIDDEN");
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const [balances, wallets, transactions, volume, pending, services] =
            await Promise.all([
              db.wallet.aggregate({ _sum: { balance: true } }),
              db.wallet.count(),
              db.walletTransaction.count(),
              db.walletTransaction.aggregate({
                where: { amount: { gt: 0 }, createdAt: { gte: today } },
                _sum: { amount: true },
              }),
              db.moneyTransfer.aggregate({
                where: { status: "PENDING" },
                _count: { _all: true },
                _sum: { amount: true },
              }),
              readPaymentServices(),
            ]);
          result = {
            summary: {
              totalBalance: balances._sum.balance ?? 0,
              wallets,
              transactions,
              volumeToday: volume._sum.amount ?? 0,
              pendingTransfers: pending._count._all,
              pendingAmount: pending._sum.amount ?? 0,
              services: services.length,
              activeServices: services.filter((service) => service.enabled)
                .length,
            },
          };
        }
        if (
          method === "POST" &&
          path[1] === "payments" &&
          path[2] === "wallets" &&
          path[4] === "adjust"
        ) {
          requireCondition(canManage(auth, "payments"), 403, "FORBIDDEN");
          const targetId = uuid.parse(path[3]);
          const v = z
            .object({
              amount: z
                .number()
                .int()
                .min(-maxWalletAdjustment)
                .max(maxWalletAdjustment)
                .refine((value) => value !== 0),
              note: z.string().trim().min(3).max(200),
            })
            .strict()
            .parse(body);
          const target = await db.user.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
          requireCondition(target, 404, "NOT_FOUND");
          const wallet = await db.$transaction(async (tx) => {
            await tx.wallet.upsert({
              where: { userId: targetId },
              create: { userId: targetId },
              update: {},
            });
            if (v.amount < 0) {
              const debit = await tx.wallet.updateMany({
                where: { userId: targetId, balance: { gte: -v.amount } },
                data: { balance: { decrement: -v.amount } },
              });
              requireCondition(debit.count === 1, 400, "INSUFFICIENT_FUNDS");
            } else {
              await tx.wallet.update({
                where: { userId: targetId },
                data: { balance: { increment: v.amount } },
              });
            }
            await tx.walletTransaction.create({
              data: {
                walletId: targetId,
                amount: v.amount,
                kind: v.amount > 0 ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
                note: v.note,
              },
            });
            await tx.auditLog.create({
              data: {
                actorId: userId,
                action: "PAYMENT_WALLET_ADJUST",
                targetId,
              },
            });
            return tx.wallet.findUniqueOrThrow({ where: { userId: targetId } });
          });
          result = { balance: wallet.balance };
        }
        if (method === "GET" && path[1] === "services") {
          requireCondition(canManage(auth, "payments"), 403, "FORBIDDEN");
          result = await readPaymentServices();
        }
        if (method === "PATCH" && path[1] === "services" && path[2]) {
          requireCondition(canManage(auth, "payments"), 403, "FORBIDDEN");
          const key = path[2];
          requireCondition(isPaymentServiceKey(key), 400, "UNKNOWN_SERVICE");
          const v = z
            .object({
              label: z.string().trim().min(1).max(40),
              group: z.enum(paymentServiceGroups),
              note: z.string().trim().max(300),
              enabled: z.boolean(),
              sortOrder: z.number().int().min(0).max(10000),
            })
            .strict()
            .parse(body);
          await db.$transaction([
            db.paymentService.upsert({
              where: { key },
              create: { key, ...v },
              update: v,
            }),
            db.auditLog.create({
              data: {
                actorId: userId,
                action: "PAYMENT_SERVICE_UPDATE",
                targetId: key,
              },
            }),
          ]);
          result = { ok: true };
        }
        if (method === "PATCH" && path[1] === "reports") {
          requireCondition(canManage(auth, "reports"), 403, "FORBIDDEN");
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
        if (
          method === "GET" &&
          path[1] === "miniapps" &&
          path[2] === "review"
        ) {
          requireCondition(canManage(auth, "miniapps"), 403, "FORBIDDEN");
          result = await miniAppReviewRoute(
            userId,
            "GET",
            ["miniapps", "review", "queue"],
            {},
            url,
          );
        }
        if (method === "GET" && path[1] === "miniapps" && !path[2]) {
          requireCondition(canManage(auth, "miniapps"), 403, "FORBIDDEN");
          const page = z.coerce
            .number()
            .int()
            .min(1)
            .max(100000)
            .parse(url.searchParams.get("page") ?? 1);
          const status = url.searchParams.get("status") ?? "";
          const query = z
            .string()
            .max(80)
            .parse(url.searchParams.get("q") ?? "")
            .trim();
          const where = {
            ...(/^[A-Z_]{3,20}$/.test(status) ? { status } : {}),
            ...(query
              ? {
                  OR: [
                    { name: { contains: query, mode: "insensitive" as const } },
                    {
                      appId: { contains: query, mode: "insensitive" as const },
                    },
                    {
                      developerName: {
                        contains: query,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                }
              : {}),
          };
          const [items, total] = await Promise.all([
            db.miniApp.findMany({
              where,
              skip: (page - 1) * 20,
              take: 20,
              orderBy: { updatedAt: "desc" },
              select: {
                id: true,
                appId: true,
                name: true,
                category: true,
                status: true,
                currentVersion: true,
                updatedAt: true,
                developer: { select: { qchatId: true, nickname: true } },
                versions: {
                  take: 1,
                  orderBy: { createdAt: "desc" },
                  select: { version: true, status: true, createdAt: true },
                },
              },
            }),
            db.miniApp.count({ where }),
          ]);
          result = { items, total, page, pageSize: 20 };
        }
        if (
          method === "POST" &&
          path[1] === "miniapps" &&
          path[2] === "versions" &&
          path[4] === "decision"
        ) {
          requireCondition(canManage(auth, "miniapps"), 403, "FORBIDDEN");
          result = await miniAppReviewRoute(
            userId,
            "POST",
            ["miniapps", "review", "versions", uuid.parse(path[3]), "decision"],
            body,
            url,
          );
        }
        if (method === "POST" && path[1] === "miniapps" && path[2] === "apps") {
          requireCondition(canManage(auth, "miniapps"), 403, "FORBIDDEN");
          const action = path[4];
          requireCondition(
            action === "suspend" || action === "restore",
            404,
            "NOT_FOUND",
          );
          result = await miniAppReviewRoute(
            userId,
            "POST",
            ["miniapps", "review", "apps", path[3], action],
            body,
            url,
          );
        }
        if (
          method === "POST" &&
          path[1] === "miniapps" &&
          path[2] === "permissions"
        ) {
          requireCondition(canManage(auth, "miniapps"), 403, "FORBIDDEN");
          result = await miniAppReviewRoute(
            userId,
            "POST",
            ["miniapps", "review", "permissions", uuid.parse(path[3])],
            body,
            url,
          );
        }
        if (method === "GET" && path[1] === "links") {
          requireCondition(canManage(auth, "landing"), 403, "FORBIDDEN");
          result = await readSiteLinks();
        }
        if (method === "PATCH" && path[1] === "links") {
          requireCondition(canManage(auth, "landing"), 403, "FORBIDDEN");
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
