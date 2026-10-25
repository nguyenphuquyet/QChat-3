import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../services/db";
import { ApiError, requireCondition } from "../security/errors";
import { rateLimit } from "../security/rate-limit";
import {
  appIdSchema,
  miniappCategories,
  miniappPermissionIds,
  miniappPermissions,
  httpsUrlSchema,
  runtimeVersion,
  semverSchema,
} from "../../../../packages/contracts/miniapps";
import {
  buildLocation,
  deleteBuild,
  putBuild,
  readBuild,
  storageMode,
} from "../services/miniapp-storage";
import { createPreviewToken, readPreviewFile } from "../services/miniapp-preview";
import { readSiteLinks } from "../services/site-links";
import { inspectBuild, PackageError } from "../services/miniapp-package";
import { publicUser } from "../services/messages";

const categorySchema = z.enum(miniappCategories);
const permissionSchema = z.enum(miniappPermissionIds as [string, ...string[]]);
const telemetryEvents = [
  "open",
  "launch_success",
  "launch_failure",
  "download_failure",
  "update_failure",
  "runtime_error",
] as const;

const appSelect = {
  appId: true,
  name: true,
  description: true,
  iconUrl: true,
  category: true,
  developerName: true,
  status: true,
  currentVersion: true,
  requestedPermissions: true,
  createdAt: true,
  updatedAt: true,
} as const;

const pageSize = 20;

function page(url: URL) {
  return z.coerce.number().int().min(1).max(10_000).parse(url.searchParams.get("page") ?? 1);
}

function newAppId() {
  return `mp_${randomBytes(8).toString("hex")}`;
}

function myAppsWhere(userId: string) {
  return {
    OR: [
      { developerId: userId },
      { members: { some: { userId } } },
    ],
  };
}

async function audit(actorId: string, action: string, targetId: string, note = "") {
  await db.auditLog.create({
    data: { actorId, action, targetId: note ? `${targetId}:${note}`.slice(0, 190) : targetId },
  });
}

async function developerApp(appId: string, userId: string, write = true) {
  const app = await db.miniApp.findUnique({
    where: { appId },
    include: { members: true },
  });
  requireCondition(app, 404, "NOT_FOUND");
  const memberRole =
    app.developerId === userId
      ? "OWNER"
      : (app.members.find((member) => member.userId === userId)?.role ?? null);
  requireCondition(memberRole, 403, "FORBIDDEN");
  if (write) requireCondition(memberRole !== "VIEWER", 403, "FORBIDDEN");
  return app;
}

function reviewer(role: string) {
  requireCondition(role === "ADMIN", 403, "REVIEWER_REQUIRED");
}

async function publishedApp(appId: string) {
  const app = await db.miniApp.findUnique({ where: { appId } });
  requireCondition(app, 404, "NOT_FOUND");
  requireCondition(app.status !== "SUSPENDED", 410, "APP_SUSPENDED");
  requireCondition(app.status === "PUBLISHED", 404, "NOT_PUBLISHED");
  return app;
}

async function releaseVersion(appId: string, version: string) {
  const app = await publishedApp(appId);
  const build = await db.miniAppVersion.findUnique({
    where: { miniAppId_version: { miniAppId: app.id, version } },
  });
  requireCondition(build, 404, "NOT_FOUND");
  requireCondition(build.status !== "REVOKED", 410, "VERSION_REVOKED");
  requireCondition(build.status === "PUBLISHED", 404, "NOT_PUBLISHED");
  return { app, build };
}

export async function miniAppsRoute(
  userId: string,
  role: string,
  method: string,
  path: string[],
  body: unknown,
  url: URL,
) {
  const [, area, id, sub] = path;

  if (area === "store") {
    if (!id && method === "GET") {
      const query = z.string().max(80).trim().parse(url.searchParams.get("q") ?? "");
      const category = z
        .union([categorySchema, z.literal("")])
        .parse(url.searchParams.get("category") ?? "");
      const sort = z
        .enum(["new", "recommended"])
        .parse(url.searchParams.get("sort") ?? "new");
      const where = {
        status: "PUBLISHED",
        ...(category ? { category } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { description: { contains: query, mode: "insensitive" as const } },
                { developerName: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const current = page(url);
      const [rows, total] = await Promise.all([
        db.miniApp.findMany({
          where,
          orderBy:
            sort === "recommended"
              ? [{ recents: { _count: "desc" } }, { updatedAt: "desc" }]
              : { updatedAt: "desc" },
          skip: (current - 1) * pageSize,
          take: pageSize,
          select: { ...appSelect, id: true, _count: { select: { recents: true } } },
        }),
        db.miniApp.count({ where }),
      ]);
      const favorites = await db.userFavoriteMiniApp.findMany({
        where: { userId, miniAppId: { in: rows.map((row) => row.id) } },
        select: { miniAppId: true },
      });
      const favoriteIds = new Set(favorites.map((item) => item.miniAppId));
      const items = rows.map(({ id: internalId, _count, ...row }) => ({
        ...row,
        openCount: _count.recents,
        favorite: favoriteIds.has(internalId),
      }));
      return { items, total, page: current, pageSize };
    }
    if (id && !sub && method === "GET") {
      const app = await publishedApp(appIdSchema.parse(id));
      const [favorite, recent, build] = await Promise.all([
        db.userFavoriteMiniApp.findUnique({
          where: { userId_miniAppId: { userId, miniAppId: app.id } },
        }),
        db.userRecentMiniApp.findUnique({
          where: { userId_miniAppId: { userId, miniAppId: app.id } },
        }),
        app.currentVersion
          ? db.miniAppVersion.findUnique({
              where: {
                miniAppId_version: {
                  miniAppId: app.id,
                  version: app.currentVersion,
                },
              },
            })
          : null,
      ]);
      return {
        appId: app.appId,
        name: app.name,
        description: app.description,
        iconUrl: app.iconUrl,
        category: app.category,
        developerName: app.developerName,
        supportUrl: app.supportUrl,
        privacyUrl: app.privacyUrl,
        status: app.status,
        currentVersion: app.currentVersion,
        requestedPermissions: app.requestedPermissions,
        updatedAt: app.updatedAt,
        favorite: Boolean(favorite),
        openedAt: recent?.openedAt ?? null,
        minRuntimeVersion: build?.minRuntimeVersion ?? "1.0.0",
        size: build?.size ?? 0,
        runtimeVersion,
      };
    }
    if (id && sub === "manifest" && method === "GET") {
      const app = await publishedApp(appIdSchema.parse(id));
      const build = await currentBuild(app.id, app.currentVersion);
      return {
        appId: app.appId,
        version: build.version,
        manifest: build.manifest,
        sha256: build.sha256,
        entry: build.entry,
      };
    }
    if (id && sub === "build" && method === "GET") {
      const requested = z
        .union([semverSchema, z.literal("")])
        .parse(url.searchParams.get("version") ?? "");
      const app = await publishedApp(appIdSchema.parse(id));
      const version = requested || app.currentVersion;
      requireCondition(version, 404, "NOT_PUBLISHED");
      const { build } = await releaseVersion(app.appId, version);
      const location = await buildLocation(
        build.storageKey,
        process.env.WEB_ORIGIN ?? new URL(url).origin,
      );
      return {
        appId: app.appId,
        version: build.version,
        entry: build.entry,
        sha256: build.sha256,
        size: build.size,
        minRuntimeVersion: build.minRuntimeVersion,
        requestedPermissions: build.requestedPermissions,
        manifest: build.manifest,
        url: location.url,
        expiresAt: location.expiresAt,
      };
    }
    return undefined;
  }

  if (area === "recent") {
    if (method === "GET") {
      const rows = await db.userRecentMiniApp.findMany({
        where: { userId, miniApp: { status: "PUBLISHED" } },
        orderBy: { openedAt: "desc" },
        take: 12,
        include: { miniApp: { select: appSelect } },
      });
      return rows.map((row) => ({ ...row.miniApp, openedAt: row.openedAt }));
    }
    if (method === "POST") {
      const { appId } = z.object({ appId: appIdSchema }).strict().parse(body);
      const app = await publishedApp(appId);
      await db.userRecentMiniApp.upsert({
        where: { userId_miniAppId: { userId, miniAppId: app.id } },
        create: { userId, miniAppId: app.id },
        update: { openedAt: new Date(), openCount: { increment: 1 } },
      });
      return { ok: true };
    }
    return undefined;
  }

  if (area === "favorites") {
    if (!id && method === "GET") {
      const rows = await db.userFavoriteMiniApp.findMany({
        where: { userId, miniApp: { status: "PUBLISHED" } },
        orderBy: { createdAt: "desc" },
        include: { miniApp: { select: appSelect } },
      });
      return rows.map((row) => ({ ...row.miniApp, favorite: true }));
    }
    if (!id && method === "POST") {
      const { appId } = z.object({ appId: appIdSchema }).strict().parse(body);
      const app = await publishedApp(appId);
      await db.userFavoriteMiniApp.upsert({
        where: { userId_miniAppId: { userId, miniAppId: app.id } },
        create: { userId, miniAppId: app.id },
        update: {},
      });
      return { ok: true };
    }
    if (id && method === "DELETE") {
      const app = await db.miniApp.findUnique({
        where: { appId: appIdSchema.parse(id) },
        select: { id: true },
      });
      if (app)
        await db.userFavoriteMiniApp.deleteMany({
          where: { userId, miniAppId: app.id },
        });
      return { ok: true };
    }
    return undefined;
  }

  if (area === "telemetry" && method === "POST") {
    const v = z
      .object({
        appId: appIdSchema,
        version: z.string().max(32).default(""),
        event: z.enum(telemetryEvents),
        errorCode: z.string().max(80).default(""),
        durationMs: z.number().int().min(0).max(600_000).default(0),
      })
      .strict()
      .parse(body);
    await rateLimit(`miniapp-telemetry:${userId}`, 120);
    const app = await db.miniApp.findUnique({
      where: { appId: v.appId },
      select: { id: true },
    });
    requireCondition(app, 404, "NOT_FOUND");
    await db.miniAppAnalyticsEvent.create({
      data: {
        miniAppId: app.id,
        version: v.version,
        event: v.event,
        errorCode: v.errorCode,
        durationMs: v.durationMs,
        userId,
      },
    });
    return { ok: true };
  }

  if (area === "developer") return developerRoute(userId, role, method, path, body, url);
  if (area === "review") return reviewRoute(userId, role, method, path, body, url);
  return undefined;
}

async function currentBuild(miniAppId: string, version: string | null) {
  requireCondition(version, 404, "NOT_PUBLISHED");
  const build = await db.miniAppVersion.findUnique({
    where: { miniAppId_version: { miniAppId, version } },
  });
  requireCondition(build && build.status === "PUBLISHED", 404, "NOT_PUBLISHED");
  return build;
}

async function developerRoute(
  userId: string,
  role: string,
  method: string,
  path: string[],
  body: unknown,
  url: URL,
) {
  const [, , section, appId, sub, sub2, sub3] = path;

  if (section === "dashboard" && method === "GET") {
    const apps = await db.miniApp.findMany({
      where: myAppsWhere(userId),
      select: { id: true, appId: true, name: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    const ids = apps.map((app) => app.id);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [pendingBuilds, rejected, opens, recent] = await Promise.all([
      db.miniAppVersion.count({
        where: { miniAppId: { in: ids }, status: "REVIEWING" },
      }),
      db.miniAppVersion.count({
        where: { miniAppId: { in: ids }, status: "REJECTED" },
      }),
      db.miniAppAnalyticsEvent.count({
        where: { miniAppId: { in: ids }, event: "open", createdAt: { gte: since } },
      }),
      db.miniAppRelease.findMany({
        where: { miniAppId: { in: ids } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { miniApp: { select: { name: true, appId: true } } },
      }),
    ]);
    return {
      apps: apps.length,
      published: apps.filter((app) => app.status === "PUBLISHED").length,
      pendingBuilds,
      rejected,
      opens,
      recent: recent.map((item) => ({
        id: item.id,
        appId: item.miniApp.appId,
        name: item.miniApp.name,
        action: item.action,
        version: item.versionLabel,
        note: item.note,
        createdAt: item.createdAt,
      })),
      storage: storageMode(),
    };
  }

  if (section === "audit" && method === "GET") {
    const apps = await db.miniApp.findMany({
      where: myAppsWhere(userId),
      select: { appId: true },
    });
    return db.auditLog.findMany({
      where: {
        action: { startsWith: "MINIAPP_" },
        targetId: { in: apps.map((app) => app.appId) },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  if (section === "ide" && method === "GET") {
    const links = await readSiteLinks();
    const ide = links.find((link) => link.platform === "ide");
    return {
      label: ide?.label ?? "QChat Mini App IDE",
      url: ide?.url ?? "",
      note: ide?.note ?? "",
      enabled: ide?.enabled ?? false,
    };
  }

  if (section !== "apps") return undefined;

  if (!appId) {
    if (method === "GET") {
      const query = z.string().max(80).trim().parse(url.searchParams.get("q") ?? "");
      const status = z
        .string()
        .max(20)
        .parse(url.searchParams.get("status") ?? "");
      const where = {
        ...myAppsWhere(userId),
        ...(status ? { status } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { appId: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const current = page(url);
      const [items, total] = await Promise.all([
        db.miniApp.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (current - 1) * pageSize,
          take: pageSize,
          select: {
            ...appSelect,
            versions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { version: true, status: true, createdAt: true },
            },
          },
        }),
        db.miniApp.count({ where }),
      ]);
      return { items, total, page: current, pageSize };
    }
    if (method === "POST") {
      const v = z
        .object({
          name: z.string().trim().min(2).max(60),
          description: z.string().trim().max(1000).default(""),
          iconUrl: httpsUrlSchema.default(""),
          category: categorySchema,
          developerName: z.string().trim().min(2).max(80),
          supportUrl: httpsUrlSchema.default(""),
          privacyUrl: httpsUrlSchema.default(""),
          contactEmail: z.string().trim().email().max(254),
        })
        .strict()
        .parse(body);
      const owned = await db.miniApp.count({ where: { developerId: userId } });
      requireCondition(owned < 50, 429, "APP_QUOTA");
      const app = await db.miniApp.create({
        data: { ...v, appId: newAppId(), developerId: userId, status: "DRAFT" },
        select: { ...appSelect, id: true },
      });
      await audit(userId, "MINIAPP_CREATED", app.appId);
      const { id: internalId, ...created } = app;
      return { ...created, id: internalId };
    }
    return undefined;
  }

  const parsedAppId = appIdSchema.parse(appId);

  if (!sub && method === "GET") {
    const app = await developerApp(parsedAppId, userId, false);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [versions, releases, permissions, members, keys, events, opens] =
      await Promise.all([
        db.miniAppVersion.findMany({
          where: { miniAppId: app.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            reviews: { orderBy: { createdAt: "desc" }, take: 3 },
          },
        }),
        db.miniAppRelease.findMany({
          where: { miniAppId: app.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        db.miniAppPermissionRequest.findMany({
          where: { miniAppId: app.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        db.miniAppMember.findMany({
          where: { miniAppId: app.id },
          include: { user: { select: publicUser } },
        }),
        db.miniAppApiKey.findMany({
          where: { miniAppId: app.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            prefix: true,
            createdAt: true,
            lastUsedAt: true,
            revokedAt: true,
          },
        }),
        db.miniAppAnalyticsEvent.groupBy({
          by: ["event"],
          where: { miniAppId: app.id, createdAt: { gte: since } },
          _count: { _all: true },
        }),
        db.miniAppAnalyticsEvent.count({
          where: { miniAppId: app.id, event: "open", createdAt: { gte: since } },
        }),
      ]);
    return {
      app: {
        appId: app.appId,
        name: app.name,
        description: app.description,
        iconUrl: app.iconUrl,
        category: app.category,
        developerName: app.developerName,
        supportUrl: app.supportUrl,
        privacyUrl: app.privacyUrl,
        contactEmail: app.contactEmail,
        status: app.status,
        currentVersion: app.currentVersion,
        requestedPermissions: app.requestedPermissions,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        role: app.developerId === userId ? "OWNER" : "MEMBER",
      },
      versions,
      releases,
      permissions,
      members,
      keys,
      analytics: {
        opens,
        events: events.map((row) => ({ event: row.event, count: row._count._all })),
      },
      permissionCatalog: miniappPermissions,
      runtimeVersion,
      storage: storageMode(),
    };
  }

  if (!sub && method === "PATCH") {
    const app = await developerApp(parsedAppId, userId);
    const v = z
      .object({
        name: z.string().trim().min(2).max(60).optional(),
        description: z.string().trim().max(1000).optional(),
        iconUrl: httpsUrlSchema.optional(),
        category: categorySchema.optional(),
        developerName: z.string().trim().min(2).max(80).optional(),
        supportUrl: httpsUrlSchema.optional(),
        privacyUrl: httpsUrlSchema.optional(),
        contactEmail: z.string().trim().email().max(254).optional(),
      })
      .strict()
      .parse(body);
    const updated = await db.miniApp.update({
      where: { id: app.id },
      data: v,
      select: appSelect,
    });
    await audit(userId, "MINIAPP_UPDATED", app.appId);
    return updated;
  }

  if (!sub && method === "DELETE") {
    const app = await developerApp(parsedAppId, userId, false);
    requireCondition(app.developerId === userId, 403, "OWNER_REQUIRED");
    const versions = await db.miniAppVersion.findMany({
      where: { miniAppId: app.id },
      select: { storageKey: true },
    });
    await db.miniApp.delete({ where: { id: app.id } });
    await audit(userId, "MINIAPP_DELETED", app.appId);
    await Promise.allSettled(
      versions.map((version) => deleteBuild(version.storageKey)),
    );
    return { ok: true };
  }

  if (sub === "versions" && method === "GET") {
    const app = await developerApp(parsedAppId, userId, false);
    return db.miniAppVersion.findMany({
      where: { miniAppId: app.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { reviews: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
  }

  if (sub === "versions" && sub2 && sub3 === "submit" && method === "POST") {
    const app = await developerApp(parsedAppId, userId);
    const build = await db.miniAppVersion.findFirst({
      where: { id: z.string().uuid().parse(sub2), miniAppId: app.id },
    });
    requireCondition(build, 404, "NOT_FOUND");
    // A revoked build that was never published may go through review again.
    requireCondition(
      ["UPLOADED", "REJECTED"].includes(build.status) ||
        (build.status === "REVOKED" && build.publishedAt === null),
      409,
      "INVALID_STATE",
    );
    const updated = await db.$transaction(async (tx) => {
      const version = await tx.miniAppVersion.update({
        where: { id: build.id },
        data: { status: "REVIEWING", revokedAt: null, revokeReason: "" },
      });
      await tx.miniApp.update({
        where: { id: app.id },
        data: { status: "REVIEWING" },
      });
      return version;
    });
    await audit(userId, "MINIAPP_SUBMITTED", app.appId, build.version);
    return updated;
  }

  if (sub === "versions" && sub2 && sub3 === "release" && method === "POST") {
    const app = await developerApp(parsedAppId, userId);
    const build = await db.miniAppVersion.findFirst({
      where: { id: z.string().uuid().parse(sub2), miniAppId: app.id },
    });
    requireCondition(build, 404, "NOT_FOUND");
    // A revoked build can be released again only when it was published before,
    // so an unreviewed upload cannot bypass the review queue.
    requireCondition(
      build.status === "APPROVED" ||
        (build.status === "REVOKED" && build.publishedAt !== null),
      409,
      "NOT_APPROVED",
    );
    const updated = await db.$transaction(async (tx) => {
      const version = await tx.miniAppVersion.update({
        where: { id: build.id },
        data: {
          status: "PUBLISHED",
          channel: "PRODUCTION",
          publishedAt: new Date(),
          revokedAt: null,
          revokeReason: "",
        },
      });
      await tx.miniApp.update({
        where: { id: app.id },
        data: {
          status: "PUBLISHED",
          currentVersion: build.version,
          requestedPermissions: build.requestedPermissions,
        },
      });
      await tx.miniAppRelease.create({
        data: {
          miniAppId: app.id,
          versionId: build.id,
          versionLabel: build.version,
          action: "PUBLISH",
          actorId: userId,
        },
      });
      return version;
    });
    await audit(userId, "MINIAPP_RELEASED", app.appId, build.version);
    return updated;
  }

  if (sub === "rollback" && method === "POST") {
    const app = await developerApp(parsedAppId, userId);
    const v = z.object({ version: semverSchema }).strict().parse(body);
    const build = await db.miniAppVersion.findUnique({
      where: { miniAppId_version: { miniAppId: app.id, version: v.version } },
    });
    requireCondition(build, 404, "NOT_FOUND");
    requireCondition(
      build.status === "PUBLISHED" && !build.revokedAt,
      409,
      "INVALID_STATE",
    );
    await db.$transaction([
      db.miniApp.update({
        where: { id: app.id },
        data: { status: "PUBLISHED", currentVersion: build.version },
      }),
      db.miniAppRelease.create({
        data: {
          miniAppId: app.id,
          versionId: build.id,
          versionLabel: build.version,
          action: "ROLLBACK",
          actorId: userId,
        },
      }),
    ]);
    await audit(userId, "MINIAPP_ROLLBACK", app.appId, build.version);
    return { ok: true, currentVersion: build.version };
  }

  if (sub === "revoke" && method === "POST") {
    const app = await developerApp(parsedAppId, userId);
    const v = z
      .object({
        version: semverSchema.optional(),
        reason: z.string().trim().min(3).max(300),
      })
      .strict()
      .parse(body);
    const version = v.version ?? app.currentVersion;
    requireCondition(version, 400, "NO_VERSION");
    const build = await db.miniAppVersion.findUnique({
      where: { miniAppId_version: { miniAppId: app.id, version } },
    });
    requireCondition(build, 404, "NOT_FOUND");
    const suspend = app.currentVersion === build.version;
    await db.$transaction(async (tx) => {
      await tx.miniAppVersion.update({
        where: { id: build.id },
        data: { status: "REVOKED", revokedAt: new Date(), revokeReason: v.reason },
      });
      if (suspend)
        await tx.miniApp.update({
          where: { id: app.id },
          data: { status: "SUSPENDED" },
        });
      await tx.miniAppRelease.create({
        data: {
          miniAppId: app.id,
          versionId: build.id,
          versionLabel: build.version,
          action: "REVOKE",
          actorId: userId,
          note: v.reason,
        },
      });
    });
    await audit(userId, "MINIAPP_REVOKED", app.appId, build.version);
    return { ok: true, suspended: suspend };
  }

  if (sub === "analytics" && method === "GET") {
    const app = await developerApp(parsedAppId, userId, false);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [events, versions, errors] = await Promise.all([
      db.miniAppAnalyticsEvent.groupBy({
        by: ["event"],
        where: { miniAppId: app.id, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.miniAppAnalyticsEvent.groupBy({
        by: ["version"],
        where: { miniAppId: app.id, event: "open", createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.miniAppAnalyticsEvent.findMany({
        where: { miniAppId: app.id, event: "runtime_error", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { errorCode: true, version: true, createdAt: true },
      }),
    ]);
    return {
      since,
      events: events.map((row) => ({ event: row.event, count: row._count._all })),
      versions: versions.map((row) => ({
        version: row.version || "unknown",
        count: row._count._all,
      })),
      errors,
    };
  }

  if (sub === "permissions") {
    const app = await developerApp(parsedAppId, userId, method !== "GET");
    if (method === "GET")
      return {
        declared: app.requestedPermissions,
        catalog: miniappPermissions,
        requests: await db.miniAppPermissionRequest.findMany({
          where: { miniAppId: app.id },
          orderBy: { createdAt: "desc" },
        }),
      };
    if (method === "POST") {
      const v = z
        .object({
          permission: permissionSchema,
          reason: z.string().trim().min(10).max(500),
        })
        .strict()
        .parse(body);
      requireCondition(
        !app.requestedPermissions.includes(v.permission),
        409,
        "ALREADY_DECLARED",
      );
      const request = await db.miniAppPermissionRequest.create({
        data: {
          miniAppId: app.id,
          permission: v.permission,
          reason: v.reason,
          requestedBy: userId,
        },
      });
      await audit(userId, "MINIAPP_PERMISSION_REQUESTED", app.appId, v.permission);
      return request;
    }
  }

  if (sub === "members") {
    const app = await developerApp(parsedAppId, userId, method !== "GET");
    if (method === "GET")
      return db.miniAppMember.findMany({
        where: { miniAppId: app.id },
        include: { user: { select: publicUser } },
      });
    if (method === "POST") {
      requireCondition(app.developerId === userId, 403, "OWNER_ONLY");
      const v = z
        .object({
          identifier: z.string().trim().min(3).max(254),
          role: z.enum(["DEVELOPER", "VIEWER"]).default("DEVELOPER"),
        })
        .strict()
        .parse(body);
      const target = await db.user.findFirst({
        where: {
          OR: [
            { qchatId: v.identifier },
            { email: v.identifier.toLowerCase() },
          ],
        },
        select: { id: true, disabled: true },
      });
      requireCondition(target && !target.disabled, 404, "USER_NOT_FOUND");
      requireCondition(target.id !== userId, 409, "ALREADY_OWNER");
      const member = await db.miniAppMember.upsert({
        where: { miniAppId_userId: { miniAppId: app.id, userId: target.id } },
        create: { miniAppId: app.id, userId: target.id, role: v.role },
        update: { role: v.role },
        include: { user: { select: publicUser } },
      });
      await audit(userId, "MINIAPP_MEMBER_ADDED", app.appId, v.identifier);
      return member;
    }
    if (method === "DELETE" && sub2) {
      requireCondition(app.developerId === userId, 403, "OWNER_ONLY");
      await db.miniAppMember.deleteMany({
        where: { miniAppId: app.id, userId: z.string().uuid().parse(sub2) },
      });
      await audit(userId, "MINIAPP_MEMBER_REMOVED", app.appId, sub2);
      return { ok: true };
    }
  }

  if (sub === "keys") {
    const app = await developerApp(parsedAppId, userId, method !== "GET");
    if (method === "GET")
      return db.miniAppApiKey.findMany({
        where: { miniAppId: app.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          prefix: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
      });
    if (method === "POST") {
      requireCondition(app.developerId === userId, 403, "OWNER_ONLY");
      const v = z
        .object({ name: z.string().trim().min(2).max(60) })
        .strict()
        .parse(body);
      const secret = `qk_${randomBytes(24).toString("hex")}`;
      const prefix = secret.slice(0, 12);
      const key = await db.miniAppApiKey.create({
        data: {
          miniAppId: app.id,
          name: v.name,
          prefix,
          secretHash: createHash("sha256").update(secret).digest("hex"),
          createdBy: userId,
        },
        select: { id: true, name: true, prefix: true, createdAt: true },
      });
      await audit(userId, "MINIAPP_KEY_CREATED", app.appId, prefix);
      return { ...key, secret };
    }
    if (method === "DELETE" && sub2) {
      requireCondition(app.developerId === userId, 403, "OWNER_ONLY");
      await db.miniAppApiKey.updateMany({
        where: { id: z.string().uuid().parse(sub2), miniAppId: app.id },
        data: { revokedAt: new Date() },
      });
      await audit(userId, "MINIAPP_KEY_REVOKED", app.appId, sub2);
      return { ok: true };
    }
  }

  return undefined;
}

/// Issues a short-lived, build-scoped token for the sandboxed preview frame.
/// The frame has an opaque origin, so its module and stylesheet requests do
/// not send the reviewer's session cookie; the token in the URL path does.
export async function miniAppPreviewToken(role: string, versionId: string) {
  reviewer(role);
  const id = z.string().uuid().parse(versionId);
  const build = await db.miniAppVersion.findUnique({
    where: { id },
    select: { status: true },
  });
  requireCondition(build, 404, "NOT_FOUND");
  requireCondition(build.status === "REVIEWING", 409, "INVALID_STATE");
  return createPreviewToken(id);
}

/// Reviewer preview. The caller has already proven access with the reviewer's
/// session or a valid preview token; the ZIP is read from private storage and
/// one file at a time is returned, never an extraction directory.
export async function miniAppPreview(versionId: string, requested: string) {
  const build = await db.miniAppVersion.findUnique({
    where: { id: z.string().uuid().parse(versionId) },
    include: { miniApp: { select: { appId: true, name: true } } },
  });
  requireCondition(build, 404, "NOT_FOUND");
  requireCondition(build.status === "REVIEWING", 409, "INVALID_STATE");
  const parts = requested.split("/").filter(Boolean);
  requireCondition(
    !parts.some((part) => part === "." || part === "..") &&
      !requested.includes("\\"),
    400,
    "ZIP_INVALID_NAME",
  );
  const archive = await readBuild(build.storageKey);
  const file = readPreviewFile(
    archive,
    {
      appId: build.miniApp.appId,
      name: build.miniApp.name,
      version: build.version,
      entry: build.entry,
      runtimeVersion,
      minRuntimeVersion: build.minRuntimeVersion,
      permissions: build.requestedPermissions,
    },
    parts.join("/"),
  );
  requireCondition(file, 404, "NOT_FOUND");
  return { ...file, appId: build.miniApp.appId, version: build.version };
}

/// Entry point for the admin console. The caller authorizes the `miniapps`
/// section first; this reuses the same queue and decision rules as the
/// developer review endpoint, which itself stays limited to the ADMIN role.
export async function miniAppReviewRoute(
  userId: string,
  method: string,
  path: string[],
  body: unknown,
  url: URL,
) {
  return reviewRoute(userId, "ADMIN", method, path, body, url);
}

async function reviewRoute(
  userId: string,
  role: string,
  method: string,
  path: string[],
  body: unknown,
  url: URL,
) {
  const [, , section, id, sub] = path;
  reviewer(role);

  if (section === "queue" && method === "GET") {
    const [versions, permissions] = await Promise.all([
      db.miniAppVersion.findMany({
        where: { status: "REVIEWING" },
        orderBy: { createdAt: "asc" },
        take: 50,
        include: {
          miniApp: {
            select: {
              appId: true,
              name: true,
              developerName: true,
              iconUrl: true,
              category: true,
              status: true,
            },
          },
        },
      }),
      db.miniAppPermissionRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 50,
        include: { miniApp: { select: { appId: true, name: true } } },
      }),
    ]);
    return { versions, permissions };
  }

  if (section === "versions" && id && sub === "decision" && method === "POST") {
    const v = z
      .object({
        approve: z.boolean(),
        reason: z.string().trim().max(500).default(""),
      })
      .strict()
      .parse(body);
    const build = await db.miniAppVersion.findUnique({
      where: { id: z.string().uuid().parse(id) },
      include: { miniApp: true },
    });
    requireCondition(build, 404, "NOT_FOUND");
    requireCondition(build.status === "REVIEWING", 409, "INVALID_STATE");
    if (!v.approve) requireCondition(v.reason.length >= 3, 400, "REASON_REQUIRED");
    await db.$transaction(async (tx) => {
      await tx.miniAppReview.create({
        data: {
          versionId: build.id,
          reviewerId: userId,
          decision: v.approve ? "APPROVED" : "REJECTED",
          reason: v.reason,
        },
      });
      await tx.miniAppVersion.update({
        where: { id: build.id },
        data: { status: v.approve ? "APPROVED" : "REJECTED" },
      });
      await tx.miniApp.update({
        where: { id: build.miniAppId },
        data: {
          status: v.approve
            ? build.miniApp.currentVersion
              ? "PUBLISHED"
              : "APPROVED"
            : build.miniApp.currentVersion
              ? "PUBLISHED"
              : "REJECTED",
        },
      });
    });
    await audit(
      userId,
      v.approve ? "MINIAPP_APPROVED" : "MINIAPP_REJECTED",
      build.miniApp.appId,
      build.version,
    );
    return { ok: true, status: v.approve ? "APPROVED" : "REJECTED" };
  }

  if (section === "permissions" && id && method === "POST") {
    const v = z.object({ approve: z.boolean() }).strict().parse(body);
    const request = await db.miniAppPermissionRequest.findUnique({
      where: { id: z.string().uuid().parse(id) },
      include: { miniApp: true },
    });
    requireCondition(request, 404, "NOT_FOUND");
    requireCondition(request.status === "PENDING", 409, "INVALID_STATE");
    await db.$transaction(async (tx) => {
      await tx.miniAppPermissionRequest.update({
        where: { id: request.id },
        data: {
          status: v.approve ? "APPROVED" : "REJECTED",
          reviewedBy: userId,
          reviewedAt: new Date(),
        },
      });
      if (v.approve)
        await tx.miniApp.update({
          where: { id: request.miniAppId },
          data: {
            requestedPermissions: {
              push: request.permission,
            },
          },
        });
    });
    await audit(
      userId,
      v.approve ? "MINIAPP_PERMISSION_APPROVED" : "MINIAPP_PERMISSION_REJECTED",
      request.miniApp.appId,
      request.permission,
    );
    return { ok: true };
  }

  if (section === "apps" && id && sub === "suspend" && method === "POST") {
    const v = z
      .object({ reason: z.string().trim().min(3).max(300) })
      .strict()
      .parse(body);
    const app = await db.miniApp.findUnique({ where: { appId: appIdSchema.parse(id) } });
    requireCondition(app, 404, "NOT_FOUND");
    await db.miniApp.update({
      where: { id: app.id },
      data: { status: "SUSPENDED" },
    });
    await audit(userId, "MINIAPP_SUSPENDED", app.appId, v.reason);
    return { ok: true };
  }

  if (section === "apps" && id && sub === "restore" && method === "POST") {
    const app = await db.miniApp.findUnique({ where: { appId: appIdSchema.parse(id) } });
    requireCondition(app, 404, "NOT_FOUND");
    const build = app.currentVersion
      ? await db.miniAppVersion.findUnique({
          where: { miniAppId_version: { miniAppId: app.id, version: app.currentVersion } },
        })
      : null;
    requireCondition(
      build && build.status === "PUBLISHED" && !build.revokedAt,
      409,
      "NO_PUBLISHED_VERSION",
    );
    await db.miniApp.update({
      where: { id: app.id },
      data: { status: "PUBLISHED" },
    });
    await audit(userId, "MINIAPP_RESTORED", app.appId);
    return { ok: true };
  }

  return undefined;
}

/// Authenticates a server-to-server upload with a Mini App API key. Keys are
/// scoped to a single app and never grant access to the Developer Center.
export async function buildKeyAuth(raw: string) {
  if (!/^qk_[a-f0-9]{48}$/.test(raw)) return null;
  const prefix = raw.slice(0, 12);
  const key = await db.miniAppApiKey.findUnique({
    where: { prefix },
    include: { miniApp: { select: { appId: true, id: true, developerId: true } } },
  });
  if (!key || key.revokedAt) return null;
  if (key.secretHash !== createHash("sha256").update(raw).digest("hex")) return null;
  await db.miniAppApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
  return key.miniApp;
}

/// Uploads and validates a build. Used by the multipart route handler so the
/// JSON API never has to buffer a 20 MB base64 string.
export async function uploadBuild(
  userId: string,
  appId: string,
  form: FormData,
) {
  const app = await developerApp(appId, userId);
  await rateLimit(`miniapp-upload:${userId}`, 20);
  const version = z
    .string()
    .trim()
    .regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,20})?$/)
    .parse(String(form.get("version") ?? ""));
  const channel = z
    .enum(["DEVELOPMENT", "PREVIEW", "PRODUCTION"])
    .parse(String(form.get("channel") ?? "DEVELOPMENT"));
  const file = form.get("file");
  requireCondition(file && typeof file === "object" && "arrayBuffer" in file, 400, "FILE_REQUIRED");
  const blob = file as File;
  requireCondition(blob.size > 0 && blob.size <= 20 * 1024 * 1024, 413, "BUILD_TOO_LARGE");
  const bytes = Buffer.from(await blob.arrayBuffer());
  let inspected;
  try {
    inspected = inspectBuild(bytes, { appId: app.appId, version });
  } catch (error) {
    if (error instanceof PackageError)
      throw new ApiError(400, error.code);
    throw error;
  }
  const existing = await db.miniAppVersion.findUnique({
    where: { miniAppId_version: { miniAppId: app.id, version } },
    select: { id: true },
  });
  requireCondition(!existing, 409, "VERSION_EXISTS");
  const storageKey = `miniapps/${app.appId}/${randomUUID()}.zip`;
  await putBuild(storageKey, bytes);
  try {
    const build = await db.miniAppVersion.create({
      data: {
        miniAppId: app.id,
        version,
        storageKey,
        sha256: inspected.sha256,
        size: inspected.size,
        manifest: inspected.manifest as never,
        entry: inspected.entry,
        minRuntimeVersion: inspected.manifest.minRuntimeVersion,
        requestedPermissions: inspected.permissions,
        status: "UPLOADED",
        channel,
        uploadedBy: userId,
      },
    });
    await db.miniApp.update({
      where: { id: app.id },
      data: {
        status: app.currentVersion ? app.status : "UPLOADED",
        requestedPermissions: inspected.permissions,
      },
    });
    await audit(userId, "MINIAPP_BUILD_UPLOADED", app.appId, version);
    return { build, manifest: inspected.manifest };
  } catch (error) {
    await deleteBuild(storageKey).catch(() => {});
    // Two uploads of the same version can race past the check above; the unique
    // index rejects one of them and it still has to read as a duplicate version.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(409, "VERSION_EXISTS");
    throw error;
  }
}
